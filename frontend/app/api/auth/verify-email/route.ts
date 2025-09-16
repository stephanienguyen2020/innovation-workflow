import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, verification_code } = body;

    if (!email || !verification_code) {
      return NextResponse.json(
        { detail: "Email and verification code are required" },
        { status: 400 }
      );
    }

    console.log("Verifying email:", email);

    const verifyUrl = `${API_URL}/verify-email`;

    const response = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        verification_code,
      }),
    });

    const data = await response.json();
    console.log("Email verification response:", response.status, data);

    if (!response.ok) {
      return NextResponse.json(
        { detail: data.message || data.detail || "Email verification failed" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      { detail: "An error occurred during email verification" },
      { status: 500 }
    );
  }
}
