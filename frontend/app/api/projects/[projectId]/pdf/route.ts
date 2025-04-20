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
    console.log(`Fetching PDF for project ID: ${projectId}`);

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

    const apiUrl = `${API_URL}/api/projects/${projectId}/pdf`;
    console.log(`Calling backend API at: ${apiUrl}`);

    // Call the backend API to fetch the PDF
    const response = await fetch(apiUrl, {
      method: "GET",
      headers,
    });

    console.log("Backend response status:", response.status);

    // If response is not OK, handle error
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to fetch PDF:", errorText);

      try {
        // Try to parse as JSON
        const errorData = JSON.parse(errorText);
        return NextResponse.json(
          { detail: errorData.detail || "Failed to download PDF" },
          { status: response.status }
        );
      } catch (e) {
        // If not JSON, return the raw text
        return NextResponse.json(
          { detail: errorText || "Failed to download PDF" },
          { status: response.status }
        );
      }
    }

    // Get the PDF content as ArrayBuffer
    const pdfBuffer = await response.arrayBuffer();

    // Create a response with the PDF content
    const pdfResponse = new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="innovation_report_${projectId}.pdf"`,
      },
    });

    return pdfResponse;
  } catch (error) {
    console.error("PDF fetch error:", error);
    return NextResponse.json(
      { detail: "An error occurred while fetching the PDF" },
      { status: 500 }
    );
  }
}
