"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Rocket } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuthHeaders } from "@/lib/auth";

interface Idea {
  id: string;
  idea: string;
  detailed_explanation: string;
  problem_id: string;
}

// This is a fallback in case the API call fails
const fallbackIdeas: Idea[] = [
  {
    id: "1",
    idea: "Phyto-Fix: Phytoplankton Growth Enhancer",
    detailed_explanation:
      "Phyto-Fix is a product designed to harness the power of phytoplankton for CO2 fixation...",
    problem_id: "example-problem-id",
  },
  {
    id: "2",
    idea: "Alka-Shift: Ocean Alkalinity Enhancer",
    detailed_explanation:
      "Alka-Shift is a product designed to enhance ocean alkalinity...",
    problem_id: "example-problem-id",
  },
  {
    id: "3",
    idea: "Deep-Carbon: Oceanic CO2 Sequestration System",
    detailed_explanation:
      "Deep-Carbon is a system designed to facilitate the movement of CO2 to deeper ocean levels...",
    problem_id: "example-problem-id",
  },
];

export default function IdeationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId =
    searchParams.get("projectId") || localStorage.getItem("projectId");

  const [expandedIdea, setExpandedIdea] = useState<string | null>(null);
  const [isHistoricalExpanded, setIsHistoricalExpanded] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>(fallbackIdeas);
  const [problemStatement, setProblemStatement] = useState<string>(
    "Loading problem statement..."
  );
  const [researchSummary, setResearchSummary] = useState<string>(
    "Loading research summary..."
  );
  const [loading, setLoading] = useState<boolean>(true);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    if (!projectId) {
      console.error("No project ID found");
      return;
    }

    // Fetch stage 1 for analysis (research summary)
    const fetchAnalysis = async () => {
      try {
        const response = await fetch(
          `${apiUrl}/api/projects/${projectId}/stages/1`,
          {
            headers: getAuthHeaders(),
          }
        );

        if (response.ok) {
          const stageData = await response.json();
          if (stageData.data && stageData.data.analysis) {
            setResearchSummary(stageData.data.analysis);
          }
        }
      } catch (error) {
        console.error("Error fetching analysis:", error);
      }
    };

    // Fetch stage 2 for problem statement
    const fetchProblemStatement = async () => {
      try {
        const response = await fetch(
          `${apiUrl}/api/projects/${projectId}/stages/2`,
          {
            headers: getAuthHeaders(),
          }
        );

        if (response.ok) {
          const stageData = await response.json();

          // Look for selected problem in either localStorage or stage 3 data
          const stage3Response = await fetch(
            `${apiUrl}/api/projects/${projectId}/stages/3`,
            {
              headers: getAuthHeaders(),
            }
          );

          if (stage3Response.ok) {
            const stage3Data = await stage3Response.json();

            if (
              stage3Data.data &&
              stage3Data.data.product_ideas &&
              stage3Data.data.product_ideas.length > 0
            ) {
              // Get ideas and set them
              setIdeas(stage3Data.data.product_ideas);

              // Find the selected problem using the problem_id from the first idea
              const selectedProblemId =
                stage3Data.data.product_ideas[0].problem_id;

              if (stageData.data && stageData.data.problem_statements) {
                const selectedProblem = stageData.data.problem_statements.find(
                  (p: any) => p.id === selectedProblemId
                );

                if (selectedProblem) {
                  setProblemStatement(selectedProblem.problem);
                } else {
                  // Check custom problems if not found in main problems
                  const customProblem = stageData.data.custom_problems?.find(
                    (p: any) => p.id === selectedProblemId
                  );

                  if (customProblem) {
                    setProblemStatement(customProblem.problem);
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching problem statement:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
    fetchProblemStatement();
  }, [projectId, apiUrl]);

  const handleIdeaToggle = (id: string) => {
    setExpandedIdea(expandedIdea === id ? null : id);
  };

  // Truncate the research summary for display
  const truncateText = (text: string, maxLength: number = 300) => {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
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
                ${step === 3 ? "bg-[#001DFA]" : "bg-black"}`}
              >
                {step}
              </div>
              {step < 4 && <div className="w-12 h-0.5 bg-black" />}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-12">
        <h2 className="text-4xl font-bold">Ideation</h2>

        {/* Problem Statement Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold">Problem Statement</h3>
            <button
              onClick={() =>
                router.push(
                  projectId
                    ? `/workflow/problem?projectId=${projectId}`
                    : "/workflow/problem"
                )
              }
              className="bg-black text-white px-6 py-2 rounded-[10px] text-lg font-medium"
            >
              Modify Problem
            </button>
          </div>
          <p className="text-gray-600 text-xl">{problemStatement}</p>
        </div>

        {/* Research Summary Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold">Research Summary</h3>
            <button
              onClick={() =>
                router.push(
                  projectId
                    ? `/workflow/upload?projectId=${projectId}`
                    : "/workflow/upload"
                )
              }
              className="bg-black text-white px-6 py-2 rounded-[10px] text-lg font-medium"
            >
              Modify Research
            </button>
          </div>
          <p className="text-gray-600 text-xl">
            {truncateText(researchSummary)}
          </p>
        </div>

        {/* Generated Ideas Section */}
        <div className="space-y-4">
          <h3 className="text-2xl font-bold">Generated Ideas</h3>
          {loading ? (
            <p>Loading ideas...</p>
          ) : (
            ideas.map((idea) => (
              <div key={idea.id} className="border-b border-gray-200">
                <div
                  className="flex items-center justify-between py-4 cursor-pointer"
                  onClick={() => handleIdeaToggle(idea.id)}
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="radio"
                      id={idea.id}
                      name="idea"
                      checked={expandedIdea === idea.id}
                      onChange={() => handleIdeaToggle(idea.id)}
                      className="w-5 h-5"
                    />
                    <label htmlFor={idea.id} className="text-lg cursor-pointer">
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
                  <div className="pb-4 pl-9">
                    <p className="text-gray-600">{idea.detailed_explanation}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Historical Ideas Section */}
        <div className="space-y-4">
          <h3 className="text-2xl font-bold">Historical Ideas</h3>
          <div className="border-b border-gray-200">
            <div
              className="flex items-center justify-between py-4 cursor-pointer"
              onClick={() => setIsHistoricalExpanded(!isHistoricalExpanded)}
            >
              <span className="text-lg">generation 1</span>
              <ChevronDown
                className={`w-6 h-6 transition-transform ${
                  isHistoricalExpanded ? "rotate-180" : ""
                }`}
              />
            </div>
            {isHistoricalExpanded && (
              <div className="pb-4">
                <p className="text-gray-600">
                  Historical ideas from generation 1...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-wrap gap-4 pt-4">
          <button
            onClick={() => {
              if (projectId) {
                fetch(
                  `${apiUrl}/api/projects/${projectId}/stages/3/generate${
                    expandedIdea
                      ? `?selected_problem_id=${ideas[0].problem_id}`
                      : ""
                  }`,
                  {
                    method: "POST",
                    headers: getAuthHeaders(),
                  }
                )
                  .then(() => {
                    router.refresh();
                  })
                  .catch((error) => {
                    console.error("Error regenerating ideas:", error);
                  });
              }
            }}
            className="bg-black text-white px-8 py-3 rounded-[10px] text-xl font-medium
                     hover:opacity-90 transition-opacity"
          >
            Regenerate Idea
          </button>
          <button
            onClick={() =>
              router.push(
                projectId
                  ? `/workflow/report?projectId=${projectId}&solutionId=${expandedIdea}`
                  : "/workflow/report"
              )
            }
            className="bg-[#001DFA] text-white px-8 py-3 rounded-[10px] text-xl font-medium
                     hover:opacity-90 transition-opacity inline-flex items-center gap-2"
            disabled={!expandedIdea}
          >
            Generate report
            <Rocket className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
