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
    console.log(`Fetching report data for project ID: ${projectId}`);

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

    // Fetch stage 1 data (analysis)
    const stage1Response = await fetch(
      `${API_URL}/api/projects/${projectId}/stages/1`,
      {
        method: "GET",
        headers,
      }
    );

    if (!stage1Response.ok) {
      return NextResponse.json(
        { detail: "Failed to fetch analysis" },
        { status: stage1Response.status }
      );
    }

    const stage1Data = await stage1Response.json();
    const analysis = stage1Data.data?.analysis || "No analysis available";

    // Fetch stage 2 data (problem statements)
    const stage2Response = await fetch(
      `${API_URL}/api/projects/${projectId}/stages/2`,
      {
        method: "GET",
        headers,
      }
    );

    if (!stage2Response.ok) {
      return NextResponse.json(
        { detail: "Failed to fetch problem statements" },
        { status: stage2Response.status }
      );
    }

    const stage2Data = await stage2Response.json();
    const problemStatements = [
      ...(stage2Data.data?.problem_statements || []),
      ...(stage2Data.data?.custom_problems || []),
    ];

    // Fetch stage 4 data (chosen solution)
    const stage4Response = await fetch(
      `${API_URL}/api/projects/${projectId}/stages/4`,
      {
        method: "GET",
        headers,
      }
    );

    if (!stage4Response.ok) {
      return NextResponse.json(
        { detail: "Failed to fetch chosen solution" },
        { status: stage4Response.status }
      );
    }

    const stage4Data = await stage4Response.json();
    const chosenSolution = stage4Data.data?.chosen_solution;

    if (!chosenSolution) {
      return NextResponse.json(
        { detail: "No chosen solution found" },
        { status: 404 }
      );
    }

    // Find the chosen problem using the problem_id from the chosen solution
    const chosenProblem = problemStatements.find(
      (problem) => problem.id === chosenSolution.problem_id
    );

    if (!chosenProblem) {
      return NextResponse.json(
        { detail: "Chosen problem not found" },
        { status: 404 }
      );
    }

    // Format the data in the expected format for the report page
    const reportData = {
      title: "Innovation Workflow Analysis",
      analysis: analysis,
      chosen_problem: {
        statement: chosenProblem.problem,
        explanation: chosenProblem.explanation,
      },
      chosen_solution: {
        idea: chosenSolution.idea,
        explanation: chosenSolution.detailed_explanation,
      },
    };

    console.log("Formatted report data:", reportData);
    return NextResponse.json(reportData);
  } catch (error) {
    console.error("Report data fetch error:", error);
    return NextResponse.json(
      { detail: "An error occurred while fetching report data" },
      { status: 500 }
    );
  }
}
