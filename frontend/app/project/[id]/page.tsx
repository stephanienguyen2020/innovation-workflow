"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Loader2 } from "lucide-react";

interface Stage {
  stage_number: number;
  status: string;
  data: {
    analysis?: string;
    problem_statements?: Array<{
      id: string;
      problem: string;
      explanation: string;
    }>;
    product_ideas?: Array<{
      id: string;
      idea: string;
      detailed_explanation: string;
    }>;
    chosen_problem?: {
      id: string;
      problem: string;
      explanation: string;
    };
    chosen_solution?: {
      id: string;
      idea: string;
      explanation: string;
    };
    [key: string]: any;
  };
}

interface Project {
  _id: string;
  problem_domain: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  status: string;
  stages?: {
    [key: number]: Stage;
  };
}

export default function ProjectDetailsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [stages, setStages] = useState<Record<number, Stage>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<number>(1);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/project");
      return;
    }

    const projectId = params.id as string;
    if (projectId && user) {
      fetchProjectDetails(projectId);
    }
  }, [params.id, user, authLoading, router]);

  const fetchProjectDetails = async (projectId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch the project details
      const projectResponse = await fetch(`/api/projects/${projectId}`);

      if (!projectResponse.ok) {
        throw new Error("Failed to fetch project details");
      }

      const projectData = await projectResponse.json();
      setProject(projectData);

      // Fetch all stages (1-4)
      const stagesData: Record<number, Stage> = {};

      for (let stageNumber = 1; stageNumber <= 4; stageNumber++) {
        try {
          const stageResponse = await fetch(
            `/api/projects/${projectId}/stages/${stageNumber}`
          );

          if (stageResponse.ok) {
            const stageData = await stageResponse.json();
            stagesData[stageNumber] = stageData;
          }
        } catch (stageError) {
          console.error(`Error fetching stage ${stageNumber}:`, stageError);
          // Continue with other stages even if one fails
        }
      }

      setStages(stagesData);
    } catch (err) {
      console.error("Error fetching project details:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Render stage content based on the stage number and data
  const renderStageContent = (stageNumber: number) => {
    const stage = stages[stageNumber];

    if (!stage) {
      return (
        <div className="py-4 text-gray-500">
          No data available for this stage.
        </div>
      );
    }

    switch (stageNumber) {
      case 1: // Interview Analysis
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Interview Analysis</h3>
            {stage.data.analysis ? (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="whitespace-pre-line">{stage.data.analysis}</p>
              </div>
            ) : (
              <p className="text-gray-500">No analysis available.</p>
            )}
          </div>
        );

      case 2: // Problem Statements
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Problem Statements</h3>
            {stage.data.problem_statements &&
            stage.data.problem_statements.length > 0 ? (
              <div className="space-y-4">
                {stage.data.problem_statements.map((problem, index) => (
                  <div key={problem.id} className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium">
                      {index + 1}. {problem.problem}
                    </p>
                    <p className="text-gray-700 mt-2">{problem.explanation}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No problem statements available.</p>
            )}
          </div>
        );

      case 3: // Product Ideas
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Product Ideas</h3>
            {stage.data.product_ideas && stage.data.product_ideas.length > 0 ? (
              <div className="space-y-4">
                {stage.data.product_ideas.map((idea, index) => (
                  <div key={idea.id} className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium">
                      {index + 1}. {idea.idea}
                    </p>
                    <p className="text-gray-700 mt-2">
                      {idea.detailed_explanation}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No product ideas available.</p>
            )}
          </div>
        );

      case 4: // Final Report
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Final Report</h3>
            <div className="bg-gray-50 p-4 rounded-lg space-y-4">
              {stage.data.chosen_problem ? (
                <div>
                  <h4 className="font-medium">Chosen Problem:</h4>
                  <p>{stage.data.chosen_problem.problem}</p>
                  <p className="text-gray-700 mt-2">
                    {stage.data.chosen_problem.explanation}
                  </p>
                </div>
              ) : (
                <p className="text-gray-500">No chosen problem available.</p>
              )}

              {stage.data.chosen_solution ? (
                <div className="mt-4">
                  <h4 className="font-medium">Chosen Solution:</h4>
                  <p>{stage.data.chosen_solution.idea}</p>
                  <p className="text-gray-700 mt-2">
                    {stage.data.chosen_solution.explanation}
                  </p>
                </div>
              ) : (
                <p className="text-gray-500">No chosen solution available.</p>
              )}
            </div>
          </div>
        );

      default:
        return <p className="text-gray-500">No content available.</p>;
    }
  };

  if (loading || authLoading) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Project Details</h1>
            <button
              onClick={() => router.push("/new")}
              className="inline-flex items-center justify-center bg-[#001DFA] text-white rounded-[10px] px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              Start New Project
            </button>
          </div>
          <div className="bg-white rounded-lg shadow p-8 flex justify-center items-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="ml-2 text-gray-600">Loading project details...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !project) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Project Details</h1>
            <button
              onClick={() => router.push("/new")}
              className="inline-flex items-center justify-center bg-[#001DFA] text-white rounded-[10px] px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              Start New Project
            </button>
          </div>
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-red-500">
              {error || "Project not found or failed to load."}
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">{project.problem_domain}</h1>
          <div className="flex gap-4">
            <button
              onClick={() => {
                // Find if there's any solution ID available in stage 3 or 4
                let solutionId = null;

                // Check stage 4 for a chosen solution
                if (stages[4]?.data?.chosen_solution?.id) {
                  solutionId = stages[4].data.chosen_solution.id;
                }
                // Otherwise check stage 3 for any product ideas
                else if (
                  stages[3]?.data?.product_ideas &&
                  stages[3].data.product_ideas.length > 0
                ) {
                  solutionId = stages[3].data.product_ideas[0].id;
                }

                if (solutionId) {
                  router.push(
                    `/workflow/report?projectId=${project._id}&solutionId=${solutionId}`
                  );
                } else {
                  alert(
                    "No solution found. Please complete the idea generation step first."
                  );
                  router.push(`/workflow/ideas?projectId=${project._id}`);
                }
              }}
              className="inline-flex items-center justify-center bg-black text-white rounded-[10px] px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              Edit Project
            </button>
            <button
              onClick={() => router.push("/new")}
              className="inline-flex items-center justify-center bg-[#001DFA] text-white rounded-[10px] px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              Start New Project
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Project Overview */}
          <div className="p-6 border-b">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="font-medium capitalize">
                  {project.status.replace("_", " ")}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="font-medium">{formatDate(project.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Last Modified</p>
                <p className="font-medium">{formatDate(project.updated_at)}</p>
              </div>
            </div>
          </div>

          {/* Tabs for Stages */}
          <div className="border-b">
            <div className="flex overflow-x-auto">
              {[1, 2, 3, 4].map((stageNumber) => (
                <button
                  key={stageNumber}
                  onClick={() => setActiveTab(stageNumber)}
                  className={`px-6 py-3 text-sm font-medium whitespace-nowrap ${
                    activeTab === stageNumber
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Stage {stageNumber}
                  <span className="ml-2 text-xs px-2 py-1 rounded-full bg-gray-100">
                    {stages[stageNumber]?.status || "unknown"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Stage Content */}
          <div className="p-6">{renderStageContent(activeTab)}</div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
