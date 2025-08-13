import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const isAuthPage = request.nextUrl.pathname === "/auth";
  const isHealth = request.nextUrl.pathname.startsWith("/api/health");
  if (isHealth) return NextResponse.next();

  // Check for session cookies (both NextAuth v4 and v5 cookie names)
  const sessionToken =
    request.cookies.get("next-auth.session-token")?.value ??
    request.cookies.get("authjs.session-token")?.value ??
    request.cookies.get("__Secure-next-auth.session-token")?.value ??
    request.cookies.get("__Secure-authjs.session-token")?.value;

  // If user has a session token and tries to access auth page, redirect to home
  if (sessionToken && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // If user doesn't have a session token and tries to access protected routes, redirect to auth
  if (!sessionToken && !isAuthPage) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)",
  ],
};
