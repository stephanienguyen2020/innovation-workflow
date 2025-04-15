"use client";

import type React from "react";
import { Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { createTemporaryAuth, getAuthHeaders, login } from "@/lib/auth";

interface ProjectResponse {
  _id: string;
  problem_domain: string;
  user_id: string;
  [key: string]: any;
}

export default function NewProject() {
  const router = useRouter();
  const [problem, setProblem] = useState("");
  const [showWarning, setShowWarning] = useState(false);
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

  const handleStartWorkflow = async () => {
    if (!problem.trim()) {
      setShowWarning(true);
      return;
    }

    setLoading(true);
    setError("");

    try {
      // ===== DEVELOPMENT MODE BYPASS =====
      // Instead of trying to authenticate properly, for development purposes,
      // we'll store the problem domain in localStorage and redirect to the workflow page

      // Generate a mock project ID
      const mockProjectId = `dev-project-${Date.now()}`;
      localStorage.setItem("projectId", mockProjectId);
      localStorage.setItem("currentProblem", problem);

      // Create a mock project response
      const mockProject = {
        _id: mockProjectId,
        problem_domain: problem,
        user_id: localStorage.getItem("userId") || `temp-${Date.now()}`,
        stages: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Store mock project data
      localStorage.setItem(
        `project_${mockProjectId}`,
        JSON.stringify(mockProject)
      );

      // Navigate to workflow page
      router.push("/workflow");
      return;

      /* Comment out the real API call for now - can be uncommented when backend is ready
      // Get the user ID from localStorage
      const userId = localStorage.getItem("userId");
      const token = localStorage.getItem("token");

      if (!userId || !token) {
        // No user ID or token means we're not authenticated properly
        console.log("Authentication missing. Attempting to authenticate");
        
        try {
          // First try to use the dev login
          await createTemporaryAuth();
          
          // If that didn't work, try a fallback login with dev credentials
          if (!localStorage.getItem("token")) {
            await login("dev@example.com", "password123");
          }
          
          // Check if we got a token this time
          if (!localStorage.getItem("token")) {
            setError("Authentication failed. Unable to get a valid token.");
            setLoading(false);
            return;
          }
        } catch (authErr) {
          console.error("Authentication error:", authErr);
          setError("Authentication failed. Please try again later.");
          setLoading(false);
          return;
        }
      }

      // Call API to create a new project with the correct API path and user_id as query param
      const currentUserId = localStorage.getItem("userId");
      const response = await fetch(
        `${apiUrl}/api/projects/?user_id=${currentUserId}`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            problem_domain: problem,
          }),
        }
      );

      // Handle auth errors
      if (response.status === 401 || response.status === 403) {
        // If we get an unauthorized error, try to authenticate again
        console.log("Authentication failed. Attempting to re-authenticate");
        
        // Clear existing auth data
        localStorage.removeItem("token");
        
        try {
          // Try to login with dev credentials
          await login("dev@example.com", "password123");
          
          // Try the request again with the new token
          const newToken = localStorage.getItem("token");
          if (newToken) {
            const retryResponse = await fetch(
              `${apiUrl}/api/projects/?user_id=${currentUserId}`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${newToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  problem_domain: problem,
                }),
              }
            );
            
            if (retryResponse.ok) {
              const data: ProjectResponse = await retryResponse.json();
              
              // Store project ID in localStorage for access across pages
              const projectId = data._id;
              localStorage.setItem("projectId", projectId);
              localStorage.setItem("currentProblem", problem);
              
              // Store initial project data in localStorage for faster access
              localStorage.setItem(`project_${projectId}`, JSON.stringify(data));
              
              // Navigate to workflow page
              router.push("/workflow");
              return;
            } else {
              const errorData = await retryResponse.text();
              console.error("Retry error response:", errorData);
              throw new Error(`HTTP error! Status: ${retryResponse.status}`);
            }
          }
        } catch (retryErr) {
          console.error("Retry authentication failed:", retryErr);
        }
        
        setError("Authentication failed. Please try refreshing the page");
        setLoading(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Error response:", errorData);
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data: ProjectResponse = await response.json();

      // Store project ID in localStorage for access across pages
      const projectId = data._id;
      localStorage.setItem("projectId", projectId);
      localStorage.setItem("currentProblem", problem);

      // Store initial project data in localStorage for faster access
      localStorage.setItem(`project_${projectId}`, JSON.stringify(data));

      // Navigate to workflow page
      router.push("/workflow");
      */
    } catch (err) {
      console.error("Error creating project:", err);
      setError("Failed to create project. Please try again.");
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProblem(e.target.value);
    if (showWarning) {
      setShowWarning(false);
    }
    if (error) {
      setError("");
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen p-6 flex flex-col">
        {/* Main Content - Centered */}
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-3xl w-full space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">
              What <span className="font-black">problem</span> are you solving?
            </h2>

            <div className="space-y-2">
              <input
                type="text"
                value={problem}
                onChange={handleInputChange}
                placeholder="Enter here"
                className={`w-full p-4 text-lg border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#001DFA]
                           ${
                             showWarning ? "border-red-500" : "border-gray-200"
                           }`}
                disabled={loading}
              />
              <div className="min-h-[24px]">
                {showWarning && (
                  <p className="text-red-500 text-sm animate-fade-in">
                    Please enter a problem before continuing
                  </p>
                )}
                {error && (
                  <p className="text-red-500 text-sm animate-fade-in">
                    {error}
                  </p>
                )}
                {!showWarning && !error && (
                  <p className="text-gray-600">
                    Enter the problem domain you are targeting e.g. elderly
                    healthcare, E-Commerce, food delivery etc.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-8">
              <button
                onClick={handleStartWorkflow}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 bg-[#001DFA] text-white rounded-[10px] px-6 py-3 text-lg font-medium
                         transition-transform duration-200 hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                {loading ? "Creating project..." : "start workflow"}
                <Rocket className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
