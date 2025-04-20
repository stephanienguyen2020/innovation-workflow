import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = request.cookies.has("access_token");

  // For the root layout, make sure we always render the initial state
  // consistently to prevent hydration errors
  if (pathname === "/") {
    // We want to ensure that the homepage is consistent between
    // server and client renders
    return NextResponse.next();
  }

  // Forward the response with an additional header to force client navigation
  const response = NextResponse.next();

  // Add a custom header to handle auth state transitions
  if (isAuthenticated && (pathname === "/login" || pathname === "/signup")) {
    response.headers.set("X-Auth-Navigation", "true");
  }

  return response;
}

// Specify the paths this middleware will run on:
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
