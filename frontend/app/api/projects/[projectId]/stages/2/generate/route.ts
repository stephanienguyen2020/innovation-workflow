import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Stage 2: Understand - SSE streaming analysis
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const accessToken = (await cookies()).get("access_token")?.value;
    if (!accessToken) {
      return NextResponse.json(
        { detail: "Authentication required" },
        { status: 401 }
      );
    }

    const modelType = request.headers.get("X-Model-Type");
    const apiUrl = `${API_URL}/api/projects/${projectId}/stages/2/generate/stream`;

    const fetchHeaders: HeadersInit = {
      Authorization: `Bearer ${accessToken}`,
    };
    if (modelType) {
      fetchHeaders["X-Model-Type"] = modelType;
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: fetchHeaders,
    });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        return NextResponse.json(
          { detail: errorData.detail || "Failed to generate analysis" },
          { status: response.status }
        );
      } catch {
        return NextResponse.json(
          { detail: errorText || "Failed to generate analysis" },
          { status: response.status }
        );
      }
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Stage 2 analysis error:", error);
    return NextResponse.json(
      { detail: "An error occurred while generating the analysis" },
      { status: 500 }
    );
  }
}
