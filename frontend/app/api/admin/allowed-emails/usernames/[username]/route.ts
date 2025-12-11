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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const headers = await getAuthHeaders();
    const { username } = await params;

    const response = await fetch(
      `${API_URL}/api/admin/allowed-emails/usernames/${encodeURIComponent(
        username
      )}`,
      {
        method: "DELETE",
        headers,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { detail: data.detail || "Failed to remove username" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error removing username:", error);
    return NextResponse.json({ detail: "An error occurred" }, { status: 500 });
  }
}
