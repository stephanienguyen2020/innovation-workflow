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
    console.log(`Fetching product ideas for project ID: ${projectId}`);

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

    const apiUrl = `${API_URL}/api/projects/${projectId}/stages/3`;
    console.log(`Calling backend API at: ${apiUrl}`);

    // Call the backend API to fetch product ideas
    const response = await fetch(apiUrl, {
      method: "GET",
      headers,
    });

    console.log("Backend response status:", response.status);

    // Parse the response
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to fetch product ideas:", errorText);

      try {
        // Try to parse as JSON
        const errorData = JSON.parse(errorText);
        return NextResponse.json(
          { detail: errorData.detail || "Failed to fetch product ideas" },
          { status: response.status }
        );
      } catch (e) {
        // If not JSON, return the raw text
        return NextResponse.json(
          { detail: errorText || "Failed to fetch product ideas" },
          { status: response.status }
        );
      }
    }

    const data = await response.json();
    console.log("Backend product ideas raw data:", data);

    // Return the response from the backend
    return NextResponse.json(data);
  } catch (error) {
    console.error("Product ideas fetch error:", error);
    return NextResponse.json(
      { detail: "An error occurred while fetching product ideas" },
      { status: 500 }
    );
  }
}
