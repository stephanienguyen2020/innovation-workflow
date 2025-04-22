import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    // Get the project ID from the URL
    const projectId = params.projectId;
    console.log(`Fetching project ID: ${projectId}`);

    // Get the access token from cookies for authentication
    const accessToken = cookies().get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { detail: "Authentication required" },
        { status: 401 }
      );
    }

    // Fetch the project details from the backend
    const response = await fetch(`${API_URL}/api/projects/${projectId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to fetch project:", errorText);
      return NextResponse.json(
        { detail: "Failed to fetch project" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Project fetch error:", error);
    return NextResponse.json(
      { detail: "An error occurred while fetching project" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    // Get the project ID from the URL
    const projectId = params.projectId;
    console.log(`Updating project ID: ${projectId}`);

    // Get the access token from cookies for authentication
    const accessToken = cookies().get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { detail: "Authentication required" },
        { status: 401 }
      );
    }

    // Get the update data from the request body
    const body = await request.json();

    // Construct the URL to update the project
    const apiUrl = `${API_URL}/api/projects/${projectId}`;
    console.log(`Updating project at ${apiUrl} with data:`, body);

    // Call the backend API to update the project
    const response = await fetch(apiUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    console.log("Backend update project response status:", response.status);

    // Parse the response
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Project update failed:", errorText);

      try {
        // Try to parse as JSON
        const errorData = JSON.parse(errorText);
        return NextResponse.json(
          { detail: errorData.detail || "Failed to update project" },
          { status: response.status }
        );
      } catch (e) {
        // If not JSON, return the raw text
        return NextResponse.json(
          { detail: errorText || "Failed to update project" },
          { status: response.status }
        );
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Project update error:", error);
    return NextResponse.json(
      { detail: "An error occurred while updating the project" },
      { status: 500 }
    );
  }
}
