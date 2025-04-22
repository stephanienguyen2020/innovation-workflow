import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    // Get the project ID from the URL
    const projectId = params.projectId;
    console.log(`Fetching project with ID: ${projectId}`);

    // Get the access token from cookies for authentication
    const accessToken = cookies().get("access_token")?.value;

    // Set up headers
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Add authorization header if token exists
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const apiUrl = `${API_URL}/api/projects/${projectId}`;
    console.log(`Calling backend API at: ${apiUrl}`);

    // Call the backend API to fetch the project
    const response = await fetch(apiUrl, {
      method: "GET",
      headers,
    });

    console.log("Backend response status:", response.status);

    // Parse the response
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to fetch project:", errorText);

      try {
        // Try to parse as JSON
        const errorData = JSON.parse(errorText);
        return NextResponse.json(
          { detail: errorData.detail || "Failed to fetch project" },
          { status: response.status }
        );
      } catch (e) {
        // If not JSON, return the raw text
        return NextResponse.json(
          { detail: errorText || "Failed to fetch project" },
          { status: response.status }
        );
      }
    }

    // Get the raw response
    const responseText = await response.text();

    try {
      // Parse as JSON
      const data = JSON.parse(responseText);
      return NextResponse.json(data);
    } catch (parseError) {
      console.error("Error parsing JSON response:", parseError);

      // If we can't parse as JSON, return the raw text
      return NextResponse.json(
        { detail: "Invalid response format from backend" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Project fetch error:", error);
    return NextResponse.json(
      { detail: "An error occurred while fetching the project" },
      { status: 500 }
    );
  }
}
