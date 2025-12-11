"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
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
    image_url?: string;
  };
}

function ReportContent() {
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

  // Helper function to parse markdown-style bolding
  const parseBoldMarkdown = (text: string) => {
    if (!text) return "";
    return text
      .replace(/\*\*(.*?)\*\*:/g, "<br/><strong>$1:</strong>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br/>")
      .replace(/^<br\/>/, "");
  };

  useEffect(() => {
    if (!projectId) {
      setError("Missing project ID");
      setLoading(false);
      return;
    }

    const generateReport = async () => {
      try {
        setGeneratingReport(true);

        // If we have a solutionId, generate the report using it
        if (solutionId) {
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
        } else {
          // If we don't have a solutionId, check if stage 4 already exists
          const stageResponse = await fetch(
            `/api/projects/${projectId}/stages/4`
          );

          if (!stageResponse.ok) {
            // Stage 4 doesn't exist and we don't have a solutionId
            throw new Error("Missing solution ID and no existing report found");
          }

          console.log("Stage 4 exists, proceeding to fetch report data");
        }

        // Fetch the formatted report data from our endpoint
        const response = await fetch(`/api/projects/${projectId}/report`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Failed to fetch report");
        }

        const data = await response.json();
        console.log("Report data:", data);
        setReportData(data);

        // Auto-save progress once report data is loaded
        await autoSaveProgress(data);
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

  // Function to auto-save progress
  const autoSaveProgress = async (reportData: ReportData) => {
    try {
      console.log("Starting auto-save with data:", reportData);

      // Make API call to save progress
      const saveResponse = await fetch(
        `/api/projects/${projectId}/save-progress`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stage: 4,
            data: {
              analysis: reportData.analysis,
              // Format chosen problem to match the expected structure in project/[id]/page.tsx
              chosen_problem: {
                id: "chosen-problem-id",
                problem: reportData.chosen_problem.statement,
                explanation: reportData.chosen_problem.explanation,
              },
              // Format chosen solution to match the expected structure in project/[id]/page.tsx
              chosen_solution: {
                id: solutionId || "chosen-solution-id",
                idea: reportData.chosen_solution.idea,
                detailed_explanation: reportData.chosen_solution.explanation,
                problem_id: "chosen-problem-id",
              },
            },
            completed: true,
          }),
        }
      );

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        console.error("Error auto-saving progress:", errorData);
      } else {
        const savedData = await saveResponse.json();
        console.log("Progress auto-saved successfully:", savedData);

        // Also update the project status to completed
        await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "completed",
          }),
        });
      }
    } catch (err) {
      console.error("Error in auto-save:", err);
    }
  };

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

  // Helper function to render text with markdown bolding in the PDF, handling line wrapping
  const renderFormattedText = (
    pdf: jsPDF,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ) => {
    const segments = text.split(/(\*\*.*?\*\*)/g).filter(Boolean);
    let currentY = y;

    // Use a simplified approach: render paragraph line by line
    const lines = pdf.splitTextToSize(text.replace(/\*\*/g, ""), maxWidth);

    lines.forEach((line: string) => {
      pdf.text(line, x, currentY);
      currentY += lineHeight;
    });

    return currentY;
  };

  const handleDownload = async () => {
    if (!projectId || !reportData) return;

    try {
      // Reset any previous download status
      setDownloadError(null);
      setDownloadSuccess(false);
      setDownloadingPdf(true);

      // Create a new PDF document (A4 format)
      const pdf = new jsPDF();
      const pageHeight = 280; // A4 height minus margins
      const marginTop = 20;
      const marginLeft = 20;
      const maxWidth = 170;

      // Helper function to check page break and add new page if needed
      const checkPageBreak = (
        currentY: number,
        neededSpace: number
      ): number => {
        if (currentY + neededSpace > pageHeight) {
          pdf.addPage();
          return marginTop;
        }
        return currentY;
      };

      // Helper function to add text with automatic page breaks
      const addTextWithPageBreak = (
        lines: string[],
        startY: number,
        lineHeight: number,
        fontSize: number
      ): number => {
        let y = startY;
        pdf.setFontSize(fontSize);

        for (const line of lines) {
          y = checkPageBreak(y, lineHeight);
          pdf.text(line, marginLeft, y);
          y += lineHeight;
        }
        return y;
      };

      let yPos = marginTop;

      // Title
      pdf.setFontSize(20);
      const titleLines = pdf.splitTextToSize(reportData.title, maxWidth);
      yPos = addTextWithPageBreak(titleLines, yPos, 8, 20);
      yPos += 5;

      // Generated date and Project ID
      pdf.setFontSize(12);
      yPos = checkPageBreak(yPos, 20);
      pdf.text(
        `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
        marginLeft,
        yPos
      );
      yPos += 8;
      pdf.text(`Project ID: ${projectId}`, marginLeft, yPos);
      yPos += 15;

      // Research Analysis Section
      yPos = checkPageBreak(yPos, 20);
      pdf.setFontSize(16);
      pdf.text("RESEARCH ANALYSIS", marginLeft, yPos);
      yPos += 10;

      pdf.setFontSize(10);
      const analysisLines = pdf.splitTextToSize(reportData.analysis, maxWidth);
      yPos = addTextWithPageBreak(analysisLines, yPos, 5, 10);
      yPos += 15;

      // Identified Problem Section
      yPos = checkPageBreak(yPos, 25);
      pdf.setFontSize(16);
      pdf.text("IDENTIFIED PROBLEM", marginLeft, yPos);
      yPos += 10;

      pdf.setFontSize(12);
      pdf.setFont(undefined, "bold");
      const problemStatementLines = pdf.splitTextToSize(
        reportData.chosen_problem.statement,
        maxWidth
      );
      yPos = addTextWithPageBreak(problemStatementLines, yPos, 6, 12);
      yPos += 5;

      pdf.setFont(undefined, "normal");
      pdf.setFontSize(10);
      const problemExplanationLines = pdf.splitTextToSize(
        reportData.chosen_problem.explanation.replace(/\*\*/g, ""),
        maxWidth
      );
      yPos = addTextWithPageBreak(problemExplanationLines, yPos, 5, 10);
      yPos += 15;

      // Chosen Solution Section
      yPos = checkPageBreak(yPos, 25);
      pdf.setFontSize(16);
      pdf.text("CHOSEN SOLUTION", marginLeft, yPos);
      yPos += 10;

      pdf.setFontSize(12);
      pdf.setFont(undefined, "bold");
      const solutionTitleLines = pdf.splitTextToSize(
        reportData.chosen_solution.idea,
        maxWidth
      );
      yPos = addTextWithPageBreak(solutionTitleLines, yPos, 6, 12);
      yPos += 5;

      pdf.setFont(undefined, "normal");
      pdf.setFontSize(10);
      const solutionExplanationLines = pdf.splitTextToSize(
        reportData.chosen_solution.explanation.replace(/\*\*/g, ""),
        maxWidth
      );
      yPos = addTextWithPageBreak(solutionExplanationLines, yPos, 5, 10);
      yPos += 10;

      // Fetch and add the image if a URL exists
      if (reportData.chosen_solution.image_url) {
        try {
          const imageResponse = await fetch(
            reportData.chosen_solution.image_url
          );
          if (!imageResponse.ok) {
            throw new Error("Failed to fetch image");
          }
          const imageBlob = await imageResponse.blob();

          const reader = new FileReader();
          await new Promise<void>((resolve, reject) => {
            reader.onloadend = () => {
              const base64data = reader.result as string;

              // Image dimensions
              const imgWidth = 170;
              const imgHeight = (imgWidth * 9) / 16; // 16:9 aspect ratio

              // Check if we need a new page for the image section
              yPos = checkPageBreak(yPos, imgHeight + 25);

              pdf.setFontSize(16);
              pdf.text("PRODUCT CONCEPT VISUALIZATION", marginLeft, yPos);
              yPos += 10;

              pdf.addImage(
                base64data,
                "PNG",
                marginLeft,
                yPos,
                imgWidth,
                imgHeight
              );

              resolve();
            };
            reader.onerror = reject;
            reader.readAsDataURL(imageBlob);
          });
        } catch (imgError) {
          console.error("Error adding image to PDF:", imgError);
        }
      }

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
      <div className="min-h-screen p-6 flex flex-col items-center justify-center">
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-lg max-w-md text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-bold mb-4">{error}</h2>
          <p className="mb-6">
            You need to select a solution idea before viewing the report.
          </p>
          <button
            onClick={() =>
              router.push(`/workflow/ideas?projectId=${projectId}`)
            }
            className="bg-black text-white px-6 py-2 rounded-md hover:bg-gray-800"
          >
            Go back
          </button>
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

        {/* Auto-save indicator */}
        <div className="text-sm text-gray-500 mt-2">
          Progress is automatically saved
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col space-y-10">
        <div className="space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <h2 className="text-3xl font-bold break-words">{reportData.title}</h2>

          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">Research Analysis</h3>
            <p className="text-gray-700 whitespace-pre-line break-words">
              {reportData.analysis}
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">Identified Problem</h3>
            <div className="bg-gray-50 p-6 rounded-xl">
              <h4 className="text-xl font-medium mb-2 break-words">
                {reportData.chosen_problem.statement}
              </h4>
              <p className="text-gray-700 break-words">
                {reportData.chosen_problem.explanation}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">Chosen Solution</h3>
            <div className="bg-blue-50 p-6 rounded-xl">
              <h4 className="text-xl font-medium mb-4 break-words">
                {reportData.chosen_solution.idea}
              </h4>

              {/* Product Concept Image */}
              {reportData.chosen_solution.image_url && (
                <div className="mb-6">
                  <h5 className="font-semibold text-gray-800 mb-3">
                    Product Concept Visualization
                  </h5>
                  <div className="relative rounded-lg overflow-hidden bg-white p-2">
                    <img
                      src={
                        // The image_url from backend is like "/api/images/{id}"
                        // We need to use this directly since Next.js will proxy it
                        reportData.chosen_solution.image_url
                      }
                      alt={`Concept visualization for ${reportData.chosen_solution.idea}`}
                      className="w-full max-w-3xl h-auto object-cover rounded-md mx-auto"
                      style={{ aspectRatio: "16/9" }}
                      onError={(e) => {
                        console.error(
                          "Image failed to load:",
                          reportData.chosen_solution.image_url
                        );
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                </div>
              )}

              <div>
                <h5 className="font-semibold text-gray-800 mb-2">
                  Solution Details
                </h5>
                <div
                  className="text-gray-700 leading-relaxed break-words"
                  dangerouslySetInnerHTML={{
                    __html: parseBoldMarkdown(
                      reportData.chosen_solution.explanation
                    ),
                  }}
                />
              </div>
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

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <ReportContent />
    </Suspense>
  );
}
