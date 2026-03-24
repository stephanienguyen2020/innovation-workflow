import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Get iteration history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const accessToken = (await cookies()).get("access_token")?.value;

    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

    const apiUrl = `${API_URL}/api/projects/${projectId}/iterations`;
    const response = await fetch(apiUrl, { method: "GET", headers });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        return NextResponse.json({ detail: errorData.detail || "Failed to fetch iterations" }, { status: response.status });
      } catch {
        return NextResponse.json({ detail: errorText }, { status: response.status });
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Iterations fetch error:", error);
    return NextResponse.json({ detail: "An error occurred" }, { status: 500 });
  }
}
