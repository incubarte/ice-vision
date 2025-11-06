
import { NextResponse } from 'next/server';
import { getAccessRequest, getRemoteAccessPassword } from '@/lib/server-side-store';

// This is a dedicated endpoint for clients to poll their request status.
export async function POST(request: Request) {
  try {
    const { requestId } = await request.json();

    if (!requestId) {
        return NextResponse.json({ message: 'Request ID is required.' }, { status: 400 });
    }

    const requestData = await getAccessRequest(requestId);
    
    if (!requestData) {
      // If the request doesn't exist, it was either rejected, expired, or never existed.
      return NextResponse.json({ message: 'Request not found or expired.' }, { status: 404 });
    }
    
    if (requestData.approved) {
      const password = await getRemoteAccessPassword();
      return NextResponse.json({ approved: true, password: password });
    } else {
      // The request exists but is not yet approved.
      return NextResponse.json({ approved: false });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error.';
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}
