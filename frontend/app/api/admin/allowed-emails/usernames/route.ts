import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function getAuthHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token");
  return {
    Authorization: token ? `Bearer ${token.value}` : "",
    "Content-Type": "application/json",
  };
}

export async function GET(request: NextRequest) {
  try {
    const headers = await getAuthHeaders();

    const response = await fetch(
      `${API_URL}/api/admin/allowed-emails/usernames`,
      {
        method: "GET",
        headers,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { detail: data.detail || "Failed to fetch usernames" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching usernames:", error);
    return NextResponse.json({ detail: "An error occurred" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const headers = await getAuthHeaders();
    const body = await request.json();

    const response = await fetch(
      `${API_URL}/api/admin/allowed-emails/usernames`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { detail: data.detail || "Failed to add username" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error adding username:", error);
    return NextResponse.json({ detail: "An error occurred" }, { status: 500 });
  }
}
