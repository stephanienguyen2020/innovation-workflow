import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    // Get the project ID from the URL
    const projectId = params.projectId;
    console.log(`Generating problem statements for project ID: ${projectId}`);

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

    const apiUrl = `${API_URL}/api/projects/${projectId}/stages/2/generate`;
    console.log(`Calling backend to generate problem statements at: ${apiUrl}`);

    // Call the backend API to generate problem statements
    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
    });

    console.log("Backend problem-generate response status:", response.status);

    // Check if response type is JSON
    const contentType = response.headers.get("content-type");
    console.log("Response content type:", contentType);

    // Parse the response
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Problem statements generation failed:", errorText);

      try {
        // Try to parse as JSON
        const errorData = JSON.parse(errorText);
        return NextResponse.json(
          {
            detail: errorData.detail || "Failed to generate problem statements",
          },
          { status: response.status }
        );
      } catch (e) {
        // If not JSON, return the raw text
        return NextResponse.json(
          { detail: errorText || "Failed to generate problem statements" },
          { status: response.status }
        );
      }
    }

    const data = await response.json();
    console.log("Backend problem statements generation raw data:", data);

    // Return the response from the backend without modification
    return NextResponse.json(data);
  } catch (error) {
    console.error("Problem statements generation error:", error);
    return NextResponse.json(
      { detail: "An error occurred while generating problem statements" },
      { status: 500 }
    );
  }
}
