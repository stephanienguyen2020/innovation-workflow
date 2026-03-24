"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { ChevronDown, Rocket, Loader2, ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useModel } from "@/context/ModelContext";
import ModelSelector from "@/components/ModelSelector";
import WorkflowProgress from "@/components/WorkflowProgress";
import StageReportButton from "@/components/StageReportButton";

interface ProblemStatement {
  id: string;
  problem: string;
  explanation: string;
  is_custom?: boolean;
}

function AnalysisContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId");
  const projectId = projectIdFromUrl || (typeof window !== "undefined" ? localStorage.getItem("currentProjectId") : null);

  const { model } = useModel();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problemStatements, setProblemStatements] = useState<ProblemStatement[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<string>("");
  const [expandedProblem, setExpandedProblem] = useState<string | null>(null);
  const [customProblem, setCustomProblem] = useState("");
  const [customExplanation, setCustomExplanation] = useState("");
  const [showWarning, setShowWarning] = useState(false);
  const [generatingProblems, setGeneratingProblems] = useState(false);
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);

  const generateProblemStatements = async () => {
    if (!projectId) return;
    setGeneratingProblems(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/stages/3/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Model-Type": model,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to generate problem statements");
      }

      const fetchData = await response.json();

      if (
        fetchData?.data?.problem_statements &&
        Array.isArray(fetchData.data.problem_statements) &&
        fetchData.data.problem_statements.length > 0
      ) {
        setProblemStatements(fetchData.data.problem_statements);
      } else {
        throw new Error("No problem statements were generated");
      }
    } catch (err) {
      setError((err as Error).message || "Failed to generate problem statements");
    } finally {
      setGeneratingProblems(false);
    }
  };

  useEffect(() => {
    if (!projectId) {
      setError("No project ID provided.");
      router.push("/workflow");
      return;
    }

    const fetchProblemStatements = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/projects/${projectId}/stages/3`);

        if (!response.ok) {
          const errorData = await response.json();
          if (
            response.status === 404 ||
            errorData.detail?.includes("must be completed first")
          ) {
            await generateProblemStatements();
            return;
          }
          throw new Error(errorData.detail || "Failed to fetch problem statements");
        }

        const data = await response.json();

        if (
          data.status === "not_started" ||
          (data.data && Object.keys(data.data).length === 0)
        ) {
          await generateProblemStatements();
          return;
        }

        if (data?.data?.problem_statements && Array.isArray(data.data.problem_statements)) {
          setProblemStatements(data.data.problem_statements);
        } else {
          throw new Error("Invalid response format");
        }
      } catch (err) {
        setError((err as Error).message || "Failed to fetch problem statements");
      } finally {
        setLoading(false);
      }
    };

    fetchProblemStatements();
  }, [projectId]);

  const handleBoxClick = (id: string) => {
    setSelectedProblem(id);
    setExpandedProblem(expandedProblem === id ? null : id);
    if (showWarning) setShowWarning(false);
  };

  const handleGenerateIdeas = async () => {
    if (!selectedProblem || (selectedProblem === "custom" && !customProblem.trim())) {
      setShowWarning(true);
      return;
    }

    try {
      setGeneratingIdeas(true);
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

      if (selectedProblem !== "custom") {
        queryParams.append("selected_problem_id", selectedProblem);
      } else if (customProblem.trim()) {
        queryParams.append("custom_problem", customProblem);
      }

      if (queryParams.toString()) {
        apiUrl += `?${queryParams.toString()}`;
      }

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Model-Type": model,
        },
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        let errorMessage = "Failed to process stage 4";
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {}
        throw new Error(errorMessage);
      }

      setProgressPercent(100);
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (selectedProblem === "custom") {
        router.push(
          `/workflow/ideate?projectId=${projectId}&problemId=custom&problem=${encodeURIComponent(customProblem)}&explanation=${encodeURIComponent(customExplanation || "")}`
        );
      } else {
        router.push(`/workflow/ideate?projectId=${projectId}&problemId=${selectedProblem}`);
      }
    } catch (err) {
      setError((err as Error).message || "Failed to generate ideas");
      setGeneratingIdeas(false);
      setProgressPercent(0);
    }
  };

  return (
    <div className="min-h-screen p-6 flex flex-col max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-4 mb-12">
        <h1 className="text-4xl md:text-6xl font-bold">Innovation Workflow</h1>
        <WorkflowProgress currentStep={3} projectId={projectId} />
      </div>

      {/* Main Content */}
      <div className="space-y-8">
        <button
          onClick={() => router.push(`/workflow/research?projectId=${projectId}`)}
          className="text-gray-700 hover:text-gray-900 flex items-center gap-2 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Research</span>
        </button>

        <div className="flex items-center justify-between">
          <h2 className="text-4xl font-bold">Analysis</h2>
          <div className="flex items-center gap-3">
            <StageReportButton
              projectId={projectId || ""}
              stageNumber={3}
              stageName="Analysis"
              disabled={problemStatements.length === 0}
            />
            <ModelSelector />
          </div>
        </div>
        <p className="text-2xl">
          Select from the following problem statement or enter your own
        </p>

        {/* Loading State */}
        {(loading || generatingProblems) && !generatingIdeas && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
            <p className="text-lg">
              {generatingProblems
                ? "Generating problem statements based on your research..."
                : "Loading problem statements..."}
            </p>
          </div>
        )}

        {/* Progress indicator for idea generation */}
        {generatingIdeas && (
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
              <h3 className="text-xl font-semibold mb-2">Generating Ideas</h3>
              <p className="text-gray-600 mb-4">Creating product ideas and concept images...</p>
              <p className="text-sm text-gray-400">This may take up to 2 minutes</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && !generatingProblems && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <p>{error}</p>
            <button onClick={() => window.location.reload()} className="mt-2 text-sm underline">
              Try again
            </button>
          </div>
        )}

        {/* Problem Statements */}
        {!loading && !generatingProblems && !error && (
          <div className="space-y-4">
            {problemStatements.map((problem) => (
              <div key={problem.id} className="border-b border-gray-200">
                <div
                  className="flex items-center justify-between py-4 cursor-pointer hover:bg-gray-50 transition-colors duration-200 rounded-lg px-2"
                  onClick={() => handleBoxClick(problem.id)}
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="radio" name="problem"
                      checked={selectedProblem === problem.id}
                      readOnly className="w-5 h-5 pointer-events-none"
                    />
                    <span className="text-lg select-none">{problem.problem}</span>
                  </div>
                  <ChevronDown
                    className={`w-6 h-6 transition-transform duration-200 ${
                      expandedProblem === problem.id ? "rotate-180" : ""
                    }`}
                  />
                </div>
                {expandedProblem === problem.id && (
                  <div className="pb-4 pl-9">
                    <p className="text-gray-600">{problem.explanation}</p>
                  </div>
                )}
              </div>
            ))}

            {/* Custom Problem Input */}
            <div className="border-b border-gray-200 pb-4">
              <div className="flex items-center gap-4 py-4">
                <input
                  type="radio" name="problem"
                  checked={selectedProblem === "custom"}
                  onChange={() => { setSelectedProblem("custom"); if (showWarning) setShowWarning(false); }}
                  className="w-5 h-5"
                />
                <label className="text-lg">Enter your own problem:</label>
              </div>
              {selectedProblem === "custom" && (
                <div className="space-y-4 pl-9">
                  <input
                    type="text"
                    value={customProblem}
                    onChange={(e) => { setCustomProblem(e.target.value); if (showWarning) setShowWarning(false); }}
                    placeholder="Enter your own problem statement"
                    className={`w-full p-4 border-2 ${
                      showWarning && !customProblem.trim() ? "border-red-500" : "border-gray-700"
                    } rounded-lg`}
                  />
                  <textarea
                    value={customExplanation}
                    onChange={(e) => setCustomExplanation(e.target.value)}
                    placeholder="Enter detailed explanation of your problem statement"
                    className="w-full p-4 border-2 border-gray-700 rounded-lg h-40"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {showWarning && (
          <p className="text-red-500 text-sm animate-fade-in">
            {selectedProblem === "custom"
              ? "Please enter your problem statement before continuing"
              : "Please select a problem statement before continuing"}
          </p>
        )}

        {/* Bottom Actions */}
        <div className="flex flex-wrap gap-4 pt-4">
          <button
            onClick={() => router.push(`/workflow/research?projectId=${projectId}`)}
            disabled={generatingIdeas || generatingProblems}
            className={`bg-black text-white px-8 py-3 rounded-[10px] text-xl font-medium
                     hover:opacity-90 transition-opacity ${
                       generatingIdeas || generatingProblems ? "opacity-50 cursor-not-allowed" : ""
                     }`}
          >
            Back to Research
          </button>
          {problemStatements.length > 0 && (
            <button
              onClick={generateProblemStatements}
              disabled={loading || generatingProblems || generatingIdeas}
              className={`bg-gray-700 text-white px-8 py-3 rounded-[10px] text-xl font-medium
                       hover:opacity-90 transition-opacity inline-flex items-center gap-2
                       ${loading || generatingProblems || generatingIdeas ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              {generatingProblems ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Re-Generating...
                </>
              ) : (
                "Re-Generate Problems"
              )}
            </button>
          )}
          <button
            onClick={handleGenerateIdeas}
            disabled={loading || generatingProblems || generatingIdeas}
            className={`bg-[#001DFA] text-white px-8 py-3 rounded-[10px] text-xl font-medium
                     hover:opacity-90 transition-opacity inline-flex items-center gap-2
                     ${loading || generatingProblems || generatingIdeas ? "opacity-70 cursor-not-allowed" : ""}`}
          >
            Generate Ideas
            {loading || generatingProblems || generatingIdeas ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Rocket className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <AnalysisContent />
    </Suspense>
  );
}
