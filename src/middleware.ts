
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check if the read-only mode is enabled via environment variable
  if (process.env.NEXT_PUBLIC_READ_ONLY === 'true') {
    const { pathname } = request.nextUrl;

    // Define the list of protected admin/editing paths.
    const protectedPaths = [
      '/controls',
      '/config',
      '/setup',
      '/admin',
      '/replays',
    ];
    
    const isEditingTeams = pathname.startsWith('/tournaments/') && pathname.endsWith('/teams');
    const isEditingFixture = pathname.startsWith('/tournaments/') && pathname.endsWith('/fixture');

    // Redirect if it's a protected path
    if (protectedPaths.some(path => pathname.startsWith(path)) || isEditingTeams || isEditingFixture) {
      const url = request.nextUrl.clone();
      
      // If trying to access a specific tournament's editable section, redirect to its standings.
      if (pathname.startsWith('/tournaments/')) {
        const tournamentId = pathname.split('/')[2];
        url.pathname = `/tournaments/${tournamentId}`;
        url.searchParams.set('tab', 'standings');
      } else {
         url.pathname = '/tournaments'; // General fallback to a safe, read-only page
      }
      return NextResponse.redirect(url);
    }
    
    // The root path ('/') is a special case, we allow it to be the scoreboard.
    if (pathname === '/') {
       return NextResponse.next();
    }
  }

  // Allow the request to proceed if not in read-only mode or not a protected path
  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    // We no longer match the root '/' here, as it's allowed.
    '/controls/:path*',
    '/config/:path*',
    '/setup/:path*',
    '/admin/:path*',
    '/replays/:path*',
    '/tournaments/:tournamentId/teams',
    '/tournaments/:tournamentId/fixture'
  ],
};
