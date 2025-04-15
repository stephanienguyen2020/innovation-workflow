"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuthHeaders } from "@/lib/auth";

export default function ReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId =
    searchParams.get("projectId") || localStorage.getItem("projectId");
  const solutionId = searchParams.get("solutionId");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    if (!projectId || !solutionId) {
      console.error("Missing projectId or solutionId");
      setError("Missing project ID or solution ID");
      setLoading(false);
      return;
    }

    console.log(`Project ID: ${projectId}, Solution ID: ${solutionId}`);

    // The backend expects a dictionary in the request body
    const stage_data = {
      evaluations: [
        {
          id: solutionId,
          selected: true,
        },
      ],
    };

    console.log("Sending data:", stage_data);

    // Make API call to get report data
    fetch(
      `${apiUrl}/api/projects/${projectId}/stages/4/generate?chosen_solution_id=${solutionId}`,
      {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(stage_data),
      }
    )
      .then(async (response) => {
        if (!response.ok) {
          console.error(
            `Error response: ${response.status} ${response.statusText}`
          );

          let errorDetail = "";
          try {
            const errorData = await response.json();
            errorDetail = errorData.detail || "";
          } catch (err) {
            // If we can't parse the JSON, just use the status text
          }

          throw new Error(
            `Failed to generate report: ${response.status} ${
              errorDetail ? ` - ${errorDetail}` : ""
            }`
          );
        }
        return response.json();
      })
      .then((data) => {
        console.log("Received data:", data);
        setReportData(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error generating report:", error);
        setError(error.message || "Failed to generate report");
        setLoading(false);
      });
  }, [projectId, solutionId, apiUrl]);

  const handleDownload = () => {
    if (!reportData) return;

    // Create blob for direct download
    const content = `
# ${reportData.title}

## Analysis
${reportData.analysis}

## Chosen Problem
### ${reportData.chosen_problem.statement}
${reportData.chosen_problem.explanation}

## Chosen Solution
### ${reportData.chosen_solution.idea}
${reportData.chosen_solution.explanation}
    `;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "innovation-report.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen p-6 flex flex-col max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-4 mb-12">
        <h1 className="text-4xl md:text-6xl font-bold">Innovation Workflow</h1>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-0 mt-6">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white
                ${step === 4 ? "bg-[#001DFA]" : "bg-black"}`}
              >
                {step}
              </div>
              {step < 4 && <div className="w-12 h-0.5 bg-black" />}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-3xl mx-auto space-y-8">
        <div className="space-y-2">
          <p className="text-3xl">
            Congrats on finishing the workflow here is a
          </p>
          <p className="text-3xl">
            <span className="font-bold">documentation</span> for your reference:
          </p>
        </div>

        {loading ? (
          <p>Generating your report...</p>
        ) : error ? (
          <div className="space-y-4">
            <p className="text-red-500">{error}</p>
            <button
              onClick={() => router.push("/workflow/ideas")}
              className="underline"
            >
              Back to Ideas
            </button>
          </div>
        ) : reportData ? (
          <div className="space-y-8">
            {/* Preview of the report as plain text */}
            <div className="mt-4 text-left border p-6 rounded-lg">
              <h2 className="text-2xl font-bold">{reportData.title}</h2>

              <h3 className="text-xl font-bold mt-4">Analysis</h3>
              <p className="mt-2">{reportData.analysis.substring(0, 200)}...</p>

              <h3 className="text-xl font-bold mt-4">Problem</h3>
              <h4 className="text-lg font-semibold">
                {reportData.chosen_problem.statement}
              </h4>
              <p className="mt-2">
                {reportData.chosen_problem.explanation.substring(0, 100)}...
              </p>

              <h3 className="text-xl font-bold mt-4">Solution</h3>
              <h4 className="text-lg font-semibold">
                {reportData.chosen_solution.idea}
              </h4>
              <p className="mt-2">
                {reportData.chosen_solution.explanation.substring(0, 100)}...
              </p>
            </div>

            <button
              onClick={handleDownload}
              className="bg-[#001DFA] text-white text-2xl font-medium px-12 py-6 rounded-2xl
                       hover:opacity-90 transition-opacity"
            >
              Download Report
            </button>

            {/* Back button */}
            <button
              onClick={() => router.push("/workflow/ideas")}
              className="block mt-4 underline"
            >
              Back to Ideas
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p>Failed to generate report. Please try again.</p>
            <button
              onClick={() => router.push("/workflow/ideas")}
              className="underline"
            >
              Back to Ideas
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
