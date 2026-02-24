import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const projectId = params.projectId;
    console.log(`Generating analysis (stream) for project ID: ${projectId}`);

    const accessToken = cookies().get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { detail: "Authentication required" },
        { status: 401 }
      );
    }

    const apiUrl = `${API_URL}/api/projects/${projectId}/stages/1/generate/stream`;
    console.log(`Calling backend streaming analysis at: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log("Backend stream response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Analysis generation failed:", errorText);
      try {
        const errorData = JSON.parse(errorText);
        return NextResponse.json(
          { detail: errorData.detail || "Failed to generate analysis" },
          { status: response.status }
        );
      } catch (e) {
        return NextResponse.json(
          { detail: errorText || "Failed to generate analysis" },
          { status: response.status }
        );
      }
    }

    // Stream the response through to the client
    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Analysis generation error:", error);
    return NextResponse.json(
      { detail: "An error occurred while generating the analysis" },
      { status: 500 }
    );
  }
}
