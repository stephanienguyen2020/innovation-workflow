"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { getAuthHeaders, createTemporaryAuth } from "@/lib/auth";

interface ProblemStatement {
  id: string;
  title: string;
  description: string;
}

interface StageResponse {
  problemStatements?: ProblemStatement[];
  customProblems?: ProblemStatement[];
  [key: string]: any;
}

interface ProjectResponse {
  _id: string;
  stages: {
    1: { [key: string]: any };
    2: {
      problemStatements?: ProblemStatement[];
      [key: string]: any;
    };
    3: { [key: string]: any };
    4: { [key: string]: any };
  };
  problem_domain: string;
  user_id: string;
  [key: string]: any;
}

export default function ProblemDefinitionPage() {
  const router = useRouter();
  const [selectedProblem, setSelectedProblem] = useState<string>("");
  const [expandedProblem, setExpandedProblem] = useState<string | null>(null);
  const [customProblem, setCustomProblem] = useState("");
  const [customExplanation, setCustomExplanation] = useState("");
  const [showWarning, setShowWarning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const [projectId, setProjectId] = useState<string>("");
  const [problemStatements, setProblemStatements] = useState<
    ProblemStatement[]
  >([]);
  const [error, setError] = useState("");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // For development: Create a temporary user if none exists
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("Creating temporary authentication for development");
        try {
          await createTemporaryAuth();
        } catch (err) {
          console.error("Failed to create temporary auth", err);
        }
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    const storedProjectId = localStorage.getItem("projectId");
    if (storedProjectId) {
      setProjectId(storedProjectId);

      // Try to load from cache first for immediate UI response
      const cachedData = localStorage.getItem(
        `project_${storedProjectId}_stage_2`
      );
      if (cachedData) {
        try {
          const data = JSON.parse(cachedData);
          if (data.problemStatements) {
            setProblemStatements(data.problemStatements);
          }
        } catch (e) {
          console.error("Error parsing cached data:", e);
        }
      }

      // Then fetch from API
      fetchProblemStatements(storedProjectId);
    } else {
      // If no project ID, redirect to create new project
      router.push("/new");
    }
  }, []);

  const fetchProblemStatements = async (id: string) => {
    setLoading(true);
    setError("");

    try {
      // First, check if we need to generate problem statements
      const projectResponse = await fetch(`${apiUrl}/api/projects/${id}`, {
        headers: getAuthHeaders(),
      });

      if (!projectResponse.ok) {
        throw new Error(`HTTP error! Status: ${projectResponse.status}`);
      }

      const projectData: ProjectResponse = await projectResponse.json();
      const stage2 = projectData.stages[2];

      if (
        !stage2 ||
        !stage2.problemStatements ||
        stage2.problemStatements.length === 0
      ) {
        // Generate problem statements
        await generateProblemStatements(id);
      } else {
        // Get existing problem statements
        const response = await fetch(`${apiUrl}/api/projects/${id}/stages/2`, {
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data: StageResponse = await response.json();

        if (data && data.problemStatements) {
          setProblemStatements(data.problemStatements);
          // Cache the data
          localStorage.setItem(`project_${id}_stage_2`, JSON.stringify(data));
        }
      }
    } catch (err) {
      console.error("Error fetching problem statements:", err);
      setError("Failed to load problem statements. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const generateProblemStatements = async (id: string) => {
    try {
      const response = await fetch(
        `${apiUrl}/api/projects/${id}/stages/2/generate`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data: StageResponse = await response.json();

      if (data && data.problemStatements) {
        setProblemStatements(data.problemStatements);
        // Cache the data
        localStorage.setItem(`project_${id}_stage_2`, JSON.stringify(data));
      }
    } catch (err) {
      console.error("Error generating problem statements:", err);
      setError("Failed to generate problem statements. Please try again.");
      throw err;
    }
  };

  const handleProblemSelect = (id: string) => {
    setSelectedProblem(id);
    setExpandedProblem(expandedProblem === id ? null : id);
    if (showWarning) {
      setShowWarning(false);
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

    setGeneratingIdeas(true);
    setError("");

    try {
      if (!projectId) {
        throw new Error("Project ID not found");
      }

      // Call the API to generate ideas based on the selected problem
      let url, response;

      if (selectedProblem === "custom") {
        // Use custom problem statement
        url = `${apiUrl}/api/projects/${projectId}/stages/3/generate?custom_problem=${encodeURIComponent(
          customProblem
        )}`;
      } else {
        // Use selected problem from pre-generated ones
        url = `${apiUrl}/api/projects/${projectId}/stages/3/generate?selected_problem_id=${selectedProblem}`;
      }

      response = await fetch(url, {
        method: "POST",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();

      // Cache the stage 3 data
      if (data) {
        localStorage.setItem(
          `project_${projectId}_stage_3`,
          JSON.stringify(data)
        );
      }

      // Navigate to the ideas page
      router.push("/workflow/ideas");
    } catch (err) {
      console.error("Error generating ideas:", err);
      setError("Failed to generate ideas. Please try again.");
      setGeneratingIdeas(false);
    }
  };

  if (loading && problemStatements.length === 0) {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center">
        <div className="text-2xl">Generating problem statements...</div>
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
                ${step === 2 ? "bg-[#001DFA]" : "bg-black"}`}
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
        <h2 className="text-4xl font-bold">Problem Definition</h2>
        <p className="text-2xl">
          select from the following problem statement or enter your own
        </p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Problem Statements */}
        <div className="space-y-4">
          {problemStatements.map((problem) => (
            <div key={problem.id} className="border-b border-gray-200">
              <div
                className="flex items-center justify-between py-4 cursor-pointer"
                onClick={() => handleProblemSelect(problem.id)}
              >
                <div className="flex items-center gap-4">
                  <input
                    type="radio"
                    id={problem.id}
                    name="problem"
                    checked={selectedProblem === problem.id}
                    onChange={() => handleProblemSelect(problem.id)}
                    className="w-5 h-5"
                  />
                  <label
                    htmlFor={problem.id}
                    className="text-lg cursor-pointer"
                  >
                    {problem.title}
                  </label>
                </div>
                <ChevronDown
                  className={`w-6 h-6 transition-transform ${
                    expandedProblem === problem.id ? "rotate-180" : ""
                  }`}
                />
              </div>
              {expandedProblem === problem.id && (
                <div className="pb-4 pl-9">
                  <p className="text-gray-600">{problem.description}</p>
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
                Enter you own problem:
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
            onClick={() => router.push("/workflow/upload")}
            className="bg-black text-white px-8 py-3 rounded-[10px] text-xl font-medium
                     hover:opacity-90 transition-opacity"
            disabled={generatingIdeas}
          >
            Add more research
          </button>
          <button
            onClick={handleGenerateIdeas}
            disabled={generatingIdeas}
            className="bg-[#001DFA] text-white px-8 py-3 rounded-[10px] text-xl font-medium
                     hover:opacity-90 transition-opacity inline-flex items-center gap-2 disabled:opacity-50"
          >
            {generatingIdeas ? "Generating ideas..." : "Generate ideas"}
            <Rocket className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
