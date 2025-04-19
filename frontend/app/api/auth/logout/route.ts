import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    // Get the access token from cookies
    const accessToken = cookies().get("access_token")?.value;

    // The correct API endpoint URL based on the router definition in main.py
    const logoutUrl = `${API_URL}/logout`;
    console.log("Calling API endpoint:", logoutUrl);

    // Call the backend API
    const response = await fetch(logoutUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken || ""}`,
      },
    });

    // Delete the cookie regardless of the response
    const responseObj = NextResponse.json(
      { message: "Logged out successfully" },
      { status: 200 }
    );

    responseObj.cookies.delete("access_token");

    return responseObj;
  } catch (error) {
    console.error("Logout error:", error);

    // Still delete the cookie even if there's an error
    const responseObj = NextResponse.json(
      { detail: "An error occurred during logout" },
      { status: 500 }
    );

    responseObj.cookies.delete("access_token");

    return responseObj;
  }
}
