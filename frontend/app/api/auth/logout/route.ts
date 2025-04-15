import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // In a real app, you would invalidate the token on the server
    // For now, we'll just return a success response

    return NextResponse.json(
      { message: "Logged out successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { detail: "An error occurred during logout" },
      { status: 500 }
    );
  }
}
