import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// This function fetches the complete project data and formats it for the report.
async function getFormattedReportData(projectId: string, accessToken: string) {
  const projectResponse = await fetch(`${API_URL}/api/projects/${projectId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!projectResponse.ok) {
    throw new Error("Failed to fetch project data");
  }

  const project = await projectResponse.json();

  // Extract data from each stage
  const stage1Data = project.stages.find(
    (s: any) => s.stage_number === 1
  )?.data;
  const stage2Data = project.stages.find(
    (s: any) => s.stage_number === 2
  )?.data;
  const stage4Data = project.stages.find(
    (s: any) => s.stage_number === 4
  )?.data;

  if (
    !stage1Data ||
    !stage2Data ||
    !stage4Data ||
    !stage4Data.chosen_solution
  ) {
    throw new Error("Required project data is missing to generate a report");
  }

  // Find the chosen problem statement from stage 2
  const chosenProblem = stage2Data.problem_statements.find(
    (p: any) => p.id === stage4Data.chosen_solution.problem_id
  );

  return {
    title: `Innovation Report for ${project.problem_domain}`,
    analysis: stage1Data.analysis,
    chosen_problem: {
      statement: chosenProblem?.problem || "Problem not found",
      explanation: chosenProblem?.explanation || "",
    },
    chosen_solution: {
      idea: stage4Data.chosen_solution.idea,
      explanation: stage4Data.chosen_solution.detailed_explanation,
      image_url: stage4Data.chosen_solution.image_url, // Ensure image_url is included
    },
  };
}

export async function GET(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  const { projectId } = params;
  const accessToken = cookies().get("access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  try {
    const reportData = await getFormattedReportData(projectId, accessToken);
    return NextResponse.json(reportData);
  } catch (error) {
    console.error("Error fetching report data:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ detail: errorMessage }, { status: 500 });
  }
}
