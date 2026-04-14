"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo, Suspense } from "react";
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

interface ProblemStatement {
  id: string;
  problem: string;
  explanation: string;
  is_custom?: boolean;
}

function stripMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`/g, "")
    .replace(/#/g, "")
    .trim();
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
  const [problemNotes, setProblemNotes] = useState("");
  const [solutionNotes, setSolutionNotes] = useState("");
  const [imageNotes, setImageNotes] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [currentIteration, setCurrentIteration] = useState(1);
  const [stage3Problems, setStage3Problems] = useState<ProblemStatement[]>([]);

  const chosenProblem = useMemo(() => {
    if (!chosenSolution?.problem_id || stage3Problems.length === 0) return null;
    return (
      stage3Problems.find((p) => p.id === chosenSolution.problem_id) ?? null
    );
  }, [chosenSolution, stage3Problems]);

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

        // Problems from stage 3 (for chosen-problem context on this page)
        const stage3Response = await fetch(`/api/projects/${projectId}/stages/3`);
        if (stage3Response.ok) {
          const stage3Data = await stage3Response.json();
          const data = stage3Data?.data;
          if (data) {
            setStage3Problems([
              ...(data.problem_statements || []),
              ...(data.custom_problems || []),
            ]);
          }
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
          if (stage5Data?.data?.problem_notes) {
            setProblemNotes(stage5Data.data.problem_notes);
          }
          if (stage5Data?.data?.solution_notes) {
            setSolutionNotes(stage5Data.data.solution_notes);
          }
          if (stage5Data?.data?.image_notes) {
            setImageNotes(stage5Data.data.image_notes);
          }
          if (stage5Data?.data?.evaluation_notes && !stage5Data?.data?.problem_notes) {
            setSolutionNotes(stage5Data.data.evaluation_notes);
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

  const combinedNotes = [
    problemNotes.trim() && `Problem: ${problemNotes.trim()}`,
    solutionNotes.trim() && `Solution: ${solutionNotes.trim()}`,
    imageNotes.trim() && `Image: ${imageNotes.trim()}`,
  ].filter(Boolean).join("\n\n");

  const hasAnyNotes = problemNotes.trim() || solutionNotes.trim() || imageNotes.trim();

  const handleSubmitAndIterate = async () => {
    if (!projectId || !hasAnyNotes) {
      setError("Please enter feedback in at least one field before iterating.");
      return;
    }

    if (!chosenSolution) {
      setError("Please select a solution to give feedback on.");
      return;
    }

    setIsSubmittingFeedback(true);
    setError(null);

    try {
      // Save the feedback + chosen solution to stage 5
      await fetch(`/api/projects/${projectId}/stages/5/submit-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_entries: [{ feedback_text: combinedNotes, timestamp: new Date().toISOString() }],
          evaluation_notes: combinedNotes,
          problem_notes: problemNotes.trim(),
          solution_notes: solutionNotes.trim(),
          image_notes: imageNotes.trim(),
          chosen_solution_id: chosenSolution.id,
        }),
      });

      // Save iteration snapshot with feedback type flags
      await fetch(`/api/projects/${projectId}/save-iteration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_text: combinedNotes,
          has_problem_feedback: !!problemNotes.trim(),
          has_solution_feedback: !!solutionNotes.trim(),
          has_image_feedback: !!imageNotes.trim(),
          problem_notes: problemNotes.trim(),
          solution_notes: solutionNotes.trim(),
          image_notes: imageNotes.trim(),
        }),
      });

      // Redirect immediately to research/understand page
      router.push(`/workflow/research?projectId=${projectId}`);
    } catch (err) {
      setError((err as Error).message || "Failed to save feedback");
      setIsSubmittingFeedback(false);
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
          evaluation_notes: combinedNotes,
          problem_notes: problemNotes.trim(),
          solution_notes: solutionNotes.trim(),
          image_notes: imageNotes.trim(),
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

        {chosenProblem && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Chosen problem
            </p>
            <p className="text-lg font-semibold text-gray-900 leading-snug">
              {chosenProblem.problem}
            </p>
            {chosenProblem.explanation?.trim() && (
              <p className="text-gray-600 text-base leading-relaxed">
                {chosenProblem.explanation}
              </p>
            )}
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
            <p className="text-gray-700 leading-relaxed">
              {stripMarkdown(chosenSolution.detailed_explanation)?.substring(0, 300)}...
            </p>
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
        <div className="space-y-5">
          <div>
            <h3 className="text-2xl font-semibold">Evaluation Notes</h3>
            <p className="text-gray-500 text-sm mt-1">
              Fill in the areas you'd like to evaluate. Leave any field blank to skip it.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-lg font-medium">Problem</label>
            <textarea
              value={problemNotes}
              onChange={(e) => setProblemNotes(e.target.value)}
              placeholder="Note: Feedback provided for the solution will be used to refine the chosen solution. New problems generated will be similar to previous problems created. If you want to reimagine the problem, it's best to start a new workflow."
              className="w-full h-28 p-4 border rounded-lg resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-lg font-medium">Solution</label>
            <textarea
              value={solutionNotes}
              onChange={(e) => setSolutionNotes(e.target.value)}
              placeholder="Any feedback on the proposed solution..."
              className="w-full h-28 p-4 border rounded-lg resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-lg font-medium">Image</label>
            <textarea
              value={imageNotes}
              onChange={(e) => setImageNotes(e.target.value)}
              placeholder="Any feedback on the generated image or visual concept..."
              className="w-full h-28 p-4 border rounded-lg resize-none"
            />
          </div>
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
            disabled={!hasAnyNotes || isSubmittingFeedback}
            className={`text-white px-8 py-3 rounded-[10px] text-lg font-medium
                     hover:opacity-90 transition-opacity inline-flex items-center gap-2
                     ${hasAnyNotes && !isSubmittingFeedback ? "bg-[#001DFA]" : "bg-gray-500 opacity-50 cursor-not-allowed"}`}
          >
            {isSubmittingFeedback ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            ) : (
              <><RotateCcw className="w-4 h-4" /> Submit Feedback & Re-iterate</>
            )}
          </button>

          <button
            onClick={handleFinalize}
            disabled={!chosenSolution || isSubmittingFeedback}
            className={`bg-green-600 text-white px-8 py-3 rounded-[10px] text-lg font-medium
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
