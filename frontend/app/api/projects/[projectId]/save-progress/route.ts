import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    // Get the project ID from the URL
    const projectId = params.projectId;
    console.log(`Saving progress for project ID: ${projectId}`);

    // Get the access token from cookies for authentication
    const accessToken = cookies().get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { detail: "Authentication required" },
        { status: 401 }
      );
    }

    // Get the data from the request body
    const body = await request.json();
    const { stage, data, completed } = body;

    if (!stage) {
      return NextResponse.json(
        { detail: "Stage number is required" },
        { status: 400 }
      );
    }

    // Construct the URL to save progress to the backend
    const apiUrl = `${API_URL}/projects/${projectId}/stages/${stage}`;
    console.log(`Saving progress to ${apiUrl}`);

    // Call the backend API to save progress
    const response = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data,
        status: completed ? "completed" : "in_progress",
      }),
    });

    console.log("Backend save progress response status:", response.status);

    // Parse the response
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Progress save failed:", errorText);

      try {
        // Try to parse as JSON
        const errorData = JSON.parse(errorText);
        return NextResponse.json(
          { detail: errorData.detail || "Failed to save progress" },
          { status: response.status }
        );
      } catch (e) {
        // If not JSON, return the raw text
        return NextResponse.json(
          { detail: errorText || "Failed to save progress" },
          { status: response.status }
        );
      }
    }

    const responseData = await response.json();
    console.log(
      "Save progress response data:",
      JSON.stringify(responseData, null, 2)
    );

    // Return the response from the backend
    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Progress save error:", error);
    return NextResponse.json(
      { detail: "An error occurred while saving progress" },
      { status: 500 }
    );
  }
}
