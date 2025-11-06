
import { NextResponse } from 'next/server';
import { getRemoteAccessPassword, isClientLocal } from '@/lib/server-side-store';

// This endpoint is now a fallback and for local auth checks.
// The primary remote auth flow is handled by /api/auth-challenge
export async function POST(request: Request) {
  try {
    const clientIsLocal = await isClientLocal(request);
    
    // Local clients are always authenticated
    if (clientIsLocal) {
        return NextResponse.json({ authenticated: true });
    }

    // Remote clients with a stored password (from a previous successful challenge)
    const { password } = await request.json();
    const serverPassword = await getRemoteAccessPassword();
    
    if (password && password === serverPassword) {
        return NextResponse.json({ authenticated: true });
    }
    
    // If no password or wrong password, they are unauthenticated and should use the challenge flow.
    return NextResponse.json({ authenticated: false }, { status: 401 });

  } catch (error) {
    console.error('API Error: Failed to process auth request', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Failed to process auth request.', error: errorMessage }, { status: 500 });
  }
}
