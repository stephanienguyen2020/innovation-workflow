import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

    // Get user ID from query parameter
    const url = new URL(request.url);
    const user_id = url.searchParams.get("user_id");

    console.log("Creating project - User ID from query:", user_id);

    if (!user_id) {
      return NextResponse.json(
        { detail: "User ID is required" },
        { status: 400 }
      );
    }

    const apiUrl = `${API_URL}/projects/?user_id=${user_id}`;
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

    // Ensure the MongoDB _id is preserved in the response
    // The backend project schema uses `id: ObjectId = Field(alias="_id")`
    console.log("Project created successfully with _id:", data._id || data.id);

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
