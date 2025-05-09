"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { ChevronDown, Rocket, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

interface ProductIdea {
  id: string;
  idea: string;
  detailed_explanation: string;
  problem_id: string;
}

interface ProblemStatement {
  id: string;
  problem: string;
  explanation: string;
  is_custom?: boolean;
}

interface Stage {
  stage_number: number;
  status: string;
  data: {
    analysis?: string;
    [key: string]: any;
  };
}

function IdeationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const problemId = searchParams.get("problemId");
  const customProblem = searchParams.get("problem");
  const customExplanation = searchParams.get("explanation");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productIdeas, setProductIdeas] = useState<ProductIdea[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<string>("");
  const [expandedIdea, setExpandedIdea] = useState<string | null>(null);
  const [problemStatement, setProblemStatement] =
    useState<ProblemStatement | null>(null);
  const [researchSummary, setResearchSummary] = useState<string>("");
  const [isHistoricalExpanded, setIsHistoricalExpanded] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setError("No project ID provided. Please go back and select a project.");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1. Fetch the product ideas from stage 3
        const ideasResponse = await fetch(
          `/api/projects/${projectId}/stages/3`
        );

        if (!ideasResponse.ok) {
          if (ideasResponse.status === 404) {
            console.log("Ideas not found, may need to generate them");
          } else {
            const errorData = await ideasResponse.json();
            throw new Error(
              errorData.detail || "Failed to fetch product ideas"
            );
          }
        } else {
          const ideasData = await ideasResponse.json();
          console.log("Received product ideas:", ideasData);

          if (
            ideasData &&
            ideasData.data &&
            Array.isArray(ideasData.data.product_ideas)
          ) {
            setProductIdeas(ideasData.data.product_ideas);
            if (ideasData.data.product_ideas.length > 0) {
              setExpandedIdea(ideasData.data.product_ideas[0].id);
              setSelectedIdea(ideasData.data.product_ideas[0].id);

              // If we don't have problemId from URL, try to get it from the first idea
              if (!problemId && ideasData.data.product_ideas[0].problem_id) {
                const firstIdeaProblemId =
                  ideasData.data.product_ideas[0].problem_id;
                console.log(
                  "Using problem ID from first idea:",
                  firstIdeaProblemId
                );

                // Fetch the problem statement using this ID
                await fetchProblemStatement(firstIdeaProblemId);
                return; // Return early since we'll fetch everything else with the problem ID
              }
            }
          }
        }

        // 2. Fetch the problem statement (if it's not a custom problem)
        if (problemId && problemId !== "custom") {
          await fetchProblemStatement(problemId);
        } else if (customProblem) {
          // Use the custom problem passed in URL params
          setProblemStatement({
            id: "custom",
            problem: customProblem,
            explanation: customExplanation || customProblem,
            is_custom: true,
          });
        } else if (!problemId) {
          // If we can't get a problem ID, try fetching from stage 2 to get the latest problem
          try {
            console.log("No problem ID provided, fetching from stage 2");
            const problemResponse = await fetch(
              `/api/projects/${projectId}/stages/2`
            );

            if (problemResponse.ok) {
              const problemData = await problemResponse.json();

              if (
                problemData &&
                problemData.data &&
                Array.isArray(problemData.data.problem_statements) &&
                problemData.data.problem_statements.length > 0
              ) {
                // Use the first problem statement
                const firstProblem = problemData.data.problem_statements[0];
                setProblemStatement(firstProblem);
                console.log("Using first problem from stage 2:", firstProblem);
              }
            } else {
              console.warn("Could not fetch problems from stage 2");
            }
          } catch (err) {
            console.error("Error fetching problems from stage 2:", err);
          }
        }

        // 3. Fetch research summary from stage 1
        try {
          console.log(`Fetching stage 1 data for project: ${projectId}`);
          // Use the correct endpoint for stage 1
          const researchResponse = await fetch(
            `/api/projects/${projectId}/stages/1`
          );

          if (researchResponse.ok) {
            const stageData = await researchResponse.json();
            console.log("Stage 1 data:", stageData);

            if (stageData && stageData.data && stageData.data.analysis) {
              console.log(
                "Found analysis in stage data: ",
                stageData.data.analysis.substring(0, 100) + "..."
              );
              setResearchSummary(stageData.data.analysis);
            } else {
              console.warn("No analysis found in stage data:", stageData);
              setResearchSummary(
                "Analysis not available. Please complete research upload first."
              );
            }
          } else {
            console.error(
              "Failed to fetch stage 1 data, status:",
              researchResponse.status
            );
            setResearchSummary(
              "Research summary could not be loaded. Status: " +
                researchResponse.status
            );
          }
        } catch (researchErr) {
          console.error("Error fetching research summary:", researchErr);
          setResearchSummary(
            "Error loading research summary: " + (researchErr as Error).message
          );
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError((err as Error).message || "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };

    // Helper function to fetch problem statement
    const fetchProblemStatement = async (id: string) => {
      const problemResponse = await fetch(
        `/api/projects/${projectId}/stages/2`
      );

      if (problemResponse.ok) {
        const problemData = await problemResponse.json();

        if (
          problemData &&
          problemData.data &&
          Array.isArray(problemData.data.problem_statements)
        ) {
          const problem = problemData.data.problem_statements.find(
            (p: ProblemStatement) => p.id === id
          );

          if (problem) {
            setProblemStatement(problem);
          }
        }
      }
    };

    fetchData();
  }, [projectId, problemId, customProblem, customExplanation]);

  const handleIdeaToggle = (id: string) => {
    setSelectedIdea(id);
    setExpandedIdea(expandedIdea === id ? null : id);
  };

  const handleRegenerateIdeas = async () => {
    try {
      setIsRegenerating(true);
      setError(null);

      // Build URL with query parameters for the API
      let apiUrl = `/api/projects/${projectId}/stages/3/generate`;
      const queryParams = new URLSearchParams();

      if (problemId && problemId !== "custom") {
        // For predefined problems
        queryParams.append("selected_problem_id", problemId);
        console.log(`Selected problem ID: ${problemId}`);
      } else if (customProblem) {
        // For custom problems
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
        },
      });

      if (!response.ok) {
        let errorMessage = "Failed to regenerate ideas";

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

      console.log("Ideas regenerated successfully - reloading page");

      // Wait for a moment to ensure backend processing is complete
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Refresh the page to show new ideas
      window.location.reload();
    } catch (err) {
      console.error("Error regenerating ideas:", err);
      setError((err as Error).message || "Failed to regenerate ideas");
      setIsRegenerating(false);
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
      {/* Header */}
      <div className="text-center space-y-4 mb-12">
        <h1 className="text-4xl md:text-6xl font-bold">Innovation Workflow</h1>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-0 mt-6">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white
                ${step === 3 ? "bg-[#001DFA]" : "bg-black"}
                cursor-pointer hover:opacity-80 transition-opacity`}
                onClick={() => {
                  if (step === 1) {
                    router.push(`/workflow/upload?projectId=${projectId}`);
                  } else if (step === 2) {
                    router.push(`/workflow/problem?projectId=${projectId}`);
                  } else if (step === 3) {
                    // Current page (ideas)
                    return;
                  } else if (step === 4) {
                    // Check if stage 4 already exists/is completed
                    fetch(`/api/projects/${projectId}/stages/4`)
                      .then((response) => {
                        if (response.ok) {
                          // Stage 4 exists, can navigate directly
                          router.push(
                            `/workflow/report?projectId=${projectId}`
                          );
                        } else {
                          // Stage 4 doesn't exist, need to select an idea first
                          if (selectedIdea) {
                            router.push(
                              `/workflow/report?projectId=${projectId}&solutionId=${selectedIdea}`
                            );
                          } else {
                            alert(
                              "Please select an idea first before proceeding to the report."
                            );
                          }
                        }
                      })
                      .catch((error) => {
                        console.error("Error checking stage 4:", error);
                        // Default to safe behavior
                        if (selectedIdea) {
                          router.push(
                            `/workflow/report?projectId=${projectId}&solutionId=${selectedIdea}`
                          );
                        } else {
                          alert(
                            "Please select an idea first before proceeding to the report."
                          );
                        }
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
      <div className="space-y-16">
        <h2 className="text-5xl font-bold mb-8">Ideas</h2>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="text-base">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Problem Statement Section */}
        <div className="space-y-2 mb-10">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-4xl font-bold">Problem Statement</h3>
            <button
              onClick={() =>
                router.push(`/workflow/problem?projectId=${projectId}`)
              }
              className="bg-black text-white px-6 py-2 rounded-[10px] text-sm font-medium"
            >
              Modify Problem
            </button>
          </div>
          <div className="border border-gray-100 rounded-lg p-6 bg-white">
            <p className="text-xl font-medium mb-3">
              {problemStatement
                ? problemStatement.problem
                : "No problem statement selected"}
            </p>
            {problemStatement && problemStatement.explanation && (
              <p className="text-gray-600 text-lg">
                {problemStatement.explanation}
              </p>
            )}
          </div>
        </div>

        {/* Research Summary Section */}
        <div className="space-y-2 mb-10">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-4xl font-bold">Research Summary</h3>
            <button
              onClick={() =>
                router.push(`/workflow/upload?projectId=${projectId}`)
              }
              className="bg-black text-white px-6 py-2 rounded-[10px] text-sm font-medium"
            >
              Modify Research
            </button>
          </div>
          {researchSummary ? (
            <p className="text-lg leading-relaxed">{researchSummary}</p>
          ) : (
            <p className="text-gray-500 text-lg">
              No research summary available. Please upload research documents
              first.
            </p>
          )}
        </div>

        {/* Generated Ideas Section */}
        <div className="space-y-2 mb-10">
          <h3 className="text-4xl font-bold mb-6">Generated Ideas</h3>
          {productIdeas.length > 0 ? (
            <div className="space-y-5">
              {productIdeas.map((idea) => (
                <div
                  key={idea.id}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <div
                    className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => handleIdeaToggle(idea.id)}
                  >
                    <div className="flex items-center gap-4">
                      <input
                        type="radio"
                        id={idea.id}
                        name="idea"
                        checked={selectedIdea === idea.id}
                        onChange={() => handleIdeaToggle(idea.id)}
                        className="w-5 h-5 accent-blue-600"
                      />
                      <label
                        htmlFor={idea.id}
                        className="text-lg font-medium cursor-pointer"
                      >
                        {idea.idea}
                      </label>
                    </div>
                    <ChevronDown
                      className={`w-6 h-6 transition-transform ${
                        expandedIdea === idea.id ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                  {expandedIdea === idea.id && (
                    <div className="p-5 pl-14 border-t border-gray-100 bg-white">
                      <p className="text-gray-700 text-base leading-relaxed">
                        {idea.detailed_explanation}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-lg py-4">
              No ideas generated yet. Try regenerating ideas.
            </p>
          )}
        </div>

        {/* Historical Ideas Section */}
        {/* <div className="space-y-2 mb-10">
          <h3 className="text-4xl font-bold mb-6">Historical Ideas</h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div
              className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setIsHistoricalExpanded(!isHistoricalExpanded)}
            >
              <span className="text-lg font-medium">Generation 1</span>
              <ChevronDown
                className={`w-6 h-6 transition-transform ${
                  isHistoricalExpanded ? "rotate-180" : ""
                }`}
              />
            </div>
            {isHistoricalExpanded && (
              <div className="p-5 border-t border-gray-100">
                <p className="text-gray-700 text-base">
                  Historical ideas from generation 1...
                </p>
              </div>
            )}
          </div>
        </div> */}

        {/* Bottom Actions */}
        <div className="flex flex-wrap gap-6">
          <button
            onClick={handleRegenerateIdeas}
            disabled={isRegenerating}
            className="bg-black text-white px-8 py-3 rounded-[10px] text-lg font-medium
                    hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            {isRegenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Regenerating...
              </>
            ) : (
              "Regenerate Ideas"
            )}
          </button>
          <button
            onClick={() => {
              if (!selectedIdea) {
                alert("Please select an idea first");
                return;
              }
              router.push(
                `/workflow/report?projectId=${projectId}&solutionId=${selectedIdea}`
              );
            }}
            disabled={!selectedIdea || isRegenerating}
            className={`bg-[#001DFA] text-white px-8 py-3 rounded-[10px] text-lg font-medium
                    hover:opacity-90 transition-opacity inline-flex items-center gap-2
                    ${
                      !selectedIdea || isRegenerating
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }`}
          >
            Generate Report
            <Rocket className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IdeationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <IdeationContent />
    </Suspense>
  );
}
