import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function POST(request: NextRequest) {
  try {
    // Get the access token from cookies for authentication
    const accessToken = cookies().get("access_token")?.value;

    console.log("Creating project - Access token exists:", !!accessToken);

    if (!accessToken) {
      return NextResponse.json(
        { detail: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse the request body
    const body = await request.json();
    const { problem_domain } = body;

    // Basic validation
    if (!problem_domain) {
      return NextResponse.json(
        { detail: "Problem domain is required" },
        { status: 400 }
      );
    }

    const apiUrl = `${API_URL}/api/projects`;
    console.log("Creating project - calling backend at:", apiUrl);

    // Call the backend API endpoint to create a project
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ problem_domain }),
    });

    // Log the response status
    console.log("Project creation response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Project creation failed:", errorText);

      try {
        // Try to parse as JSON
        const errorData = JSON.parse(errorText);
        return NextResponse.json(
          { detail: errorData.detail || "Failed to create project" },
          { status: response.status }
        );
      } catch (e) {
        // If not JSON, return the raw text
        return NextResponse.json(
          { detail: errorText || "Failed to create project" },
          { status: response.status }
        );
      }
    }

    // Parse the successful response
    const data = await response.json();
    console.log(
      "Project creation response data:",
      JSON.stringify(data, null, 2)
    );

    console.log("Project created successfully with id:", data.id);

    // Return the created project data without modification
    return NextResponse.json(data);
  } catch (error) {
    console.error("Project creation error:", error);
    return NextResponse.json(
      { detail: "An error occurred while creating the project" },
      { status: 500 }
    );
  }
}

export interface Project {
  id: string;
  user_id: string;
  problem_domain: string;
  document_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  stages: Array<{
    stage_number: number;
    status: string;
    data: any;
    created_at: string;
    updated_at: string;
  }>;
}

export async function GET() {
  try {
    // Get the access token from cookies for authentication
    const accessToken = cookies().get("access_token")?.value;

    console.log("Fetching projects - Access token exists:", !!accessToken);

    if (!accessToken) {
      return NextResponse.json(
        { detail: "Authentication required" },
        { status: 401 }
      );
    }

    const response = await fetch(`${API_URL}/api/projects/`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Projects fetch failed:", errorText);

      try {
        // Try to parse as JSON
        const errorData = JSON.parse(errorText);
        return NextResponse.json(
          { detail: errorData.detail || "Failed to fetch projects" },
          { status: response.status }
        );
      } catch (e) {
        // If not JSON, return the raw text
        return NextResponse.json(
          { detail: errorText || "Failed to fetch projects" },
          { status: response.status }
        );
      }
    }

    const data = await response.json();
    console.log("Projects fetched successfully:", data.length, "projects");
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { detail: "An error occurred while fetching projects" },
      { status: 500 }
    );
  }
}
