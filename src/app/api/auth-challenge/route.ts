
import { NextResponse } from 'next/server';
import {
  createAccessRequest,
  getAccessRequest,
  approveAccessRequest,
  getRemoteAccessPassword,
  removeAccessRequest,
  getAllAccessRequests
} from '@/lib/server-side-store';

export async function POST(request: Request) {
  try {
    const { action, requestId, userAgent, verificationNumber } = await request.json();
    const clientIp = (request.headers.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();

    switch (action) {
      case 'request': {
        if (verificationNumber === undefined) {
            return NextResponse.json({ success: false, message: 'Verification number is required.' }, { status: 400 });
        }
        const newRequest = createAccessRequest(clientIp, userAgent, verificationNumber);
        return NextResponse.json({ success: true, request: newRequest });
      }

      case 'approve': {
        if (!requestId) return NextResponse.json({ success: false, message: 'Request ID is required.' }, { status: 400 });
        
        const approved = approveAccessRequest(requestId);
        if (!approved) {
          return NextResponse.json({ success: false, message: 'Request not found or already approved.' }, { status: 404 });
        }
        
        return NextResponse.json({ success: true, message: 'Request approved.' });
      }
      
      case 'reject': {
         if (!requestId) return NextResponse.json({ success: false, message: 'Request ID is required.' }, { status: 400 });
         removeAccessRequest(requestId);
         return NextResponse.json({ success: true, message: 'Request rejected.' });
      }

      default:
        return NextResponse.json({ success: false, message: 'Invalid action.' }, { status: 400 });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error.';
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}

export async function GET(request: Request) {
    try {
        const requests = getAllAccessRequests();
        return NextResponse.json({ success: true, requests });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown server error.';
        return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
    }
}
