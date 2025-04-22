"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Download, ArrowLeft, AlertCircle } from "lucide-react";
import jsPDF from "jspdf";

interface ReportData {
  title: string;
  analysis: string;
  chosen_problem: {
    statement: string;
    explanation: string;
  };
  chosen_solution: {
    idea: string;
    explanation: string;
  };
}

export default function ReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const solutionId = searchParams.get("solutionId");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    if (!projectId || !solutionId) {
      setError("Missing project ID or solution ID");
      setLoading(false);
      return;
    }

    const generateReport = async () => {
      try {
        setGeneratingReport(true);

        // Generate Stage 4 data with the chosen solution
        const generateResponse = await fetch(
          `/api/projects/${projectId}/stages/4/generate?solutionId=${solutionId}`,
          { method: "POST" }
        );

        if (!generateResponse.ok) {
          const errorData = await generateResponse.json();
          throw new Error(errorData.detail || "Failed to generate report");
        }

        // Wait for a moment to ensure backend processing is complete
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Fetch the formatted report data from our new endpoint
        const response = await fetch(`/api/projects/${projectId}/report`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Failed to fetch report");
        }

        const data = await response.json();
        console.log("Report data:", data);
        setReportData(data);
      } catch (err) {
        console.error("Error generating report:", err);
        setError((err as Error).message || "Failed to generate report");
      } finally {
        setGeneratingReport(false);
        setLoading(false);
      }
    };

    generateReport();
  }, [projectId, solutionId]);

  // Reset download status messages after 5 seconds
  useEffect(() => {
    if (downloadSuccess || downloadError) {
      const timer = setTimeout(() => {
        setDownloadSuccess(false);
        setDownloadError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [downloadSuccess, downloadError]);

  const handleDownload = async () => {
    if (!projectId || !reportData) return;

    try {
      // Reset any previous download status
      setDownloadError(null);
      setDownloadSuccess(false);
      setDownloadingPdf(true);

      // Create a new PDF document (A4 format)
      const pdf = new jsPDF();

      // Set font size and add title
      pdf.setFontSize(20);
      pdf.text(reportData.title, 20, 20);

      pdf.setFontSize(12);
      pdf.text(
        `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
        20,
        30
      );
      pdf.text(`Project ID: ${projectId}`, 20, 38);

      // Add Research Analysis section
      pdf.setFontSize(16);
      pdf.text("RESEARCH ANALYSIS", 20, 50);
      pdf.setFontSize(10);

      // Handle long text by splitting into multiple lines
      const analysisLines = pdf.splitTextToSize(reportData.analysis, 170);
      pdf.text(analysisLines, 20, 60);

      // Calculate Y position for next section based on number of lines
      let yPos = 65 + analysisLines.length * 5;

      // Add Problem section
      pdf.setFontSize(16);
      pdf.text("IDENTIFIED PROBLEM", 20, yPos);
      pdf.setFontSize(12);
      yPos += 10;

      const problemLines = pdf.splitTextToSize(
        reportData.chosen_problem.statement,
        170
      );
      pdf.text(problemLines, 20, yPos);
      yPos += problemLines.length * 7;

      const problemExplanationLines = pdf.splitTextToSize(
        reportData.chosen_problem.explanation,
        170
      );
      pdf.text(problemExplanationLines, 20, yPos);
      yPos += problemExplanationLines.length * 7 + 10;

      // Add a new page if we're running out of space
      if (yPos > 250) {
        pdf.addPage();
        yPos = 20;
      }

      // Add Solution section
      pdf.setFontSize(16);
      pdf.text("CHOSEN SOLUTION", 20, yPos);
      pdf.setFontSize(12);
      yPos += 10;

      const solutionLines = pdf.splitTextToSize(
        reportData.chosen_solution.idea,
        170
      );
      pdf.text(solutionLines, 20, yPos);
      yPos += solutionLines.length * 7;

      const solutionExplanationLines = pdf.splitTextToSize(
        reportData.chosen_solution.explanation,
        170
      );
      pdf.text(solutionExplanationLines, 20, yPos);

      // Save the PDF
      pdf.save(`innovation_report_${projectId}.pdf`);

      setDownloadSuccess(true);
    } catch (err) {
      console.error("Error creating PDF report:", err);
      setDownloadError((err as Error).message || "Failed to create PDF report");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Empty or loading state content
  if (loading || generatingReport) {
    return (
      <div className="min-h-screen p-6 flex flex-col max-w-6xl mx-auto">
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl md:text-6xl font-bold">
            Innovation Workflow
          </h1>
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

        <div className="flex-1 flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
          <p className="text-xl">
            {generatingReport ? "Generating report..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  // Error state content
  if (error) {
    return (
      <div className="min-h-screen p-6 flex flex-col max-w-6xl mx-auto">
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl md:text-6xl font-bold">
            Innovation Workflow
          </h1>
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

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-lg max-w-3xl mx-auto">
            <h3 className="text-xl font-medium mb-2">Error</h3>
            <p>{error}</p>
            <button
              onClick={() => router.back()}
              className="mt-4 inline-flex items-center text-sm font-medium text-red-700 hover:text-red-800"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (!reportData) {
    return (
      <div className="min-h-screen p-6 flex flex-col max-w-6xl mx-auto">
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl md:text-6xl font-bold">
            Innovation Workflow
          </h1>
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

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-xl mb-4">No report data available.</p>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to Ideas
          </button>
        </div>
      </div>
    );
  }

  // Main content with report data
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
                ${step === 4 ? "bg-[#001DFA]" : "bg-black"}
                cursor-pointer hover:opacity-80 transition-opacity`}
                onClick={() => {
                  if (step === 1) {
                    router.push(`/workflow/upload?projectId=${projectId}`);
                  } else if (step === 2) {
                    router.push(`/workflow/problem?projectId=${projectId}`);
                  } else if (step === 3) {
                    router.push(`/workflow/ideas?projectId=${projectId}`);
                  } else if (step === 4) {
                    // Current page (report)
                    return;
                  }
                }}
              >
                {step}
              </div>
              {step < 4 && <div className="w-12 h-0.5 bg-black" />}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col space-y-10">
        <div className="space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-3xl font-bold">{reportData.title}</h2>

          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">Research Analysis</h3>
            <p className="text-gray-700 whitespace-pre-line">
              {reportData.analysis}
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">Identified Problem</h3>
            <div className="bg-gray-50 p-6 rounded-xl">
              <h4 className="text-xl font-medium mb-2">
                {reportData.chosen_problem.statement}
              </h4>
              <p className="text-gray-700">
                {reportData.chosen_problem.explanation}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">Chosen Solution</h3>
            <div className="bg-blue-50 p-6 rounded-xl">
              <h4 className="text-xl font-medium mb-2">
                {reportData.chosen_solution.idea}
              </h4>
              <p className="text-gray-700">
                {reportData.chosen_solution.explanation}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center space-y-4">
          {/* Download Button */}
          <button
            onClick={handleDownload}
            disabled={downloadingPdf}
            className="bg-[#001DFA] text-white text-xl font-medium px-10 py-4 rounded-xl
                     hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            {downloadingPdf ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Download Report
              </>
            )}
          </button>

          {/* Download Error Message */}
          {downloadError && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg border border-red-200 max-w-md text-center">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{downloadError}</span>
            </div>
          )}

          {/* Download Success Message */}
          {downloadSuccess && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg border border-green-200 max-w-md text-center">
              <span>Report downloaded successfully!</span>
            </div>
          )}
        </div>

        <div className="flex justify-center">
          <button
            onClick={() =>
              router.push(`/workflow/ideas?projectId=${projectId}`)
            }
            className="text-gray-600 hover:text-gray-800 inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Ideas
          </button>
        </div>
      </div>
    </div>
  );
}
