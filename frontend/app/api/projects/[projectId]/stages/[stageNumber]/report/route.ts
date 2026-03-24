import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Generate a per-stage report
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; stageNumber: string }> }
) {
  try {
    const { projectId, stageNumber } = await params;
    const accessToken = (await cookies()).get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json({ detail: "Authentication required" }, { status: 401 });
    }

    const modelType = request.headers.get("X-Model-Type");
    const fetchHeaders: HeadersInit = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    if (modelType) fetchHeaders["X-Model-Type"] = modelType;

    const apiUrl = `${API_URL}/api/projects/${projectId}/stages/${stageNumber}/report`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: fetchHeaders,
    });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        return NextResponse.json({ detail: errorData.detail || "Failed to generate report" }, { status: response.status });
      } catch {
        return NextResponse.json({ detail: errorText }, { status: response.status });
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Stage report error:", error);
    return NextResponse.json({ detail: "An error occurred" }, { status: 500 });
  }
}

// Get an existing per-stage report
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; stageNumber: string }> }
) {
  try {
    const { projectId, stageNumber } = await params;
    const accessToken = (await cookies()).get("access_token")?.value;

    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

    const apiUrl = `${API_URL}/api/projects/${projectId}/stages/${stageNumber}/report`;
    const response = await fetch(apiUrl, { method: "GET", headers });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        return NextResponse.json({ detail: errorData.detail || "Report not found" }, { status: response.status });
      } catch {
        return NextResponse.json({ detail: errorText }, { status: response.status });
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Stage report fetch error:", error);
    return NextResponse.json({ detail: "An error occurred" }, { status: 500 });
  }
}
