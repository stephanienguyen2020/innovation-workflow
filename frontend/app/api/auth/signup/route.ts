import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { first_name, last_name, email, password, role } = body;

    // Basic validation
    if (!first_name || !last_name || !email || !password) {
      return NextResponse.json(
        { detail: "First name, last name, email, and password are required" },
        { status: 400 }
      );
    }

    // Prepare the user data matching UserCreate model from backend
    const userData = {
      first_name,
      last_name,
      email,
      password,
      role: role || "user",
    };

    console.log("Sending signup data:", JSON.stringify(userData));

    const signupUrl = `${API_URL}/signup`;
    console.log("Calling API endpoint:", signupUrl);

    // Call the backend API
    const response = await fetch(signupUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();
    console.log("Signup response status:", response.status);
    console.log("Signup response body:", JSON.stringify(data));

    if (!response.ok) {
      return NextResponse.json(
        { detail: data.detail || data.message || "Signup failed" },
        { status: response.status }
      );
    }

    // Check if this is email verification flow or direct login
    if (data.requires_verification) {
      // Return verification data for email verification flow
      return NextResponse.json({
        message: data.message,
        email: data.email,
        requires_verification: true,
        is_admin: data.is_admin || false,
      });
    }

    // Format user data for the client (for direct login after signup)
    const userDataForClient = {
      id: data.user_id,
      name: `${first_name} ${last_name}`.trim(),
      email: email,
      access_token: data.access_token,
      token_type: data.token_type,
      is_admin: data.is_admin || false,
    };

    // Set cookie with access token if available
    const responseObj = NextResponse.json(userDataForClient);

    if (data.access_token) {
      responseObj.cookies.set({
        name: "access_token",
        value: data.access_token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });
    }

    return responseObj;
  } catch (error) {
    console.log("API_URL", API_URL);
    console.error("Signup error:", error);
    return NextResponse.json(
      { detail: "An error occurred during signup" },
      { status: 500 }
    );
  }
}
