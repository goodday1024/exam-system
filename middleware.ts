import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Example: Redirect based on a header or cookie
  // const isAuthenticated = request.cookies.get('auth')?.value;
  // if (!isAuthenticated) {
  //   return NextResponse.redirect(new URL('/login', request.url));
  // }

  // Example: Modify request headers
  // const requestHeaders = new Headers(request.headers);
  // requestHeaders.set('x-custom-header', 'my-value');

  // Example: Rewrite the URL
  // if (request.nextUrl.pathname === '/old-path') {
  //   return NextResponse.rewrite(new URL('/new-path', request.url));
  // }

  // Continue to the next middleware or the requested route
  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/auth (auth routes)
     * - api/proxy-image (image proxy routes)
     * - api/student (student routes)
     * - api/teacher (teacher routes)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth|api/proxy-image|api/student|api/teacher).*)',
  ],
};