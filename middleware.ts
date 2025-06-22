import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // 为静态资源添加缓存头
  if (request.nextUrl.pathname.startsWith('/_next/static/') || 
      request.nextUrl.pathname.includes('.')) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  
  // 为API路由添加通用安全头
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  }
  
  // 为页面添加基础缓存头
  if (!request.nextUrl.pathname.startsWith('/api/') && 
      !request.nextUrl.pathname.startsWith('/_next/')) {
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    response.headers.set('Vary', 'Accept-Encoding');
  }
  
  return response;
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