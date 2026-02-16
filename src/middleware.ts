import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // 只对 /admin 路径进行保护
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // 排除登录页面
    if (request.nextUrl.pathname === '/admin/login') {
      return NextResponse.next()
    }

    // 检查认证 Cookie
    const authCookie = request.cookies.get('admin_auth')

    if (!authCookie || authCookie.value !== 'authenticated') {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/admin/:path*',
}
