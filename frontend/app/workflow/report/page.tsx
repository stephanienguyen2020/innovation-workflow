"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Download, ArrowLeft, AlertCircle } from "lucide-react";
import jsPDF from "jspdf";
import WorkflowProgress from "@/components/WorkflowProgress";

interface IterationEntry {
  iteration_number: number;
  feedback_text: string;
  chosen_solution?: {
    idea: string;
    explanation: string;
    image_url?: string;
  };
  all_ideas: Array<{ idea: string; id: string }>;
}

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
  iteration?: number;
  iteration_history?: IterationEntry[];
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

        if (solutionId) {
          // Use the new generate-report endpoint that sets chosen solution in stage 5
          const generateResponse = await fetch(
            `/api/projects/${projectId}/stages/4/generate-report?solutionId=${solutionId}`,
            { method: "POST" }
          );

          if (!generateResponse.ok) {
            const errorData = await generateResponse.json();
            throw new Error(errorData.detail || "Failed to generate report");
          }

          const data = await generateResponse.json();
          setReportData(data);
        } else {
          // Try to get comprehensive report directly
          const response = await fetch(`/api/projects/${projectId}/comprehensive-report`);
          if (!response.ok) {
            // Fallback to the old report endpoint
            const fallbackResponse = await fetch(`/api/projects/${projectId}/report`);
            if (!fallbackResponse.ok) {
              throw new Error("Missing solution ID and no existing report found");
            }
            const data = await fallbackResponse.json();
            setReportData(data);
          } else {
            const data = await response.json();
            setReportData(data);
          }
        }
      } catch (err) {
        setError((err as Error).message || "Failed to generate report");
      } finally {
        setGeneratingReport(false);
        setLoading(false);
      }
    };

    generateReport();
  }, [projectId, solutionId]);

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
      setDownloadError(null);
      setDownloadSuccess(false);
      setDownloadingPdf(true);

      const pdf = new jsPDF();
      const pageHeight = 280;
      const marginTop = 20;
      const marginLeft = 20;
      const maxWidth = 170;

      const checkPageBreak = (currentY: number, neededSpace: number): number => {
        if (currentY + neededSpace > pageHeight) {
          pdf.addPage();
          return marginTop;
        }
        return currentY;
      };

      const addTextWithPageBreak = (lines: string[], startY: number, lineHeight: number, fontSize: number): number => {
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

      pdf.setFontSize(12);
      yPos = checkPageBreak(yPos, 20);
      pdf.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, marginLeft, yPos);
      yPos += 8;
      pdf.text(`Project ID: ${projectId}`, marginLeft, yPos);
      yPos += 8;
      if (reportData.iteration && reportData.iteration > 1) {
        pdf.text(`Iteration: ${reportData.iteration}`, marginLeft, yPos);
        yPos += 8;
      }
      yPos += 10;

      // Research Analysis
      yPos = checkPageBreak(yPos, 20);
      pdf.setFontSize(16);
      pdf.text("RESEARCH ANALYSIS", marginLeft, yPos);
      yPos += 10;
      pdf.setFontSize(10);
      const analysisLines = pdf.splitTextToSize(reportData.analysis, maxWidth);
      yPos = addTextWithPageBreak(analysisLines, yPos, 5, 10);
      yPos += 15;

      // Identified Problem
      yPos = checkPageBreak(yPos, 25);
      pdf.setFontSize(16);
      pdf.text("IDENTIFIED PROBLEM", marginLeft, yPos);
      yPos += 10;
      pdf.setFontSize(12);
      pdf.setFont(undefined, "bold");
      const problemLines = pdf.splitTextToSize(reportData.chosen_problem.statement, maxWidth);
      yPos = addTextWithPageBreak(problemLines, yPos, 6, 12);
      yPos += 5;
      pdf.setFont(undefined, "normal");
      pdf.setFontSize(10);
      const problemExpl = pdf.splitTextToSize(reportData.chosen_problem.explanation.replace(/\*\*/g, ""), maxWidth);
      yPos = addTextWithPageBreak(problemExpl, yPos, 5, 10);
      yPos += 15;

      // Chosen Solution
      yPos = checkPageBreak(yPos, 25);
      pdf.setFontSize(16);
      pdf.text("CHOSEN SOLUTION", marginLeft, yPos);
      yPos += 10;
      pdf.setFontSize(12);
      pdf.setFont(undefined, "bold");
      const solLines = pdf.splitTextToSize(reportData.chosen_solution.idea, maxWidth);
      yPos = addTextWithPageBreak(solLines, yPos, 6, 12);
      yPos += 5;
      pdf.setFont(undefined, "normal");
      pdf.setFontSize(10);
      const solExpl = pdf.splitTextToSize(reportData.chosen_solution.explanation.replace(/\*\*/g, ""), maxWidth);
      yPos = addTextWithPageBreak(solExpl, yPos, 5, 10);
      yPos += 10;

      // Image
      if (reportData.chosen_solution.image_url) {
        try {
          const imageResponse = await fetch(reportData.chosen_solution.image_url);
          if (imageResponse.ok) {
            const imageBlob = await imageResponse.blob();
            const reader = new FileReader();
            await new Promise<void>((resolve, reject) => {
              reader.onloadend = () => {
                const base64data = reader.result as string;
                const imgWidth = 170;
                const imgHeight = (imgWidth * 9) / 16;
                yPos = checkPageBreak(yPos, imgHeight + 25);
                pdf.setFontSize(16);
                pdf.text("PRODUCT CONCEPT VISUALIZATION", marginLeft, yPos);
                yPos += 10;
                pdf.addImage(base64data, "PNG", marginLeft, yPos, imgWidth, imgHeight);
                resolve();
              };
              reader.onerror = reject;
              reader.readAsDataURL(imageBlob);
            });
          }
        } catch {}
      }

      // Iteration History
      if (reportData.iteration_history && reportData.iteration_history.length > 0) {
        yPos += 15;
        yPos = checkPageBreak(yPos, 20);
        pdf.setFontSize(16);
        pdf.text("ITERATION HISTORY", marginLeft, yPos);
        yPos += 10;

        for (const entry of reportData.iteration_history) {
          yPos = checkPageBreak(yPos, 30);
          pdf.setFontSize(12);
          pdf.setFont(undefined as unknown as string, "bold");
          pdf.text(`Iteration ${entry.iteration_number}`, marginLeft, yPos);
          yPos += 7;

          if (entry.chosen_solution) {
            pdf.setFontSize(10);
            pdf.setFont(undefined as unknown as string, "normal");
            const selectedLines = pdf.splitTextToSize(`Selected: ${entry.chosen_solution.idea}`, maxWidth);
            yPos = addTextWithPageBreak(selectedLines, yPos, 5, 10);
            yPos += 3;
          }

          if (entry.all_ideas.length > 0) {
            pdf.setFontSize(9);
            pdf.setFont(undefined as unknown as string, "normal");
            for (const idea of entry.all_ideas) {
              yPos = checkPageBreak(yPos, 6);
              const prefix = entry.chosen_solution && idea.idea === entry.chosen_solution.idea ? "* " : "- ";
              const ideaLines = pdf.splitTextToSize(`${prefix}${idea.idea}`, maxWidth - 5);
              yPos = addTextWithPageBreak(ideaLines, yPos, 4.5, 9);
            }
            yPos += 3;
          }

          pdf.setFontSize(10);
          const feedbackLines = pdf.splitTextToSize(`Feedback: ${entry.feedback_text}`, maxWidth);
          yPos = addTextWithPageBreak(feedbackLines, yPos, 5, 10);
          yPos += 10;
        }
      }

      pdf.save(`innovation_report_${projectId}.pdf`);
      setDownloadSuccess(true);
    } catch (err) {
      setDownloadError((err as Error).message || "Failed to create PDF report");
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading || generatingReport) {
    return (
      <div className="min-h-screen p-6 flex flex-col max-w-6xl mx-auto">
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl md:text-6xl font-bold">Innovation Workflow</h1>
          <WorkflowProgress currentStep={5} projectId={projectId} />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
          <p className="text-xl">{generatingReport ? "Generating report..." : "Loading..."}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center">
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-lg max-w-md text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-bold mb-4">{error}</h2>
          <p className="mb-6">You need to select a solution idea before viewing the report.</p>
          <button
            onClick={() => router.push(`/workflow/evaluate?projectId=${projectId}`)}
            className="bg-black text-white px-6 py-2 rounded-md hover:bg-gray-800"
          >
            Go to Evaluate
          </button>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="min-h-screen p-6 flex flex-col max-w-6xl mx-auto">
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl md:text-6xl font-bold">Innovation Workflow</h1>
          <WorkflowProgress currentStep={5} projectId={projectId} />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-xl mb-4">No report data available.</p>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to Evaluate
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 flex flex-col max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-4 mb-12">
        <h1 className="text-4xl md:text-6xl font-bold">Innovation Workflow</h1>
        <WorkflowProgress currentStep={5} projectId={projectId} />
        <div className="text-sm text-gray-500 mt-2">
          {reportData.iteration && reportData.iteration > 1
            ? `Iteration ${reportData.iteration} - Progress is automatically saved`
            : "Progress is automatically saved"}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col space-y-10">
        <div className="space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <h2 className="text-3xl font-bold break-words">{reportData.title}</h2>

          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">Research Analysis</h3>
            <p className="text-gray-700 whitespace-pre-line break-words">{reportData.analysis}</p>
          </div>

          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">Identified Problem</h3>
            <div className="bg-gray-50 p-6 rounded-xl">
              <h4 className="text-xl font-medium mb-2 break-words">{reportData.chosen_problem.statement}</h4>
              <p className="text-gray-700 break-words">{reportData.chosen_problem.explanation}</p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">Chosen Solution</h3>
            <div className="bg-blue-50 p-6 rounded-xl">
              <h4 className="text-xl font-medium mb-4 break-words">{reportData.chosen_solution.idea}</h4>

              {reportData.chosen_solution.image_url && (
                <div className="mb-6">
                  <h5 className="font-semibold text-gray-800 mb-3">Product Concept Visualization</h5>
                  <div className="relative rounded-lg overflow-hidden bg-white p-2">
                    <img
                      src={reportData.chosen_solution.image_url}
                      alt={`Concept visualization for ${reportData.chosen_solution.idea}`}
                      className="w-full max-w-3xl h-auto object-cover rounded-md mx-auto"
                      style={{ aspectRatio: "16/9" }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                </div>
              )}

              <div>
                <h5 className="font-semibold text-gray-800 mb-2">Solution Details</h5>
                <div
                  className="text-gray-700 leading-relaxed break-words"
                  dangerouslySetInnerHTML={{ __html: parseBoldMarkdown(reportData.chosen_solution.explanation) }}
                />
              </div>
            </div>
          </div>

          {/* Iteration History */}
          {reportData.iteration_history && reportData.iteration_history.length > 0 && (
            <div className="space-y-5">
              <h3 className="text-2xl font-semibold">Design Process</h3>
              <div className="relative pl-8">
                {/* Timeline line */}
                <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-200" />

                <div className="space-y-8">
                  {/* Final solution — always on top */}
                  <div className="relative">
                    <div className="absolute -left-8 top-1 w-[22px] h-[22px] rounded-full bg-blue-600 border-2 border-blue-600 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">{reportData.iteration || 1}</span>
                    </div>
                    <p className="text-base font-medium text-blue-700">
                      {reportData.chosen_solution.idea}
                      <span className="ml-2 text-xs font-normal text-blue-500">Current</span>
                    </p>
                  </div>

                  {/* Past iterations — newest first */}
                  {[...reportData.iteration_history].reverse().map((entry) => (
                    <div key={entry.iteration_number} className="relative">
                      {/* Timeline dot */}
                      <div className="absolute -left-8 top-1 w-[22px] h-[22px] rounded-full bg-white border-2 border-gray-300 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-gray-500">{entry.iteration_number}</span>
                      </div>

                      <div className="space-y-3">
                        {/* Selected solution */}
                        {entry.chosen_solution && (
                          <p className="text-base font-medium text-gray-900">
                            {entry.chosen_solution.idea}
                          </p>
                        )}

                        {/* Other ideas considered — full names */}
                        {entry.all_ideas.filter((idea) => !entry.chosen_solution || idea.idea !== entry.chosen_solution.idea).length > 0 && (
                          <div className="text-sm text-gray-500 space-y-1">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Also considered</p>
                            {entry.all_ideas
                              .filter((idea) => !entry.chosen_solution || idea.idea !== entry.chosen_solution.idea)
                              .map((idea) => (
                                <p key={idea.id} className="text-gray-500">{idea.idea}</p>
                              ))}
                          </div>
                        )}

                        {/* Feedback */}
                        <div className="text-sm text-gray-600 border-l-2 border-gray-200 pl-4 italic">
                          {entry.feedback_text}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center space-y-4">
          <button
            onClick={handleDownload}
            disabled={downloadingPdf}
            className="bg-[#001DFA] text-white text-xl font-medium px-10 py-4 rounded-xl
                     hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            {downloadingPdf ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Downloading...</>
            ) : (
              <><Download className="w-5 h-5" /> Download Report</>
            )}
          </button>

          {downloadError && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg border border-red-200 max-w-md text-center">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{downloadError}</span>
            </div>
          )}

          {downloadSuccess && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg border border-green-200 max-w-md text-center">
              <span>Report downloaded successfully!</span>
            </div>
          )}
        </div>

        <div className="flex justify-center gap-4">
          <button
            onClick={() => router.push(`/workflow/evaluate?projectId=${projectId}`)}
            className="text-gray-600 hover:text-gray-800 inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Evaluate
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
