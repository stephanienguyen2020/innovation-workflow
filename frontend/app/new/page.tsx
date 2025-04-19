"use client";

import type React from "react";
import { Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";

// Define the backend API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function NewProject() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [problem, setProblem] = useState("");
  const [showWarning, setShowWarning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Check if user is authenticated when the component loads
  useEffect(() => {
    if (!loading && !user) {
      console.warn("User not authenticated, redirecting to login");
      // You can redirect to login page here if needed
      // router.push("/login");
    }
  }, [user, loading, router]);

  const handleStartWorkflow = async () => {
    if (!problem.trim()) {
      setShowWarning(true);
      return;
    }

    // Log user information to help with debugging
    console.log("Current user:", user);

    if (!user || !user.id) {
      setError("User not authenticated. Please log in again.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Get access token from local storage since we know it's there
      let accessToken = "";
      try {
        const userData = localStorage.getItem("innovation_workflow_user");
        if (userData) {
          const parsedUser = JSON.parse(userData);
          accessToken = parsedUser.access_token;
        }
      } catch (e) {
        console.error("Error getting token from storage:", e);
      }

      if (!accessToken) {
        throw new Error("No access token available");
      }

      // Direct fetch to the backend API instead of going through Next.js API routes
      const backendUrl = `${API_URL}/api/projects/?user_id=${user.id}`;
      console.log("Fetching directly from backend:", backendUrl);

      const response = await fetch(backendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          problem_domain: problem,
        }),
      });

      console.log("Backend response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response from backend:", errorText);
        throw new Error(errorText || "Failed to create project");
      }

      const data = await response.json();

      // Log the full response to inspect the structure
      console.log("Project creation response:", JSON.stringify(data, null, 2));

      // Store the project ID from the response
      // Try both _id and id formats to handle different API response structures
      const projectId = data._id || data.id;

      if (!projectId) {
        console.error("Project ID not found in response:", data);
        throw new Error("Project ID not found in response");
      }

      console.log("Using project ID:", projectId);

      // Store the project ID and problem in local storage
      localStorage.setItem("currentProjectId", projectId);
      localStorage.setItem("currentProblem", problem);

      // Navigate to the workflow page
      router.push("/workflow");
    } catch (err) {
      console.error("Error creating project:", err);
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setIsLoading(false);
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
                             showWarning || error
                               ? "border-red-500"
                               : "border-gray-200"
                           }`}
                disabled={isLoading}
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
                className={`inline-flex items-center justify-center gap-2 bg-[#001DFA] text-white rounded-[10px] px-6 py-3 text-lg font-medium
                         transition-transform duration-200 hover:scale-105 active:scale-95 ${
                           isLoading ? "opacity-70 cursor-not-allowed" : ""
                         }`}
                disabled={isLoading}
              >
                {isLoading ? "Creating..." : "start workflow"}
                {!isLoading && <Rocket className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
