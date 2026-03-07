import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function GET(request: NextRequest) {
  try {
    const accessToken = (await cookies()).get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { detail: "Authentication required" },
        { status: 401 }
      );
    }

    const response = await fetch(`${API_URL}/api/admin/users`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        return NextResponse.json(
          { detail: errorData.detail || "Failed to fetch users" },
          { status: response.status }
        );
      } catch {
        return NextResponse.json(
          { detail: errorText || "Failed to fetch users" },
          { status: response.status }
        );
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Users fetch error:", error);
    return NextResponse.json(
      { detail: "An error occurred while fetching users" },
      { status: 500 }
    );
  }
}
