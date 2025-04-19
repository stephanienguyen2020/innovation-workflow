import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  try {
    const accessToken = cookies().get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(null, { status: 401 });
    }

    // Fetch user data from the backend using the token
    const response = await fetch(`${API_URL}/users/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch user profile:", response.status);
      return NextResponse.json(null, { status: response.status });
    }

    const userData = await response.json();
    return NextResponse.json(userData);
  } catch (error) {
    console.error("Session validation error:", error);
    return NextResponse.json(null, { status: 401 });
  }
}
