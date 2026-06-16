import { NextRequest, NextResponse } from "next/server";

// Any path ending in a file extension (.png, .svg, .ico, .woff2, .css ...) is a
// static asset and must never be redirected to /login.
const STATIC_FILE = /\.[a-zA-Z0-9]+$/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/") || STATIC_FILE.test(pathname)) return NextResponse.next();
  const hasSession = request.cookies.has("cbos_session");
  if (!hasSession && !pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
