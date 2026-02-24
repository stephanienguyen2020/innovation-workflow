import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const projectId = params.projectId;
    console.log(`Fetching document for project ID: ${projectId}`);

    // Get the access token from cookies for authentication
    const accessToken = cookies().get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { detail: "Authentication required" },
        { status: 401 }
      );
    }

    // Fetch the document from the backend
    const response = await fetch(
      `${API_URL}/api/projects/${projectId}/document`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { detail: "No document found for this project" },
          { status: 404 }
        );
      }
      const errorText = await response.text();
      console.error("Failed to fetch document:", errorText);
      return NextResponse.json(
        { detail: "Failed to fetch document" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Document fetch error:", error);
    return NextResponse.json(
      { detail: "An error occurred while fetching the document" },
      { status: 500 }
    );
  }
}
