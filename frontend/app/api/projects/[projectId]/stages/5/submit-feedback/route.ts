import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Stage 5: Submit feedback/evaluation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const accessToken = (await cookies()).get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json({ detail: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();

    const apiUrl = `${API_URL}/api/projects/${projectId}/stages/5/submit-feedback`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        return NextResponse.json({ detail: errorData.detail || "Failed to submit feedback" }, { status: response.status });
      } catch {
        return NextResponse.json({ detail: errorText }, { status: response.status });
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Stage 5 submit feedback error:", error);
    return NextResponse.json({ detail: "An error occurred" }, { status: 500 });
  }
}
