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
    console.log(`Generating PDF for project ID: ${projectId}`);

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

    // Fetch the report data from our report endpoint
    const reportResponse = await fetch(
      `${request.nextUrl.origin}/api/projects/${projectId}/report`,
      { headers }
    );

    if (!reportResponse.ok) {
      throw new Error("Failed to fetch report data for PDF generation");
    }

    const reportData = await reportResponse.json();

    // Generate PDF content as a formatted string (for now)
    // In a real implementation, we would use a PDF generation library
    const pdfContent = `
Innovation Workflow Analysis

Generated on: ${new Date().toLocaleDateString()}

==============================
RESEARCH ANALYSIS
==============================
${reportData.analysis}

==============================
IDENTIFIED PROBLEM
==============================
${reportData.chosen_problem.statement}

${reportData.chosen_problem.explanation}

==============================
CHOSEN SOLUTION
==============================
${reportData.chosen_solution.idea}

${reportData.chosen_solution.explanation}
    `;

    // Return the content as a PDF (in a simple format for now)
    return new NextResponse(pdfContent, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="innovation_report_${projectId}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      {
        detail:
          (error as Error).message ||
          "An error occurred while generating the PDF",
      },
      { status: 500 }
    );
  }
}
