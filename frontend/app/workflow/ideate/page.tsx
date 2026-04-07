"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { ChevronDown, Rocket, Loader2, RefreshCw, FileText } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useModel } from "@/context/ModelContext";
import ModelSelector from "@/components/ModelSelector";
import WorkflowProgress from "@/components/WorkflowProgress";
import StageReportButton from "@/components/StageReportButton";

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

function formatDetailedExplanation(text: string): string {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*:/g, "<br/><strong>$1:</strong>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>")
    .replace(/^- /gm, "• ")
    .replace(/^<br\/>/, "");
}

function IdeateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { model } = useModel();
  const projectIdFromUrl = searchParams.get("projectId");
  const projectId = projectIdFromUrl || (typeof window !== "undefined" ? localStorage.getItem("currentProjectId") : null);
  const problemId = searchParams.get("problemId");
  const customProblem = searchParams.get("problem");
  const customExplanation = searchParams.get("explanation");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productIdeas, setProductIdeas] = useState<ProductIdea[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<string>("");
  const [expandedIdea, setExpandedIdea] = useState<string | null>(null);
  const [problemStatement, setProblemStatement] = useState<ProblemStatement | null>(null);
  const [researchSummary, setResearchSummary] = useState<string>("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratingImageId, setRegeneratingImageId] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [imageFeedback, setImageFeedback] = useState<Record<string, string>>({});
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [originalSolution, setOriginalSolution] = useState<ProductIdea | null>(null);
  const [pastIterations, setPastIterations] = useState<
    Array<{
      iteration_number: number;
      product_ideas: ProductIdea[];
      chosen_solution?: ProductIdea;
    }>
  >([]);
  const [currentIteration, setCurrentIteration] = useState(1);
  const [iterationFeedback, setIterationFeedback] = useState<{
    has_problem_feedback?: boolean;
    has_solution_feedback?: boolean;
    has_image_feedback?: boolean;
    chosen_solution?: ProductIdea;
  } | null>(null);

  const isRefineMode = currentIteration > 1 && (iterationFeedback?.has_solution_feedback || iterationFeedback?.has_image_feedback);
  const isImageOnlyMode = currentIteration > 1 && iterationFeedback?.has_image_feedback && !iterationFeedback?.has_solution_feedback && !iterationFeedback?.has_problem_feedback;

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
        // 0. Fetch project info for iteration context
        const projectResponse = await fetch(`/api/projects/${projectId}`);
        if (projectResponse.ok) {
          const projectData = await projectResponse.json();
          if (projectData.current_iteration) setCurrentIteration(projectData.current_iteration);
          if (projectData.iteration_feedback) setIterationFeedback(projectData.iteration_feedback);
        }

        // 1. Fetch product ideas from stage 4
        const ideasResponse = await fetch(`/api/projects/${projectId}/stages/4`);

        if (ideasResponse.ok) {
          const ideasData = await ideasResponse.json();
          if (ideasData?.data?.product_ideas && Array.isArray(ideasData.data.product_ideas)) {
            setProductIdeas(ideasData.data.product_ideas);
            if (ideasData.data.product_ideas.length > 0) {
              setExpandedIdea(ideasData.data.product_ideas[0].id);
              setSelectedIdea(ideasData.data.product_ideas[0].id);

              if (!problemId && ideasData.data.product_ideas[0].problem_id) {
                await fetchProblemStatement(ideasData.data.product_ideas[0].problem_id);
              }
            }
            // Load original solution and past iterations if present
            if (ideasData.data.original_solution) {
              setOriginalSolution(ideasData.data.original_solution);
            }
            if (ideasData.data.past_iterations && Array.isArray(ideasData.data.past_iterations)) {
              setPastIterations(ideasData.data.past_iterations);
            }
          }
        }

        // 2. Fetch the problem statement
        if (problemId && problemId !== "custom") {
          await fetchProblemStatement(problemId);
        } else if (customProblem) {
          setProblemStatement({
            id: "custom",
            problem: customProblem,
            explanation: customExplanation || customProblem,
            is_custom: true,
          });
        } else if (!problemId) {
          try {
            const problemResponse = await fetch(`/api/projects/${projectId}/stages/3`);
            if (problemResponse.ok) {
              const problemData = await problemResponse.json();
              if (problemData?.data?.problem_statements?.length > 0) {
                setProblemStatement(problemData.data.problem_statements[0]);
              }
            }
          } catch {}
        }

        // 3. Fetch research summary from stage 2
        try {
          const researchResponse = await fetch(`/api/projects/${projectId}/stages/2`);
          if (researchResponse.ok) {
            const stageData = await researchResponse.json();
            if (stageData?.data?.analysis) {
              setResearchSummary(stageData.data.analysis);
            } else {
              setResearchSummary("Analysis not available. Please complete the Understand step first.");
            }
          }
        } catch {}
      } catch (err) {
        setError((err as Error).message || "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };

    const fetchProblemStatement = async (id: string) => {
      const problemResponse = await fetch(`/api/projects/${projectId}/stages/3`);
      if (problemResponse.ok) {
        const problemData = await problemResponse.json();
        if (problemData?.data) {
          const allProblems = [
            ...(problemData.data.problem_statements || []),
            ...(problemData.data.custom_problems || []),
          ];
          const problem = allProblems.find((p: ProblemStatement) => p.id === id);
          if (problem) setProblemStatement(problem);
        }
      }
    };

    fetchData();
  }, [projectId, problemId, customProblem, customExplanation]);

  const handleBoxClick = (id: string) => {
    setSelectedIdea(id);
    setExpandedIdea(expandedIdea === id ? null : id);
  };

  const handleRegenerateImage = async (ideaId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!projectId) return;
    setRegeneratingImageId(ideaId);

    try {
      const feedback = imageFeedback[ideaId] || null;
      const response = await fetch(
        `/api/projects/${projectId}/ideas/${ideaId}/regenerate-image`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback }),
        }
      );

      if (!response.ok) throw new Error("Failed to regenerate image");
      const result = await response.json();

      setProductIdeas((prev) =>
        prev.map((idea) => (idea.id === ideaId ? { ...idea, image_url: result.image_url } : idea))
      );
      setImageFeedback((prev) => {
        const updated = { ...prev };
        delete updated[ideaId];
        return updated;
      });
    } catch {
      alert("Failed to regenerate image. Please try again.");
    } finally {
      setRegeneratingImageId(null);
    }
  };

  const handleFinalize = async () => {
    if (!projectId || !selectedIdea) {
      setError("Please select a solution first.");
      return;
    }

    setIsSubmittingFeedback(true);
    setError(null);

    try {
      // Save stage 5 with chosen solution to skip evaluation
      await fetch(`/api/projects/${projectId}/stages/5/submit-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluation_notes: "",
          chosen_solution_id: selectedIdea,
        }),
      });

      router.push(`/workflow/report?projectId=${projectId}&solutionId=${selectedIdea}`);
    } catch (err) {
      setError((err as Error).message || "Failed to finalize");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleRegenerateIdeas = async () => {
    try {
      setIsRegenerating(true);
      setProgressPercent(0);
      setError(null);

      const estimatedDuration = 120000;
      const progressInterval = setInterval(() => {
        setProgressPercent((prev) => {
          if (prev < 50) return prev + 1;
          if (prev < 80) return prev + 0.5;
          if (prev < 95) return prev + 0.2;
          return prev;
        });
      }, estimatedDuration / 100);

      let apiUrl = `/api/projects/${projectId}/stages/4/generate`;
      const queryParams = new URLSearchParams();

      if (problemId && problemId !== "custom") {
        queryParams.append("selected_problem_id", problemId);
      } else if (customProblem) {
        queryParams.append("custom_problem", customProblem);
      } else if (productIdeas.length > 0 && productIdeas[0].problem_id) {
        queryParams.append("selected_problem_id", productIdeas[0].problem_id);
      } else if (problemStatement?.id && problemStatement.id !== "custom") {
        queryParams.append("selected_problem_id", problemStatement.id);
      }

      if (queryParams.toString()) apiUrl += `?${queryParams.toString()}`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Model-Type": model },
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        let errorMessage = "Failed to regenerate ideas";
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {}
        throw new Error(errorMessage);
      }

      setProgressPercent(100);
      await new Promise((resolve) => setTimeout(resolve, 500));
      window.location.reload();
    } catch (err) {
      setError((err as Error).message || "Failed to regenerate ideas");
      setIsRegenerating(false);
      setProgressPercent(0);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
        <p className="text-lg font-medium">Loading ideas...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 flex flex-col max-w-6xl mx-auto">
      {/* Regeneration overlay */}
      {isRegenerating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl">
            <div className="relative w-32 h-32 mx-auto mb-6">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle cx="64" cy="64" r="56" stroke="#e5e7eb" strokeWidth="8" fill="none" />
                <circle
                  cx="64" cy="64" r="56"
                  stroke="#001DFA" strokeWidth="8" fill="none" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - progressPercent / 100)}`}
                  className="transition-all duration-300 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-800">{Math.round(progressPercent)}%</span>
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-2">Regenerating Ideas</h3>
            <p className="text-gray-600 mb-4">Creating new product ideas and concept images...</p>
            <p className="text-sm text-gray-400">This may take up to 2 minutes</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center space-y-4 mb-12">
        <h1 className="text-4xl md:text-6xl font-bold">Innovation Workflow</h1>
        <WorkflowProgress currentStep={4} projectId={projectId} />
      </div>

      {/* Main Content */}
      <div className="space-y-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-5xl font-bold">
            {isImageOnlyMode ? "Ideate" : isRefineMode ? "Refine Ideas" : "Ideate"}
          </h2>
          <div className="flex items-center gap-3">
            <StageReportButton
              projectId={projectId || ""}
              stageNumber={4}
              stageName="Ideate"
              disabled={productIdeas.length === 0}
            />
            <ModelSelector />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p>{error}</p>
            <button onClick={() => window.location.reload()} className="mt-2 text-sm underline">Try again</button>
          </div>
        )}

        {/* Research Summary Section */}
        <div className="space-y-2 mb-10">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-4xl font-bold">Research Summary</h3>
            <button
              onClick={() => router.push(`/workflow/understand?projectId=${projectId}`)}
              className="bg-black text-white px-6 py-2 rounded-[10px] text-sm font-medium"
            >
              Modify Research
            </button>
          </div>
          {researchSummary ? (
            <div
              className="text-lg leading-relaxed"
              dangerouslySetInnerHTML={{ __html: formatDetailedExplanation(researchSummary) }}
            />
          ) : (
            <p className="text-gray-500 text-lg">No research summary available.</p>
          )}
        </div>

        {/* Problem Statement Section */}
        <div className="space-y-2 mb-10">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-4xl font-bold">Problem Statement</h3>
            <button
              onClick={() => router.push(`/workflow/analysis?projectId=${projectId}`)}
              className="bg-black text-white px-6 py-2 rounded-[10px] text-sm font-medium"
            >
              Modify Problem
            </button>
          </div>
          <div className="border border-gray-100 rounded-lg p-6 bg-white">
            <p className="text-xl font-medium mb-3">
              {problemStatement?.problem || "No problem statement selected"}
            </p>
            {problemStatement?.explanation && (
              <p className="text-gray-600 text-lg">{problemStatement.explanation}</p>
            )}
          </div>
        </div>

        {/* Chosen Solution from Previous Round (shown when iterating) */}
        {originalSolution && (
          <div className="space-y-2 mb-10">
            <h3 className="text-4xl font-bold mb-4">Chosen Solution from Previous Round</h3>
            <div className="border-2 border-blue-200 rounded-lg p-5 bg-blue-50">
              <p className="text-lg font-semibold text-blue-900 mb-2">{originalSolution.idea}</p>
              {originalSolution.image_url && (
                <img
                  src={originalSolution.image_url}
                  alt={originalSolution.idea}
                  className="w-full max-w-lg h-auto rounded-lg mb-3"
                  style={{ aspectRatio: "16/9" }}
                />
              )}
              <div
                className="text-gray-700 text-base leading-relaxed"
                dangerouslySetInnerHTML={{ __html: formatDetailedExplanation(originalSolution.detailed_explanation || "") }}
              />
            </div>
          </div>
        )}

        {/* Generated Ideas / Refined Variations Section */}
        <div className="space-y-2 mb-10">
          <h3 className="text-4xl font-bold mb-6">
            {isImageOnlyMode
              ? "Image Variations"
              : isRefineMode || originalSolution
                ? "Refined Ideas"
                : "Generated Ideas"}
          </h3>
          {productIdeas.length > 0 ? (
            <div className="space-y-5">
              {productIdeas.map((idea) => (
                <div key={idea.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div
                    className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => handleBoxClick(idea.id)}
                  >
                    <div className="flex items-center gap-4">
                      <input
                        type="radio" name="idea"
                        checked={selectedIdea === idea.id}
                        readOnly className="w-5 h-5 accent-blue-600 pointer-events-none"
                      />
                      <span className="text-lg font-medium select-none">{idea.idea}</span>
                    </div>
                    <ChevronDown className={`w-6 h-6 transition-transform ${expandedIdea === idea.id ? "rotate-180" : ""}`} />
                  </div>
                  {expandedIdea === idea.id && (
                    <div className="p-5 pl-14 border-t border-gray-100 bg-white">
                      {idea.image_url && (
                        <div className="mb-6">
                          <h4 className="font-semibold text-gray-800 mb-3">Product Concept Visualization</h4>
                          <div className="relative rounded-lg overflow-hidden bg-gray-100 mb-4">
                            <img
                              src={idea.image_url}
                              alt={`Concept visualization for ${idea.idea}`}
                              className="w-full max-w-2xl h-auto object-cover"
                              style={{ aspectRatio: "16/9" }}
                            />
                          </div>
                          <div className="flex items-end gap-3 mt-4">
                            <div className="flex-1">
                              <input
                                type="text"
                                value={imageFeedback[idea.id] || ""}
                                onChange={(e) => setImageFeedback((prev) => ({ ...prev, [idea.id]: e.target.value }))}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Describe changes for the image (optional)"
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-300 outline-none"
                                disabled={regeneratingImageId === idea.id}
                              />
                            </div>
                            <button
                              onClick={(e) => handleRegenerateImage(idea.id, e)}
                              disabled={regeneratingImageId === idea.id}
                              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#001DFA] hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <RefreshCw className={`w-4 h-4 ${regeneratingImageId === idea.id ? "animate-spin" : ""}`} />
                              {regeneratingImageId === idea.id ? "Generating..." : "Regenerate"}
                            </button>
                          </div>
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-3">Product Details</h4>
                        <div
                          className="text-gray-700 text-base leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: formatDetailedExplanation(idea.detailed_explanation) }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-lg py-4">No ideas generated yet. Try regenerating ideas.</p>
          )}
        </div>

        {/* Past Iterations (newest first) */}
        {pastIterations.length > 0 && (
          <div className="space-y-2 mb-10">
            <h3 className="text-4xl font-bold mb-4">Idea History</h3>
            <div className="space-y-8">
              {pastIterations.map((pi) => (
                <div
                  key={pi.iteration_number}
                  className="border border-gray-200 rounded-xl overflow-hidden"
                >
                  <div className="bg-gray-100 px-5 py-3 flex items-center gap-3">
                    <span className="text-sm font-bold text-white bg-gray-600 px-3 py-1 rounded-full">
                      v{pi.iteration_number}
                    </span>
                    {pi.chosen_solution && (
                      <span className="text-sm text-gray-600">
                        Selected: <strong>{pi.chosen_solution.idea}</strong>
                      </span>
                    )}
                  </div>
                  <div className="p-5 space-y-4">
                    {pi.product_ideas.map((idea) => {
                      const isChosen = pi.chosen_solution?.id === idea.id;
                      return (
                        <div
                          key={idea.id}
                          className={`rounded-lg p-4 ${
                            isChosen
                              ? "border-2 border-blue-300 bg-blue-50"
                              : "border border-gray-100 bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-base font-semibold text-gray-800">
                              {idea.idea}
                            </span>
                            {isChosen && (
                              <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                                Selected
                              </span>
                            )}
                          </div>
                          {idea.image_url && (
                            <img
                              src={idea.image_url}
                              alt={idea.idea}
                              className="w-full max-w-md h-auto rounded-lg mb-3"
                              style={{ aspectRatio: "16/9" }}
                            />
                          )}
                          <div
                            className="text-gray-600 text-sm leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: formatDetailedExplanation(idea.detailed_explanation || ""),
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex flex-wrap gap-6">
          <button
            onClick={handleRegenerateIdeas}
            disabled={isRegenerating}
            className="bg-black text-white px-8 py-3 rounded-[10px] text-lg font-medium
                    hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            {isRegenerating ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> {isRefineMode ? "Refining..." : "Regenerating..."}</>
            ) : (
              isRefineMode ? "Refine Ideas" : "Regenerate Ideas"
            )}
          </button>
          <button
            onClick={() => {
              if (!selectedIdea) {
                alert("Please select an idea first");
                return;
              }
              router.push(`/workflow/evaluate?projectId=${projectId}&solutionId=${selectedIdea}`);
            }}
            disabled={!selectedIdea || isRegenerating}
            className={`bg-[#001DFA] text-white px-8 py-3 rounded-[10px] text-lg font-medium
                    hover:opacity-90 transition-opacity inline-flex items-center gap-2
                    ${!selectedIdea || isRegenerating ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            Evaluate
            <Rocket className="w-5 h-5" />
          </button>
          <button
            onClick={handleFinalize}
            disabled={!selectedIdea || isSubmittingFeedback || isRegenerating}
            className={`bg-green-600 text-white px-8 py-3 rounded-[10px] text-lg font-medium
                     hover:bg-green-700 transition-colors inline-flex items-center gap-2
                     ${!selectedIdea || isSubmittingFeedback || isRegenerating ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isSubmittingFeedback ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Finalizing...</>
            ) : (
              <><FileText className="w-5 h-5" /> Finalize & Generate Report</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IdeatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <IdeateContent />
    </Suspense>
  );
}
