import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Stage 4: AI prediction of which solution would be most selected
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const accessToken = (await cookies()).get("access_token")?.value;

    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

    const modelType = request.headers.get("X-Model-Type");
    if (modelType) headers["X-Model-Type"] = modelType;

    const response = await fetch(
      `${API_URL}/api/projects/${projectId}/stages/4/ai-prediction`,
      { method: "POST", headers }
    );

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        return NextResponse.json(
          { detail: errorData.detail || "Failed to generate AI prediction" },
          { status: response.status }
        );
      } catch {
        return NextResponse.json(
          { detail: errorText || "Failed to generate AI prediction" },
          { status: response.status }
        );
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("AI prediction error:", error);
    return NextResponse.json(
      { detail: "An error occurred while generating AI prediction" },
      { status: 500 }
    );
  }
}
