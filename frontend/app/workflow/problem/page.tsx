"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { ChevronDown, Rocket, Loader2, ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useModel } from "@/context/ModelContext";

interface ProblemStatement {
  id: string;
  problem: string;
  explanation: string;
  is_custom?: boolean;
}

function ProblemDefinitionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId");
  const projectId = projectIdFromUrl || (typeof window !== "undefined" ? localStorage.getItem("currentProjectId") : null);

  const { model } = useModel();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problemStatements, setProblemStatements] = useState<
    ProblemStatement[]
  >([]);
  const [selectedProblem, setSelectedProblem] = useState<string>("");
  const [expandedProblem, setExpandedProblem] = useState<string | null>(null);
  const [customProblem, setCustomProblem] = useState("");
  const [customExplanation, setCustomExplanation] = useState("");
  const [showWarning, setShowWarning] = useState(false);
  const [generatingProblems, setGeneratingProblems] = useState(false);
  const [hasUploadState, setHasUploadState] = useState(false);
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);

  // Check if we have upload state saved in localStorage
  useEffect(() => {
    if (projectId) {
      const savedState = localStorage.getItem(
        `project_${projectId}_upload_state`
      );
      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState);
          if (
            parsedState.analysis ||
            (parsedState.uploadedFiles && parsedState.uploadedFiles.length > 0)
          ) {
            setHasUploadState(true);
          }
        } catch (error) {
          console.error("Error checking for saved upload state:", error);
        }
      }
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setError("No project ID provided. Please go back and select a project.");
      router.push("/workflow");
      return;
    }

    // Function to generate problem statements
    const generateProblemStatements = async () => {
      setGeneratingProblems(true);
      setError(null);

      try {
        console.log(
          "Initiating problem statement generation for project:",
          projectId
        );
        const response = await fetch(
          `/api/projects/${projectId}/stages/2/generate`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        console.log("Problem generation response status:", response.status);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.detail || "Failed to generate problem statements"
          );
        }

        const fetchData = await response.json();
        console.log("Problem generation successful, result:", fetchData);

        if (
          fetchData &&
          fetchData.data &&
          Array.isArray(fetchData.data.problem_statements) &&
          fetchData.data.problem_statements.length > 0
        ) {
          setProblemStatements(fetchData.data.problem_statements);
        } else {
          throw new Error("No problem statements were generated");
        }
      } catch (err) {
        console.error("Problem statement generation error:", err);
        setError(
          (err as Error).message || "Failed to generate problem statements"
        );
      } finally {
        setGeneratingProblems(false);
      }
    };

    // Function to fetch problem statements
    const fetchProblemStatements = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/projects/${projectId}/stages/2`);

        if (!response.ok) {
          const errorData = await response.json();

          // If the stage needs to be generated, do that
          if (
            response.status === 404 ||
            (errorData.detail &&
              errorData.detail.includes("must be completed first"))
          ) {
            await generateProblemStatements();
            return;
          }

          throw new Error(
            errorData.detail || "Failed to fetch problem statements"
          );
        }

        const data = await response.json();
        console.log("Received problem statements data:", data);

        // Check if the stage is not started or if data is empty - we need to generate problems
        if (
          data.status === "not_started" ||
          (data.data && Object.keys(data.data).length === 0)
        ) {
          console.log(
            "Stage 2 is not started yet, generating problem statements..."
          );
          await generateProblemStatements();
          return;
        }

        // Extract problem statements from the response
        // Backend format: { stage_number, status, data: { problem_statements: [...] } }
        if (data && data.data && Array.isArray(data.data.problem_statements)) {
          setProblemStatements(data.data.problem_statements);
        } else {
          console.error("Invalid response format:", data);
          throw new Error("Invalid response format");
        }
      } catch (err) {
        console.error("Error fetching problem statements:", err);
        setError(
          (err as Error).message || "Failed to fetch problem statements"
        );
      } finally {
        setLoading(false);
      }
    };

    // Fetch problem statements when the component mounts
    fetchProblemStatements();
  }, [projectId, model]);

  const handleProblemSelect = (id: string) => {
    setSelectedProblem(id);
    if (showWarning) {
      setShowWarning(false);
    }
  };

  const handleToggleExpansion = (id: string) => {
    setExpandedProblem(expandedProblem === id ? null : id);
  };

  const handleBoxClick = (id: string) => {
    setSelectedProblem(id);
    setExpandedProblem(expandedProblem === id ? null : id);
    if (showWarning) {
      setShowWarning(false);
    }
  };

  const handleGoBackToUpload = () => {
    if (projectId) {
      router.push(`/workflow/upload?projectId=${projectId}`);
    } else {
      router.push("/workflow");
    }
  };

  const handleGenerateIdeas = async () => {
    if (
      !selectedProblem ||
      (selectedProblem === "custom" && !customProblem.trim())
    ) {
      setShowWarning(true);
      return;
    }

    try {
      setGeneratingIdeas(true);
      setProgressPercent(0);
      setError(null);

      // Start progress animation (estimated 2 minutes = 120 seconds)
      const estimatedDuration = 120000; // 2 minutes in ms
      const progressInterval = setInterval(() => {
        setProgressPercent((prev) => {
          // Slow down as we approach 95% (never reach 100% until done)
          if (prev < 50) return prev + 1;
          if (prev < 80) return prev + 0.5;
          if (prev < 95) return prev + 0.2;
          return prev;
        });
      }, estimatedDuration / 100);

      // Build URL with query parameters for the backend API
      let apiUrl = `/api/projects/${projectId}/stages/3/generate`;
      const queryParams = new URLSearchParams();

      if (selectedProblem !== "custom") {
        // For predefined problems, we pass the selected_problem_id
        queryParams.append("selected_problem_id", selectedProblem);
        console.log(`Selected problem ID: ${selectedProblem}`);
      } else if (customProblem.trim()) {
        // For custom problems, we pass the custom_problem text
        queryParams.append("custom_problem", customProblem);
        console.log(`Custom problem: ${customProblem}`);
      }

      // Add the query string to the URL
      if (queryParams.toString()) {
        apiUrl += `?${queryParams.toString()}`;
      }

      console.log(`Calling API: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Model-Type": model,
        },
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        let errorMessage = "Failed to process stage 3";

        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (parseError) {
          console.error("Failed to parse error response:", parseError);
          try {
            // Try to get the text if JSON parsing fails
            const errorText = await response.text();
            if (errorText) {
              errorMessage = errorText;
            }
          } catch (textError) {
            console.error("Failed to get error text:", textError);
          }
        }

        throw new Error(errorMessage);
      }

      // Set progress to 100% on success
      setProgressPercent(100);
      console.log("API call successful - navigating to ideas page");

      // Wait for a moment to show 100% completion
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Navigate to ideas page with the selected problem ID
      if (selectedProblem === "custom") {
        // For custom problems, include the problem text in the URL
        router.push(
          `/workflow/ideas?projectId=${projectId}&problemId=custom&problem=${encodeURIComponent(
            customProblem
          )}&explanation=${encodeURIComponent(customExplanation || "")}`
        );
      } else {
        // For predefined problems, just pass the ID
        router.push(
          `/workflow/ideas?projectId=${projectId}&problemId=${selectedProblem}`
        );
      }
    } catch (err) {
      console.error("Error generating ideas:", err);
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

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-0 mt-6">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white
                ${step === 2 ? "bg-[#001DFA]" : "bg-black"}
                cursor-pointer hover:opacity-80 transition-opacity`}
                onClick={() => {
                  if (step === 1) {
                    router.push(`/workflow/upload?projectId=${projectId}`);
                  } else if (step === 2) {
                    // Current page (problem)
                    return;
                  } else if (step === 3) {
                    if (selectedProblem) {
                      if (selectedProblem === "custom") {
                        router.push(
                          `/workflow/ideas?projectId=${projectId}&problemId=custom&problem=${encodeURIComponent(
                            customProblem
                          )}&explanation=${encodeURIComponent(
                            customExplanation || ""
                          )}`
                        );
                      } else {
                        router.push(
                          `/workflow/ideas?projectId=${projectId}&problemId=${selectedProblem}`
                        );
                      }
                    } else {
                      // Try to use the first problem if available
                      if (problemStatements.length > 0) {
                        router.push(
                          `/workflow/ideas?projectId=${projectId}&problemId=${problemStatements[0].id}`
                        );
                      } else {
                        // Otherwise just navigate to the ideas page and let it handle the lack of problem ID
                        router.push(`/workflow/ideas?projectId=${projectId}`);
                      }
                    }
                  } else if (step === 4) {
                    // First check if stage 4 already exists/is completed
                    fetch(`/api/projects/${projectId}/stages/4`)
                      .then((response) => {
                        if (response.ok) {
                          // Stage 4 exists, can navigate directly
                          router.push(
                            `/workflow/report?projectId=${projectId}`
                          );
                        } else {
                          // Stage 4 doesn't exist, need to go through ideas first
                          alert(
                            "Please select an idea in the next step to generate a report."
                          );

                          // Determine how to navigate to ideas based on problem selection
                          if (selectedProblem) {
                            if (selectedProblem === "custom") {
                              router.push(
                                `/workflow/ideas?projectId=${projectId}&problemId=custom&problem=${encodeURIComponent(
                                  customProblem
                                )}&explanation=${encodeURIComponent(
                                  customExplanation || ""
                                )}`
                              );
                            } else {
                              router.push(
                                `/workflow/ideas?projectId=${projectId}&problemId=${selectedProblem}`
                              );
                            }
                          } else if (problemStatements.length > 0) {
                            router.push(
                              `/workflow/ideas?projectId=${projectId}&problemId=${problemStatements[0].id}`
                            );
                          } else {
                            router.push(
                              `/workflow/ideas?projectId=${projectId}`
                            );
                          }
                        }
                      })
                      .catch((error) => {
                        console.error("Error checking stage 4:", error);
                        // Default to safe path
                        router.push(`/workflow/ideas?projectId=${projectId}`);
                      });
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
      <div className="space-y-8">
        {/* Back to upload button */}
        {hasUploadState && (
          <button
            onClick={handleGoBackToUpload}
            className="text-gray-700 hover:text-gray-900 flex items-center gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Upload & Analysis</span>
          </button>
        )}

        <h2 className="text-4xl font-bold">Problem Definition</h2>
        <p className="text-2xl">
          Select from the following problem statement or enter your own
        </p>

        {/* Loading State for problems */}
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
                {/* Background circle */}
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="#e5e7eb"
                    strokeWidth="8"
                    fill="none"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="#001DFA"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${
                      2 * Math.PI * 56 * (1 - progressPercent / 100)
                    }`}
                    className="transition-all duration-300 ease-out"
                  />
                </svg>
                {/* Percentage text */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-800">
                    {Math.round(progressPercent)}%
                  </span>
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">Generating Ideas</h3>
              <p className="text-gray-600 mb-4">
                Creating product ideas and concept images...
              </p>
              <p className="text-sm text-gray-400">
                This may take up to 2 minutes
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && !generatingProblems && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <p>{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm underline"
            >
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
                      type="radio"
                      id={problem.id}
                      name="problem"
                      checked={selectedProblem === problem.id}
                      readOnly
                      className="w-5 h-5 pointer-events-none"
                    />
                    <span className="text-lg select-none">
                      {problem.problem}
                    </span>
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
                  type="radio"
                  id="custom"
                  name="problem"
                  checked={selectedProblem === "custom"}
                  onChange={() => handleProblemSelect("custom")}
                  className="w-5 h-5"
                />
                <label htmlFor="custom" className="text-lg">
                  Enter your own problem:
                </label>
              </div>
              {selectedProblem === "custom" && (
                <div className="space-y-4 pl-9">
                  <input
                    type="text"
                    value={customProblem}
                    onChange={(e) => {
                      setCustomProblem(e.target.value);
                      if (showWarning) setShowWarning(false);
                    }}
                    placeholder="Enter your own problem statement"
                    className={`w-full p-4 border-2 ${
                      showWarning && !customProblem.trim()
                        ? "border-red-500"
                        : "border-gray-700"
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

        {/* Warning Message */}
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
            onClick={handleGoBackToUpload}
            disabled={generatingIdeas}
            className={`bg-black text-white px-8 py-3 rounded-[10px] text-xl font-medium
                     hover:opacity-90 transition-opacity ${
                       generatingIdeas ? "opacity-50 cursor-not-allowed" : ""
                     }`}
          >
            Back to Research
          </button>
          <button
            onClick={handleGenerateIdeas}
            disabled={loading || generatingProblems || generatingIdeas}
            className={`bg-[#001DFA] text-white px-8 py-3 rounded-[10px] text-xl font-medium
                     hover:opacity-90 transition-opacity inline-flex items-center gap-2 
                     ${
                       loading || generatingProblems || generatingIdeas
                         ? "opacity-70 cursor-not-allowed"
                         : ""
                     }`}
          >
            Generate ideas
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

export default function ProblemDefinitionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <ProblemDefinitionContent />
    </Suspense>
  );
}
