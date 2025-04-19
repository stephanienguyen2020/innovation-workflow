"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Upload, Rocket } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

// Define the backend API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function UploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUploadStatus, setFileUploadStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{ name: string; uploadedAt: string }>
  >([]);

  useEffect(() => {
    // Get the project ID from URL params or localStorage as fallback
    const projectIdFromUrl = searchParams.get("projectId");
    const storedProjectId = localStorage.getItem("currentProjectId");

    if (projectIdFromUrl) {
      setProjectId(projectIdFromUrl);
    } else if (storedProjectId) {
      setProjectId(storedProjectId);
    } else {
      // Redirect to workflow page if no project ID is found
      router.push("/workflow");
    }
  }, [searchParams, router]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type (PDF only)
      if (file.type !== "application/pdf") {
        setError("Only PDF files are supported");
        setSelectedFile(null);
        return;
      }

      setSelectedFile(file);
      setError(null);
      console.log("File selected:", file.name);
    }
  };

  const handleUploadToServer = async () => {
    if (!selectedFile) {
      setError("Please select a file to upload");
      return;
    }

    if (!projectId) {
      setError("Project ID is missing");
      return;
    }

    if (!user) {
      setError("You must be logged in to upload files");
      return;
    }

    setFileUploadStatus("Uploading...");
    setError(null);

    // Get access token from local storage
    let accessToken = "";
    let tokenType = "bearer";
    try {
      const userData = localStorage.getItem("innovation_workflow_user");
      if (userData) {
        const parsedUser = JSON.parse(userData);
        accessToken = parsedUser.access_token;
        tokenType = parsedUser.token_type || "bearer";
      }
    } catch (e) {
      console.error("Error getting token from storage:", e);
      setError("Could not retrieve authentication token");
      setFileUploadStatus(null);
      return null;
    }

    if (!accessToken) {
      setError("No access token available");
      setFileUploadStatus(null);
      return null;
    }

    // Create a FormData object to send the file
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      // Upload directly to the backend (not through Next.js API route)
      const backendUrl = `${API_URL}/projects/${projectId}/stages/1/upload`;
      console.log(`Uploading file directly to backend: ${backendUrl}`);

      const response = await fetch(backendUrl, {
        method: "POST",
        headers: {
          Authorization: `${tokenType} ${accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Upload failed:", errorText);
        if (response.status === 401 || response.status === 403) {
          setError("Authentication failed. Please log in again.");
          // You might want to trigger a logout or redirect to login here
          return null;
        }
        throw new Error(errorText || "Failed to upload file");
      }

      const data = await response.json();
      console.log("Upload response data:", data);

      setFileUploadStatus("Upload successful");

      // Add the uploaded file to the list
      setUploadedFiles((prev) => [
        ...prev,
        {
          name: selectedFile.name,
          uploadedAt: new Date().toLocaleString(),
        },
      ]);

      // Clear the selected file
      setSelectedFile(null);

      return data;
    } catch (err) {
      console.error("Error uploading file:", err);
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      setFileUploadStatus(null);
      return null;
    }
  };

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const handleGenerateAnalysis = async () => {
    if (!projectId) {
      setError("Project ID is missing");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // If we have a file but haven't uploaded it yet, upload it first
      if (selectedFile && fileUploadStatus !== "Upload successful") {
        const uploadResult = await handleUploadToServer();
        if (!uploadResult) {
          throw new Error("File upload failed");
        }
      }

      // Get access token from local storage
      let accessToken = "";
      let tokenType = "bearer";
      try {
        const userData = localStorage.getItem("innovation_workflow_user");
        if (userData) {
          const parsedUser = JSON.parse(userData);
          accessToken = parsedUser.access_token;
          tokenType = parsedUser.token_type || "bearer";
        }
      } catch (e) {
        console.error("Error getting token from storage:", e);
        throw new Error("Could not retrieve authentication token");
      }

      if (!accessToken) {
        throw new Error("No access token available");
      }

      // Wait for document processing (5 seconds)
      await delay(5000);

      // Call the Stage 1 Part 2 API endpoint with retries
      const backendUrl = `${API_URL}/projects/${projectId}/stages/1/generate`;
      console.log("Generating analysis using:", backendUrl);

      let retries = 3;
      let analysisData = null;

      while (retries > 0 && !analysisData) {
        try {
          const response = await fetch(backendUrl, {
            method: "POST",
            headers: {
              Authorization: `${tokenType} ${accessToken}`,
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("Analysis generation failed:", errorText);
            if (response.status === 401 || response.status === 403) {
              throw new Error("Authentication failed. Please log in again.");
            }
            throw new Error(errorText || "Failed to generate analysis");
          }

          const data = await response.json();
          console.log("Analysis response:", data);

          // Check if we got a proper analysis
          if (data?.data?.analysis) {
            analysisData = data;
            break;
          }

          // If no proper analysis, wait and retry
          console.log("Waiting for document processing...");
          await delay(3000);
          retries--;
        } catch (err) {
          console.error("Error in analysis attempt:", err);
          retries--;
          if (retries > 0) {
            await delay(3000);
          } else {
            throw err;
          }
        }
      }

      if (!analysisData) {
        throw new Error("Failed to generate analysis after multiple attempts");
      }

      setAnalysis(analysisData.data.analysis);
    } catch (err) {
      console.error("Error generating analysis:", err);
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      setAnalysis(""); // Clear any previous analysis on error
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen p-6 flex flex-col max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-4 mb-8">
          <h1 className="text-4xl md:text-6xl font-bold">
            Innovation Workflow
          </h1>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-0 mt-6">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white
                  ${step === 1 ? "bg-[#001DFA]" : "bg-black"}`}
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
          <h2 className="text-4xl font-bold">Interview Transcript Analysis</h2>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-8">
            {/* Upload Section */}
            <div className="space-y-2">
              <h3 className="text-2xl font-bold">Upload PDF document</h3>
              <div className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center min-h-[300px]">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={handleFileUpload}
                  accept=".pdf"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center space-y-4"
                >
                  <Upload className="w-12 h-12" />
                  <span className="text-xl font-medium">Upload PDF</span>
                  {selectedFile && (
                    <span className="text-green-600">{selectedFile.name}</span>
                  )}
                  {fileUploadStatus && (
                    <span
                      className={`${
                        fileUploadStatus.includes("successful")
                          ? "text-green-600"
                          : "text-blue-600"
                      }`}
                    >
                      {fileUploadStatus}
                    </span>
                  )}
                </label>
              </div>

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="mt-6 bg-white rounded-lg p-4">
                  <h4 className="text-xl font-medium mb-4">Uploaded files:</h4>
                  <div className="space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded"
                      >
                        <span className="text-base">{file.name}</span>
                        <button
                          onClick={() => handleDeleteFile(index)}
                          className="text-gray-400 hover:text-gray-600"
                          aria-label="Delete file"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Text Input Section */}
            <div className="space-y-2">
              <h3 className="text-2xl font-bold">Paste copied text</h3>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="paste text here*"
                className="w-full h-[300px] p-4 border rounded-lg resize-none"
              />
            </div>
          </div>

          {/* Generate Analysis Button */}
          <div className="flex justify-start">
            <button
              onClick={handleGenerateAnalysis}
              disabled={isAnalyzing || (!selectedFile && !pastedText)}
              className="bg-black text-white px-8 py-3 rounded-[10px] text-xl font-medium
                      hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isAnalyzing ? "Analyzing..." : "Generate Analysis"}
            </button>
          </div>

          {/* Analysis Results */}
          {analysis && (
            <div className="space-y-4">
              <h3 className="text-3xl font-bold">Analysis Results:</h3>
              <div className="p-4 border rounded-lg bg-gray-50">
                <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                  {analysis}
                </p>
              </div>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="flex flex-wrap gap-4 justify-start mt-8">
            <button
              onClick={() => router.push("/workflow")}
              className="bg-black text-white px-8 py-3 rounded-[10px] text-xl font-medium
                      hover:opacity-90 transition-opacity"
            >
              Return Home
            </button>
            <button
              onClick={() =>
                router.push(`/workflow/problem?projectId=${projectId}`)
              }
              className="bg-[#001DFA] text-white px-8 py-3 rounded-[10px] text-xl font-medium
                      hover:opacity-90 transition-opacity inline-flex items-center gap-2"
              disabled={!analysis}
            >
              Define Problems
              <Rocket className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
