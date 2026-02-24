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
    console.log(`Uploading text for project ID: ${projectId}`);

    const accessToken = cookies().get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { detail: "Authentication required" },
        { status: 401 }
      );
    }

    if (!API_URL) {
      return NextResponse.json(
        { detail: "Backend API URL is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();

    const apiUrl = `${API_URL}/api/projects/${projectId}/stages/1/upload-text`;
    console.log(`Uploading text to backend: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Text upload failed:", errorText);

      try {
        const errorData = JSON.parse(errorText);
        return NextResponse.json(
          { detail: errorData.detail || "Failed to upload text" },
          { status: response.status }
        );
      } catch (e) {
        return NextResponse.json(
          { detail: errorText || "Failed to upload text" },
          { status: response.status }
        );
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Text upload error:", error);
    return NextResponse.json(
      { detail: "An error occurred while uploading text" },
      { status: 500 }
    );
  }
}
