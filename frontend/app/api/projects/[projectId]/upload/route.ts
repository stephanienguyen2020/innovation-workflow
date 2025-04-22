import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    // Get the project ID from the URL
    const projectId = params.projectId;
    console.log(`Processing upload for project ID: ${projectId}`);

    // Get the access token from cookies for authentication
    const accessToken = cookies().get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { detail: "Authentication required" },
        { status: 401 }
      );
    }

    // Get the file from the form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ detail: "No file uploaded" }, { status: 400 });
    }

    // Validate file type (PDF only)
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { detail: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    // Create a new FormData to send to the backend
    const backendFormData = new FormData();
    backendFormData.append("file", file);

    const apiUrl = `${API_URL}/projects/${projectId}/stages/1/upload`;
    console.log(
      `Uploading file ${file.name} to project ${projectId} at ${apiUrl}`
    );

    // Call the backend API to upload the document
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: backendFormData,
    });

    console.log("Backend upload response status:", response.status);

    // Parse the response
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Document upload failed:", errorText);

      try {
        // Try to parse as JSON
        const errorData = JSON.parse(errorText);
        return NextResponse.json(
          { detail: errorData.detail || "Failed to upload document" },
          { status: response.status }
        );
      } catch (e) {
        // If not JSON, return the raw text
        return NextResponse.json(
          { detail: errorText || "Failed to upload document" },
          { status: response.status }
        );
      }
    }

    const data = await response.json();
    console.log("Upload response data:", JSON.stringify(data, null, 2));

    // Return the response from the backend without modification
    return NextResponse.json(data);
  } catch (error) {
    console.error("Document upload error:", error);
    return NextResponse.json(
      { detail: "An error occurred while uploading the document" },
      { status: 500 }
    );
  }
}
