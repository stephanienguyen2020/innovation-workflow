import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, token, new_password } = body;

    if (!email || !token || !new_password) {
      return NextResponse.json(
        { detail: "Email, reset code, and new password are required" },
        { status: 400 }
      );
    }

    const response = await fetch(`${API_URL}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token, new_password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { detail: data.message || data.detail || "Failed to reset password" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { detail: "An error occurred" },
      { status: 500 }
    );
  }
}
