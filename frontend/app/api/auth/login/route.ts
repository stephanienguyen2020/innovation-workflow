import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    // Basic validation
    if (!username || !password) {
      return NextResponse.json(
        { detail: "Username and password are required" },
        { status: 400 }
      );
    }

    // Mock authentication - in a real app, you would validate against a database
    // For now, we'll accept any credentials
    const user = {
      userId: "123",
      username: username,
      name: username.split("@")[0],
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
    console.error("Login error:", error);
    return NextResponse.json(
      { detail: "An error occurred during login" },
      { status: 500 }
    );
  }
}
