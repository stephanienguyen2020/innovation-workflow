import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

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
      `${API_URL}/api/admin/allowed-emails/domains`,
      {
        method: "GET",
        headers,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { detail: data.detail || "Failed to fetch domains" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching domains:", error);
    return NextResponse.json({ detail: "An error occurred" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const headers = await getAuthHeaders();
    const body = await request.json();

    const response = await fetch(
      `${API_URL}/api/admin/allowed-emails/domains`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { detail: data.detail || "Failed to add domain" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error adding domain:", error);
    return NextResponse.json({ detail: "An error occurred" }, { status: 500 });
  }
}
