
import { NextResponse } from 'next/server';
import { getCommandEmitter } from '@/lib/server-side-store';
import type { RemoteCommand } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const commandEmitter = await getCommandEmitter();
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let intervalId: NodeJS.Timeout;

      const onCommand = (command: RemoteCommand) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(command)}\n\n`));
        } catch (e) {
          console.error("Failed to enqueue command data, stream might be closed.", e);
        }
      };

      const cleanup = () => {
        console.log('Remote Command SSE: Cleaning up resources.');
        clearInterval(intervalId);
        commandEmitter.off('command', onCommand);
      };

      commandEmitter.on('command', onCommand);

      // Keep the connection alive with a ping
      intervalId = setInterval(() => {
        try {
            // SSE comments start with a colon. This is a standard keep-alive mechanism.
            controller.enqueue(encoder.encode(':ping\n\n'));
        } catch (e) {
            console.log('Remote Command SSE: Ping failed, client may have disconnected.');
            cleanup();
            // We don't close the controller here as it might be a temporary network issue.
            // The client is responsible for reconnecting.
        }
      }, 30000); // Send a ping every 30 seconds

      request.signal.onabort = () => {
        console.log('Remote Command SSE: Client disconnected via abort signal.');
        cleanup();
      };
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

