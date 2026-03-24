"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { Loader2, ArrowLeft, RotateCcw, FileText } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useModel } from "@/context/ModelContext";
import ModelSelector from "@/components/ModelSelector";
import WorkflowProgress from "@/components/WorkflowProgress";
import StageReportButton from "@/components/StageReportButton";
import IterationHistory from "@/components/IterationHistory";

interface ProductIdea {
  id: string;
  idea: string;
  detailed_explanation: string;
  problem_id: string;
  image_url?: string;
}

function EvaluateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { model } = useModel();
  const projectIdFromUrl = searchParams.get("projectId");
  const projectId = projectIdFromUrl || (typeof window !== "undefined" ? localStorage.getItem("currentProjectId") : null);
  const solutionId = searchParams.get("solutionId");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chosenSolution, setChosenSolution] = useState<ProductIdea | null>(null);
  const [allIdeas, setAllIdeas] = useState<ProductIdea[]>([]);
  const [feedbackText, setFeedbackText] = useState("");
  const [evaluationNotes, setEvaluationNotes] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackLoopInProgress, setFeedbackLoopInProgress] = useState(false);
  const [feedbackLoopProgress, setFeedbackLoopProgress] = useState<string>("");
  const [currentIteration, setCurrentIteration] = useState(1);

  useEffect(() => {
    if (!projectId) {
      setError("No project ID provided.");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get project data for iteration info
        const projectResponse = await fetch(`/api/projects/${projectId}`);
        if (projectResponse.ok) {
          const projectData = await projectResponse.json();
          setCurrentIteration(projectData.current_iteration || 1);
        }

        // Get ideas from stage 4
        const ideasResponse = await fetch(`/api/projects/${projectId}/stages/4`);
        if (ideasResponse.ok) {
          const ideasData = await ideasResponse.json();
          const ideas = ideasData?.data?.product_ideas || [];
          setAllIdeas(ideas);

          // Find the chosen solution
          if (solutionId) {
            const chosen = ideas.find((i: ProductIdea) => i.id === solutionId);
            if (chosen) setChosenSolution(chosen);
          }
          if (!chosenSolution && ideas.length > 0) {
            setChosenSolution(ideas[0]);
          }
        }

        // Check if stage 5 already has data
        const stage5Response = await fetch(`/api/projects/${projectId}/stages/5`);
        if (stage5Response.ok) {
          const stage5Data = await stage5Response.json();
          if (stage5Data?.data?.evaluation_notes) {
            setEvaluationNotes(stage5Data.data.evaluation_notes);
          }
          if (stage5Data?.data?.chosen_solution) {
            setChosenSolution(stage5Data.data.chosen_solution);
          }
        }
      } catch (err) {
        setError((err as Error).message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId, solutionId]);

  const handleSubmitAndIterate = async () => {
    if (!projectId || !feedbackText.trim()) {
      setError("Please enter feedback before iterating.");
      return;
    }

    setFeedbackLoopInProgress(true);
    setFeedbackLoopProgress("Starting feedback loop...");
    setError(null);

    try {
      // First, save the feedback to stage 5
      await fetch(`/api/projects/${projectId}/stages/5/submit-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_entries: [{ feedback_text: feedbackText, timestamp: new Date().toISOString() }],
          evaluation_notes: evaluationNotes,
          chosen_solution_id: chosenSolution?.id,
        }),
      });

      // Trigger the feedback loop (SSE stream)
      const response = await fetch(`/api/projects/${projectId}/feedback-loop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Model-Type": model,
        },
        body: JSON.stringify({ feedback_text: feedbackText }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to start feedback loop");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Streaming not supported");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === "progress") {
                setFeedbackLoopProgress(data.message || "Processing...");
              } else if (eventType === "done") {
                setFeedbackLoopProgress("Complete! Redirecting...");
                setTimeout(() => {
                  router.push(`/workflow/understand?projectId=${projectId}`);
                }, 1500);
                return;
              } else if (eventType === "error") {
                throw new Error(data.message || "Feedback loop failed");
              }
            } catch (parseErr) {
              if (eventType === "error") throw parseErr;
            }
          }
        }
      }
    } catch (err) {
      setError((err as Error).message || "Feedback loop failed");
      setFeedbackLoopInProgress(false);
    }
  };

  const handleFinalize = async () => {
    if (!projectId || !chosenSolution) {
      setError("Please select a solution first.");
      return;
    }

    setIsSubmittingFeedback(true);
    setError(null);

    try {
      // Save stage 5 with chosen solution
      await fetch(`/api/projects/${projectId}/stages/5/submit-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluation_notes: evaluationNotes,
          chosen_solution_id: chosenSolution.id,
        }),
      });

      router.push(`/workflow/report?projectId=${projectId}&solutionId=${chosenSolution.id}`);
    } catch (err) {
      setError((err as Error).message || "Failed to finalize");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
        <p className="text-lg">Loading evaluation...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 flex flex-col max-w-6xl mx-auto">
      {/* Feedback loop overlay */}
      {feedbackLoopInProgress && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-6" />
            <h3 className="text-xl font-semibold mb-2">Feedback Loop in Progress</h3>
            <p className="text-gray-600 mb-4">{feedbackLoopProgress}</p>
            <p className="text-sm text-gray-400">
              Re-running Understand, Analysis, and Ideate stages with your feedback...
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center space-y-4 mb-12">
        <h1 className="text-4xl md:text-6xl font-bold">Innovation Workflow</h1>
        <WorkflowProgress
          currentStep={5}
          projectId={projectId}
          iterationNumber={currentIteration}
        />
      </div>

      <div className="space-y-10">
        <div className="flex items-center justify-between">
          <h2 className="text-4xl font-bold">Evaluate</h2>
          <div className="flex items-center gap-3">
            <StageReportButton
              projectId={projectId || ""}
              stageNumber={5}
              stageName="Evaluate"
              disabled={!chosenSolution}
            />
            <ModelSelector />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Chosen Solution Summary */}
        {chosenSolution && (
          <div className="bg-blue-50 p-6 rounded-xl space-y-3">
            <h3 className="text-2xl font-semibold">Selected Solution</h3>
            <p className="text-xl font-medium">{chosenSolution.idea}</p>
            {chosenSolution.image_url && (
              <img
                src={chosenSolution.image_url}
                alt={chosenSolution.idea}
                className="w-full max-w-lg h-auto rounded-lg"
                style={{ aspectRatio: "16/9" }}
              />
            )}
            <p className="text-gray-700">{chosenSolution.detailed_explanation?.substring(0, 300)}...</p>
          </div>
        )}

        {/* All Ideas Summary */}
        {allIdeas.length > 1 && (
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">Change Selection</h3>
            <div className="space-y-2">
              {allIdeas.map((idea) => (
                <button
                  key={idea.id}
                  onClick={() => setChosenSolution(idea)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    chosenSolution?.id === idea.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <span className="font-medium">{idea.idea}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Evaluation Notes */}
        <div className="space-y-3">
          <h3 className="text-2xl font-semibold">Evaluation Notes</h3>
          <textarea
            value={evaluationNotes}
            onChange={(e) => setEvaluationNotes(e.target.value)}
            placeholder="Add any evaluation notes about the current iteration..."
            className="w-full h-32 p-4 border rounded-lg resize-none"
          />
        </div>

        {/* Feedback for Iteration */}
        <div className="space-y-3">
          <h3 className="text-2xl font-semibold">Feedback for Next Iteration</h3>
          <p className="text-gray-600">
            Enter feedback to improve the analysis and ideas. This will re-run stages 2-4 with your feedback.
          </p>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="What would you like to improve? Be specific about what should change in the analysis, problems, or ideas..."
            className="w-full h-40 p-4 border rounded-lg resize-none"
          />
        </div>

        {/* Iteration History */}
        <IterationHistory projectId={projectId || ""} currentIteration={currentIteration} />

        {/* Actions */}
        <div className="flex flex-wrap gap-4 pt-4">
          <button
            onClick={() => router.push(`/workflow/ideate?projectId=${projectId}`)}
            className="bg-black text-white px-8 py-3 rounded-[10px] text-lg font-medium
                     hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Ideate
          </button>

          <button
            onClick={handleSubmitAndIterate}
            disabled={!feedbackText.trim() || feedbackLoopInProgress || isSubmittingFeedback}
            className={`bg-gray-800 text-white px-8 py-3 rounded-[10px] text-lg font-medium
                     hover:opacity-90 transition-opacity inline-flex items-center gap-2
                     ${!feedbackText.trim() || feedbackLoopInProgress ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <RotateCcw className="w-4 h-4" />
            Submit Feedback & Re-iterate
          </button>

          <button
            onClick={handleFinalize}
            disabled={!chosenSolution || isSubmittingFeedback || feedbackLoopInProgress}
            className={`bg-[#001DFA] text-white px-8 py-3 rounded-[10px] text-lg font-medium
                     hover:opacity-90 transition-opacity inline-flex items-center gap-2
                     ${!chosenSolution || isSubmittingFeedback ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isSubmittingFeedback ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Finalizing...</>
            ) : (
              <><FileText className="w-4 h-4" /> Finalize & Generate Report</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EvaluatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <EvaluateContent />
    </Suspense>
  );
}
