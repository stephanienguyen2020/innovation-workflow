import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Legacy report endpoint - now proxies to comprehensive-report
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const accessToken = (await cookies()).get("access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  try {
    // Try the new comprehensive-report endpoint first
    const apiUrl = `${API_URL}/api/projects/${projectId}/comprehensive-report`;
    const response = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    }

    // Fallback: build report from project data (old behavior)
    const projectResponse = await fetch(`${API_URL}/api/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!projectResponse.ok) {
      throw new Error("Failed to fetch project data");
    }

    const project = await projectResponse.json();

    const stage2Data = project.stages.find((s: any) => s.stage_number === 2)?.data;
    const stage3Data = project.stages.find((s: any) => s.stage_number === 3)?.data;
    const stage4Data = project.stages.find((s: any) => s.stage_number === 4)?.data;
    const stage5Data = project.stages.find((s: any) => s.stage_number === 5)?.data;

    // Find chosen solution (stage 5 first, then fallback to first idea in stage 4)
    let chosenSolution = stage5Data?.chosen_solution;
    if (!chosenSolution && stage4Data?.product_ideas?.length > 0) {
      chosenSolution = stage4Data.product_ideas[0];
    }

    if (!chosenSolution) {
      throw new Error("No chosen solution found");
    }

    // Find the problem
    const allProblems = [
      ...(stage3Data?.problem_statements || []),
      ...(stage3Data?.custom_problems || []),
    ];
    const chosenProblem = allProblems.find(
      (p: any) => p.id === chosenSolution.problem_id
    );

    return NextResponse.json({
      title: `Innovation Report for ${project.problem_domain}`,
      analysis: stage2Data?.analysis || "",
      chosen_problem: {
        statement: chosenProblem?.problem || "Problem not found",
        explanation: chosenProblem?.explanation || "",
      },
      chosen_solution: {
        idea: chosenSolution.idea,
        explanation: chosenSolution.detailed_explanation,
        image_url: chosenSolution.image_url,
      },
      iteration: project.current_iteration,
    });
  } catch (error) {
    console.error("Error fetching report data:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ detail: errorMessage }, { status: 500 });
  }
}
