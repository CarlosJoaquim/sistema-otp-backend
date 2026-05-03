import { NextRequest, NextResponse } from 'next/server';

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

const publicPaths = [
  '/api/auth/register',
  '/api/auth/verify-email',
  '/api/auth/verify-otp',
  '/api/auth/request-reset',
  '/api/auth/reset-password',
  '/api/auth/confirm-reset',
  '/api/status',
  '/api/health',
];

const adminPaths = [
  '/api/admin/metrics',
  '/api/admin/cleanup',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  if (adminPaths.some(path => pathname.startsWith(path))) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Basic ')) {
      const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
      const [user, pass] = credentials.split(':');
      if (user === ADMIN_USER && pass === ADMIN_PASS) {
        return NextResponse.next();
      }
    }
    return NextResponse.json(
      { success: false, message: 'Não autorizado' },
      { status: 401 }
    );
  }

  const response = NextResponse.next();
  
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  const origin = request.headers.get('origin');
  
  if (origin && (allowedOrigins.includes(origin) || allowedOrigins.includes('*'))) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Max-Age', '86400');
  }

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: response.headers });
  }

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
