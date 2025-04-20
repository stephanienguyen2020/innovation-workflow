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
    console.log(`Processing stage 3 for project ID: ${projectId}`);

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

    // Extract the exact query parameters that need to be passed
    const url = new URL(request.url);
    const selectedProblemId = url.searchParams.get("selected_problem_id");
    const customProblem = url.searchParams.get("custom_problem");

    console.log("URL parameters received:", {
      selected_problem_id: selectedProblemId,
      custom_problem: customProblem,
      url: url.toString(),
    });

    // Validation checks - match exactly what the backend expects
    if (!selectedProblemId && !customProblem) {
      return NextResponse.json(
        { detail: "Must provide either selected_problem_id or custom_problem" },
        { status: 400 }
      );
    }

    if (selectedProblemId && customProblem) {
      return NextResponse.json(
        {
          detail: "Cannot provide both selected_problem_id and custom_problem",
        },
        { status: 400 }
      );
    }

    // Build the backend URL with the same query parameters
    let apiUrl = `${API_URL}/api/projects/${projectId}/stages/3/generate`;
    const queryParams = new URLSearchParams();

    if (selectedProblemId) {
      queryParams.append("selected_problem_id", selectedProblemId);
      console.log(
        `Passing selected_problem_id to backend: ${selectedProblemId}`
      );
    }

    if (customProblem) {
      queryParams.append("custom_problem", customProblem);
      console.log(`Passing custom_problem to backend: ${customProblem}`);
    }

    if (queryParams.toString()) {
      apiUrl += `?${queryParams.toString()}`;
    }

    console.log(`Calling backend endpoint: ${apiUrl}`);

    // Call the backend API with POST but no body - exactly how the backend expects it
    const backendResponse = await fetch(apiUrl, {
      method: "POST",
      headers,
      // No body needed - backend expects query parameters
    });

    console.log("Backend response status:", backendResponse.status);

    // Handle the backend response based on status
    if (!backendResponse.ok) {
      let errorDetail;
      try {
        const responseText = await backendResponse.text();
        console.error("Error response text:", responseText);

        if (responseText && responseText.trim()) {
          try {
            const errorData = JSON.parse(responseText);
            errorDetail = errorData.detail || `Error ${backendResponse.status}`;
          } catch (parseError) {
            errorDetail = responseText;
          }
        } else {
          errorDetail = `Backend returned ${backendResponse.status} with no content`;
        }
      } catch (e) {
        errorDetail = `Error ${backendResponse.status}`;
      }

      console.error("Error detail:", errorDetail);
      return NextResponse.json(
        { detail: errorDetail },
        { status: backendResponse.status }
      );
    }

    // Handle successful response
    try {
      const responseText = await backendResponse.text();
      console.log(
        "Success response preview:",
        responseText.substring(0, 200) + "..."
      );

      if (!responseText || !responseText.trim()) {
        return NextResponse.json({
          success: true,
          message: "Request was successful but returned no data",
        });
      }

      const data = JSON.parse(responseText);
      return NextResponse.json(data);
    } catch (parseError) {
      console.error("Error parsing successful response:", parseError);
      return NextResponse.json(
        { detail: "The server returned an invalid response format" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Stage 3 processing error:", error);
    return NextResponse.json(
      { detail: "An error occurred while processing stage 3" },
      { status: 500 }
    );
  }
}
