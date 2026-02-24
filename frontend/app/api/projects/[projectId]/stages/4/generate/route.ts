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

    // Get solution ID from the query parameters
    const searchParams = request.nextUrl.searchParams;
    const solutionId = searchParams.get("solutionId");

    if (!solutionId) {
      return NextResponse.json(
        { detail: "Solution ID is required" },
        { status: 400 }
      );
    }

    console.log(
      `Generating stage 4 data for project ID: ${projectId} with solution ID: ${solutionId}`
    );

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

    const apiUrl = `${API_URL}/api/projects/${projectId}/stages/4/generate?chosen_solution_id=${solutionId}`;
    console.log(`Calling backend API at: ${apiUrl}`);

    // Call the backend API to generate stage 4 data
    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
    });

    console.log("Backend response status:", response.status);

    // Parse the response
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to generate stage 4 data:", errorText);

      try {
        // Try to parse as JSON
        const errorData = JSON.parse(errorText);
        return NextResponse.json(
          { detail: errorData.detail || "Failed to generate report" },
          { status: response.status }
        );
      } catch (e) {
        // If not JSON, return the raw text
        return NextResponse.json(
          { detail: errorText || "Failed to generate report" },
          { status: response.status }
        );
      }
    }

    // Get the raw response
    const responseText = await response.text();
    console.log("Raw response from backend:", responseText);

    try {
      // Parse as JSON
      const data = JSON.parse(responseText);

      // Log everything for debugging
      console.log("FULL RESPONSE DATA:", JSON.stringify(data, null, 2));

      // Return exactly as received
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
    console.error("Stage 4 generation error:", error);
    return NextResponse.json(
      { detail: "An error occurred while generating the report" },
      { status: 500 }
    );
  }
}
