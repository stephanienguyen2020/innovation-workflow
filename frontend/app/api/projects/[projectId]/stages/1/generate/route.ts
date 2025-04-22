import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    // Get the project ID from the URL
    const projectId = params.projectId;
    console.log(`Generating analysis for project ID: ${projectId}`);

    // Get the access token from cookies for authentication
    const accessToken = cookies().get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { detail: "Authentication required" },
        { status: 401 }
      );
    }

    const apiUrl = `${API_URL}/projects/${projectId}/stages/1/generate`;
    console.log(`Calling backend analysis generation at: ${apiUrl}`);

    // Call the backend API to generate document analysis
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log("Backend analysis response status:", response.status);

    // Parse the response
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Analysis generation failed:", errorText);

      try {
        // Try to parse as JSON
        const errorData = JSON.parse(errorText);
        return NextResponse.json(
          { detail: errorData.detail || "Failed to generate analysis" },
          { status: response.status }
        );
      } catch (e) {
        // If not JSON, return the raw text
        return NextResponse.json(
          { detail: errorText || "Failed to generate analysis" },
          { status: response.status }
        );
      }
    }

    const data = await response.json();
    console.log("Analysis generation data:", JSON.stringify(data, null, 2));

    // Return the response from the backend without modification
    return NextResponse.json(data);
  } catch (error) {
    console.error("Analysis generation error:", error);
    return NextResponse.json(
      { detail: "An error occurred while generating the analysis" },
      { status: 500 }
    );
  }
}
