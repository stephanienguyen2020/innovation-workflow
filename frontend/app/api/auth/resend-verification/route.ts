import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { detail: "Email is required" },
        { status: 400 }
      );
    }

    console.log("Resending verification code to:", email);

    const resendUrl = `${API_URL}/resend-verification`;

    const response = await fetch(resendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
      }),
    });

    const data = await response.json();
    console.log("Resend verification response:", response.status, data);

    if (!response.ok) {
      return NextResponse.json(
        {
          detail:
            data.message || data.detail || "Failed to resend verification code",
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { detail: "An error occurred while resending verification code" },
      { status: 500 }
    );
  }
}
