import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

    console.log("Attempting login for user:", username);

    // Create form data in the format expected by OAuth2PasswordRequestForm
    const params = new URLSearchParams();
    params.append("username", username);
    params.append("password", password);

    // The correct API endpoint URL based on the router definition in main.py
    const loginUrl = `${API_URL}/login`;
    console.log("Calling API endpoint:", loginUrl);

    // Call the backend API
    const response = await fetch(loginUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const data = await response.json();
    console.log("Login response status:", response.status);
    console.log("Login response body:", data);

    if (!response.ok) {
      console.error("Login failed:", data);
      return NextResponse.json(
        { detail: data.detail || "Login failed" },
        { status: response.status }
      );
    }

    console.log("Login successful:", data);
    // Format user data for the frontend
    const userData = {
      userId: data.user?.userId, // Use the userId from the user object
      email: data.user?.username || username,
      name: data.user?.username?.split("@")[0] || username.split("@")[0],
      access_token: data.access_token,
      token_type: data.token_type || "bearer",
    };

    console.log(
      "Transformed user data for frontend:",
      JSON.stringify(userData)
    );

    // Set cookie with access token
    const responseObj = NextResponse.json(userData);

    responseObj.cookies.set({
      name: "access_token",
      value: data.access_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });

    return responseObj;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { detail: "An error occurred during login" },
      { status: 500 }
    );
  }
}
