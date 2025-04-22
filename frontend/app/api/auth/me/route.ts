import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const accessToken = cookies().get("access_token")?.value;
    console.log("Checking authentication - Token exists:", !!accessToken);

    if (!accessToken) {
      console.log("No access token found in cookies");
      return NextResponse.json(null, { status: 401 });
    }

    // Since we don't have a /users/me endpoint, we'll return success if token exists
    // The actual user data is stored in localStorage after login
    return NextResponse.json({ isAuthenticated: true });
  } catch (error) {
    console.error("Session validation error:", error);
    return NextResponse.json(
      { error: "Authentication check failed" },
      { status: 500 }
    );
  }
}
