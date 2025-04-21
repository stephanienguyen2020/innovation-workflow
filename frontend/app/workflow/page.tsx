"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";

export default function WorkflowPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Handle authentication and data loading
  useEffect(() => {
    const initializePage = () => {
      if (authLoading) return;

      if (!user) {
        window.location.href = "/login?redirect=/workflow";
        return;
      }

      // Get data from localStorage
      const storedProjectId = localStorage.getItem("currentProjectId");
      const storedProblem = localStorage.getItem("currentProblem");

      console.log("Retrieved from localStorage - Project ID:", storedProjectId);
      console.log("Retrieved from localStorage - Problem:", storedProblem);

      if (!storedProjectId) {
        console.warn("No project ID found in localStorage, redirecting to /new");
        window.location.href = "/new";
        return;
      }

      // Update state
      setProjectId(storedProjectId);
      setProblem(storedProblem);
      setIsLoading(false);
      setIsInitialized(true);
    };

    // Run initialization
    if (!isInitialized) {
      initializePage();
    }
  }, [user, authLoading, isInitialized]);

  // Show loading state
  if (isLoading || authLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl">Loading workflow...</p>
      </div>
    );
  }

  // Only render the main content when everything is ready
  if (!projectId || !problem) {
    return null;
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen p-10 flex flex-col">
        {/* Header with Problem Domain */}
        <h1 className="text-4xl md:text-6xl font-bold text-center mb-5">
          Problem Domain
        </h1>
        <p className="text-4xl text-center">{problem || "Not specified"}</p>

        {/* Workflow Steps */}
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-4xl w-full space-y-6">
            {/* Upload Interview */}
            <div className="flex items-center gap-4">
              <span className="text-xl font-medium w-32"></span>
              <div className="flex-1 flex justify-center">
                <button
                  onClick={() =>
                    router.push(`/workflow/upload?projectId=${projectId}`)
                  }
                  className="w-[80%] bg-black text-white text-2xl font-medium py-6 rounded-[10px] hover:opacity-90 transition-opacity"
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
                  className="w-[70%] bg-[#666666] text-white text-2xl font-medium py-6 rounded-[10px] hover:opacity-90 transition-opacity"
                  disabled
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
                  className="w-[60%] bg-[#808080] text-white text-2xl font-medium py-6 rounded-[10px] hover:opacity-90 transition-opacity"
                  disabled
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
                  className="w-[50%] bg-[#B3B3B3] text-white text-2xl font-medium py-6 rounded-[10px] hover:opacity-90 transition-opacity"
                  disabled
                >
                  Final Report
                </button>
              </div>
              <div className="w-32"></div> {/* Spacer to balance layout */}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
