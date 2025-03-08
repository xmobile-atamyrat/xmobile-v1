import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  console.log('Middleware executed for:', request.url);

  if (request.nextUrl.pathname === '/cart') {
    return NextResponse.redirect(new URL('/', request.url));
  }

}

export const config = {
  matcher: "/:path*",
};