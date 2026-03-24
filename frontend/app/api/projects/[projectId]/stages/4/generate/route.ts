import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Stage 4: Ideate - generate product ideas
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

    // Forward query parameters (selected_problem_id or custom_problem)
    const url = new URL(request.url);
    const selectedProblemId = url.searchParams.get("selected_problem_id");
    const customProblem = url.searchParams.get("custom_problem");

    let apiUrl = `${API_URL}/api/projects/${projectId}/stages/4/generate`;
    const queryParams = new URLSearchParams();

    if (selectedProblemId) {
      queryParams.append("selected_problem_id", selectedProblemId);
    }
    if (customProblem) {
      queryParams.append("custom_problem", customProblem);
    }
    if (queryParams.toString()) {
      apiUrl += `?${queryParams.toString()}`;
    }

    const response = await fetch(apiUrl, { method: "POST", headers });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        return NextResponse.json(
          { detail: errorData.detail || "Failed to generate product ideas" },
          { status: response.status }
        );
      } catch {
        return NextResponse.json(
          { detail: errorText || "Failed to generate product ideas" },
          { status: response.status }
        );
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Stage 4 generate error:", error);
    return NextResponse.json(
      { detail: "An error occurred while generating product ideas" },
      { status: 500 }
    );
  }
}
