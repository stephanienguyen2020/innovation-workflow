import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { name, email, password } = body;

    // Basic validation
    if (!name || !email || !password) {
      return NextResponse.json(
        { detail: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    // Mock signup - in a real app, you would store this in a database
    const user = {
      userId: "123",
      username: email,
      name: name,
    };

    return NextResponse.json(
      {
        access_token: "mock_token",
        token_type: "bearer",
        user: user,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { detail: "An error occurred during signup" },
      { status: 500 }
    );
  }
}
