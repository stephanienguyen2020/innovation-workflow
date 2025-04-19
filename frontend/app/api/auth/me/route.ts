import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  try {
    const accessToken = cookies().get("access_token")?.value;

    console.log("Checking authentication - Token exists:", !!accessToken);

    if (!accessToken) {
      console.log("No access token found in cookies");
      return NextResponse.json(null, { status: 401 });
    }

    // Fetch user data from the backend using the token
    console.log("Fetching user data from backend");
    const response = await fetch(`${API_URL}/api/users/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log("Backend /users/me response status:", response.status);

    if (!response.ok) {
      console.error("Failed to fetch user profile:", response.status);
      return NextResponse.json(
        { error: "Failed to validate session" },
        { status: response.status }
      );
    }

    const backendUserData = await response.json();
    console.log(
      "Backend /users/me response data:",
      JSON.stringify(backendUserData, null, 2)
    );

    // If the response doesn't contain necessary user data, return error
    if (!backendUserData || Object.keys(backendUserData).length === 0) {
      console.error("Backend returned empty user data");
      return NextResponse.json(
        { error: "Invalid user data received" },
        { status: 401 }
      );
    }

    // Transform the data to match the expected format in the frontend
    const formattedUserData = {
      id: backendUserData.userId || backendUserData.id || "",
      email: backendUserData.username || backendUserData.email || "",
      name:
        backendUserData.name ||
        (backendUserData.username
          ? backendUserData.username.split("@")[0]
          : "") ||
        (backendUserData.email ? backendUserData.email.split("@")[0] : ""),
      // Add any other fields from the backend that might be needed
    };

    // Validate we have at least an ID
    if (!formattedUserData.id) {
      console.error("Failed to extract user ID from backend data");
      return NextResponse.json(
        { error: "Invalid user data format" },
        { status: 500 }
      );
    }

    console.log(
      "Transformed user data for frontend:",
      JSON.stringify(formattedUserData, null, 2)
    );

    return NextResponse.json(formattedUserData);
  } catch (error) {
    console.error("Session validation error:", error);
    return NextResponse.json(
      { error: "Authentication check failed" },
      { status: 500 }
    );
  }
}
