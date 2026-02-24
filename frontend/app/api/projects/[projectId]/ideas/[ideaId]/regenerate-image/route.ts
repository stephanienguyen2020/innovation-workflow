import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function POST(
  request: Request,
  { params }: { params: { projectId: string; ideaId: string } }
) {
  const { projectId, ideaId } = params;
  const accessToken = cookies().get("access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  try {
    // Parse the request body to get feedback (if provided)
    let feedback: string | null = null;
    try {
      const body = await request.json();
      feedback = body.feedback || null;
    } catch {
      // No body or invalid JSON, proceed without feedback
    }

    const backendResponse = await fetch(
      `${API_URL}/api/projects/${projectId}/ideas/${ideaId}/regenerate-image`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ feedback }),
      }
    );

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      return NextResponse.json(
        { detail: errorData.detail || "Failed to regenerate image" },
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { detail: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
