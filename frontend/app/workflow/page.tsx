"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAuthHeaders, createTemporaryAuth } from "@/lib/auth";

interface ProjectStage {
  analysis?: string;
  problemStatements?: any[];
  productIdeas?: any[];
  finalReport?: any;
  completed: boolean;
}

interface Project {
  _id: string;
  stages: {
    1: ProjectStage;
    2: ProjectStage;
    3: ProjectStage;
    4: ProjectStage;
  };
  problem_domain: string;
  user_id: string;
}

export default function WorkflowPage() {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string>("");
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
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

      // Try to load project from localStorage first for immediate UI response
      const cachedProject = localStorage.getItem(`project_${storedProjectId}`);
      if (cachedProject) {
        try {
          const parsedProject = JSON.parse(cachedProject);
          setProject(parsedProject);

          // For development mode, don't try to fetch from API if we have cached data
          const isDev = process.env.NODE_ENV === "development";
          if (!isDev || !parsedProject._id.startsWith("dev-project-")) {
            // Only fetch from API if not in dev mode or not using a mock project
            fetchProject(storedProjectId);
          }
        } catch (e) {
          console.error("Error parsing cached project:", e);

          // If we can't parse the cached project, try fetching
          fetchProject(storedProjectId);
        }
      } else {
        // No cached data, try fetching
        fetchProject(storedProjectId);
      }
    } else {
      // Redirect to new project page if no project is in progress
      router.push("/new");
    }
  }, []);

  const fetchProject = async (id: string) => {
    // Skip API calls for dev-project IDs
    if (id.startsWith("dev-project-")) {
      console.log("Using local mock project data for development");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${apiUrl}/api/projects/${id}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data: Project = await response.json();
      setProject(data);

      // Cache the project data in localStorage for faster access
      localStorage.setItem(`project_${id}`, JSON.stringify(data));
    } catch (err) {
      console.error("Error fetching project:", err);
      // Don't set error if we have a cached project already displayed
      if (!project) {
        setError("Failed to load project data.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getStageStatus = (
    stageNum: number
  ): "active" | "completed" | "pending" => {
    if (!project) return "pending";

    const stage = project.stages[stageNum as keyof typeof project.stages];

    if (stage && stage.completed) {
      return "completed";
    }

    // Check if previous stage is completed
    if (stageNum === 1) return "active";
    const prevStage =
      project.stages[(stageNum - 1) as keyof typeof project.stages];

    return prevStage && prevStage.completed ? "active" : "pending";
  };

  const navigateToStage = (stageNum: number) => {
    const status = getStageStatus(stageNum);

    if (status === "pending") {
      return; // Don't navigate to pending stages
    }

    switch (stageNum) {
      case 1:
        router.push("/workflow/upload");
        break;
      case 2:
        router.push("/workflow/problem");
        break;
      case 3:
        router.push("/workflow/ideas");
        break;
      case 4:
        router.push("/workflow/report");
        break;
    }
  };

  if (loading && !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">Loading project...</div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 flex flex-col">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-6xl font-bold">Innovation Workflow</h1>
        {project && (
          <p className="text-xl mt-4">
            Problem Domain: {project.problem_domain}
          </p>
        )}
      </div>

      {/* Workflow Steps */}
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-4xl w-full space-y-6">
          {/* Upload Interview */}
          <div className="flex items-center gap-4">
            <span className="text-xl font-medium w-32"></span>
            <div className="flex-1 flex justify-center">
              <button
                onClick={() => navigateToStage(1)}
                className={`w-[80%] text-white text-2xl font-medium py-6 rounded-[10px] hover:opacity-90 transition-opacity
                  ${
                    getStageStatus(1) === "completed"
                      ? "bg-green-600"
                      : "bg-black"
                  }`}
              >
                Upload Interview
              </button>
            </div>
            <div className="w-32"></div> {/* Spacer to balance layout */}
          </div>

          {/* Define Problem */}
          <div className="flex items-center gap-4">
            <div className="w-32"></div> {/* Spacer for consistent layout */}
            <div className="flex-1 flex justify-center">
              <button
                onClick={() => navigateToStage(2)}
                className={`w-[70%] text-white text-2xl font-medium py-6 rounded-[10px] hover:opacity-90 transition-opacity
                  ${
                    getStageStatus(2) === "completed"
                      ? "bg-green-600"
                      : getStageStatus(2) === "active"
                      ? "bg-black"
                      : "bg-[#666666] cursor-not-allowed"
                  }`}
              >
                Define Problem
              </button>
            </div>
            <div className="w-32"></div> {/* Spacer to balance layout */}
          </div>

          {/* Generate Ideas */}
          <div className="flex items-center gap-4">
            <span className="text-xl font-medium w-32"></span>
            <div className="flex-1 flex justify-center">
              <button
                onClick={() => navigateToStage(3)}
                className={`w-[60%] text-white text-2xl font-medium py-6 rounded-[10px] hover:opacity-90 transition-opacity
                  ${
                    getStageStatus(3) === "completed"
                      ? "bg-green-600"
                      : getStageStatus(3) === "active"
                      ? "bg-black"
                      : "bg-[#808080] cursor-not-allowed"
                  }`}
              >
                Generate Ideas
              </button>
            </div>
            <div className="w-32"></div> {/* Spacer to balance layout */}
          </div>

          {/* Final Report */}
          <div className="flex items-center gap-4">
            <div className="w-32"></div> {/* Spacer for consistent layout */}
            <div className="flex-1 flex justify-center">
              <button
                onClick={() => navigateToStage(4)}
                className={`w-[50%] text-white text-2xl font-medium py-6 rounded-[10px] hover:opacity-90 transition-opacity
                  ${
                    getStageStatus(4) === "completed"
                      ? "bg-green-600"
                      : getStageStatus(4) === "active"
                      ? "bg-black"
                      : "bg-[#B3B3B3] cursor-not-allowed"
                  }`}
              >
                Final Report
              </button>
            </div>
            <div className="w-32"></div> {/* Spacer to balance layout */}
          </div>
        </div>
      </div>
    </div>
  );
}
