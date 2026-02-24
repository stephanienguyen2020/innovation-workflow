"use client";

export const dynamic = "force-dynamic";

import type React from "react";
import { useState, useEffect, Suspense } from "react";
import { Upload, Rocket, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

// Define the backend API URL - must be configured via environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL;

function renderMarkdown(text: string) {
  return text.split("\n").map((line, lineIdx, arr) => {
    const parts = line.split("**");
    return (
      <span key={lineIdx}>
        {parts.map((part, i) =>
          i % 2 === 1 ? <strong key={i}>{part}</strong> : part
        )}
        {lineIdx < arr.length - 1 && "\n"}
      </span>
    );
  });
}

function UploadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fileUploadStatus, setFileUploadStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{ name: string; uploadedAt: string }>
  >([]);
  const [isRestoringState, setIsRestoringState] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    // Get the project ID from URL params or localStorage as fallback
    const projectIdFromUrl = searchParams.get("projectId");
    const storedProjectId = localStorage.getItem("currentProjectId");

    if (projectIdFromUrl) {
      setProjectId(projectIdFromUrl);

      // Try to restore state from localStorage for this project
      restoreStateFromLocalStorage(projectIdFromUrl);
    } else if (storedProjectId) {
      setProjectId(storedProjectId);

      // Try to restore state from localStorage for this project
      restoreStateFromLocalStorage(storedProjectId);
    } else {
      // Redirect to workflow page if no project ID is found
      router.push("/workflow");
    }
  }, [searchParams, router]);

  // Save current state to localStorage when analysis changes
  useEffect(() => {
    if (projectId && (analysis || uploadedFiles.length > 0)) {
      saveStateToLocalStorage();
    }
  }, [analysis, uploadedFiles, projectId]);

  const saveStateToLocalStorage = () => {
    if (!projectId) return;

    try {
      const stateToSave = {
        analysis,
        uploadedFiles,
        lastUpdated: new Date().toISOString(),
      };

      localStorage.setItem(
        `project_${projectId}_upload_state`,
        JSON.stringify(stateToSave)
      );
      console.log("Saved state to localStorage:", stateToSave);
    } catch (error) {
      console.error("Error saving state to localStorage:", error);
    }
  };

  const restoreStateFromLocalStorage = (projectId: string) => {
    try {
      setIsRestoringState(true);
      const savedState = localStorage.getItem(
        `project_${projectId}_upload_state`
      );

      if (savedState) {
        const parsedState = JSON.parse(savedState);
        console.log("Restoring state from localStorage:", parsedState);

        if (parsedState.analysis) {
          setAnalysis(parsedState.analysis);
        }

        if (parsedState.uploadedFiles && parsedState.uploadedFiles.length > 0) {
          setUploadedFiles(parsedState.uploadedFiles);
        }
      }
    } catch (error) {
      console.error("Error restoring state from localStorage:", error);
    } finally {
      setIsRestoringState(false);
    }
  };

  const getAuthToken = () => {
    try {
      const userData = localStorage.getItem("innovation_workflow_user");
      if (userData) {
        const parsedUser = JSON.parse(userData);
        return {
          accessToken: parsedUser.access_token,
          tokenType: parsedUser.token_type || "bearer",
        };
      }
    } catch (e) {
      console.error("Error getting token from storage:", e);
      return null;
    }
    return null;
  };

  const handleUploadToServer = async (file: File) => {
    if (!file) {
      setError("No file to upload");
      return null;
    }

    if (!projectId) {
      setError("Project ID is missing");
      return null;
    }

    if (!user) {
      setError("You must be logged in to upload files");
      return null;
    }

    setIsUploading(true);
    setFileUploadStatus("Uploading...");
    setError(null);

    // Get access token from local storage
    const auth = getAuthToken();
    if (!auth) {
      setError("Authentication failed. Please log in again.");
      setIsUploading(false);
      setFileUploadStatus(null);
      return null;
    }

    // Create a FormData object to send the file
    const formData = new FormData();
    formData.append("file", file);

    try {
      // Upload through Next.js API route
      const uploadUrl = `/api/projects/${projectId}/upload`;
      console.log(`Uploading file via API route: ${uploadUrl}`);

      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Upload failed:", errorText);
        if (response.status === 401 || response.status === 403) {
          setError("Authentication failed. Please log in again.");
          return null;
        }
        throw new Error(errorText || "Failed to upload file");
      }

      const data = await response.json();
      console.log("Upload response data:", data);

      setFileUploadStatus("Upload successful");

      // Add the uploaded file to the list
      const newUploadedFiles = [
        ...uploadedFiles,
        {
          name: file.name,
          uploadedAt: new Date().toLocaleString(),
        },
      ];

      setUploadedFiles(newUploadedFiles);

      return data;
    } catch (err) {
      console.error("Error uploading file:", err);
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      setFileUploadStatus(null);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type (PDF only)
      if (file.type !== "application/pdf") {
        setError("Only PDF files are supported");
        return;
      }

      setError(null);
      console.log("File selected:", file.name);

      // Automatically upload the file when selected
      await handleUploadToServer(file);
    }
  };

  const handleUploadText = async (text: string) => {
    if (!projectId) {
      setError("Project ID is missing");
      return false;
    }

    const auth = getAuthToken();
    if (!auth) {
      setError("Authentication failed. Please log in again.");
      return false;
    }

    try {
      const uploadTextUrl = `/api/projects/${projectId}/upload-text`;
      const response = await fetch(uploadTextUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Text upload failed:", errorText);
        throw new Error(errorText || "Failed to upload text");
      }

      return true;
    } catch (err) {
      console.error("Error uploading text:", err);
      setError(err instanceof Error ? err.message : "Failed to upload text");
      return false;
    }
  };

  const handleGenerateAnalysis = async () => {
    if (!projectId) {
      setError("Project ID is missing");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysis("");

    try {
      // If no PDF uploaded but text is pasted, upload the text first
      if (uploadedFiles.length === 0 && pastedText.trim()) {
        const textUploaded = await handleUploadText(pastedText.trim());
        if (!textUploaded) {
          setIsAnalyzing(false);
          return;
        }
      }

      const proxyUrl = `/api/projects/${projectId}/stages/1/generate`;

      const response = await fetch(proxyUrl, {
        method: "POST",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Analysis generation failed:", errorText);
        if (response.status === 401 || response.status === 403) {
          throw new Error("Authentication failed. Please log in again.");
        }
        throw new Error(errorText || "Failed to generate analysis");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Streaming not supported");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let streamedAnalysis = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);

              if (eventType === "chunk" && data.text) {
                streamedAnalysis += data.text;
                setAnalysis(streamedAnalysis);
              } else if (eventType === "done" && data.analysis) {
                setAnalysis(data.analysis);
                streamedAnalysis = data.analysis;
              } else if (eventType === "error") {
                throw new Error(data.message || "Analysis failed");
              }
            } catch (parseErr) {
              if (eventType === "error") {
                throw parseErr;
              }
            }
          }
        }
      }

      if (!streamedAnalysis) {
        throw new Error("No analysis data received from the server");
      }
    } catch (err) {
      console.error("Error generating analysis:", err);
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      setAnalysis("");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen p-6 flex flex-col max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl md:text-6xl font-bold">
            Innovation Workflow
          </h1>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-0 mt-6">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white
                  ${step === 1 ? "bg-[#001DFA]" : "bg-black"}
                  cursor-pointer hover:opacity-80 transition-opacity`}
                  onClick={() => {
                    // Save current state before navigating
                    saveStateToLocalStorage();

                    if (!projectId) {
                      setError("Project ID is missing. Please start a new project.");
                      return;
                    }

                    // Navigate to the corresponding page based on step number
                    if (step === 1) {
                      // Current page (upload)
                      return;
                    } else if (step === 2) {
                      router.push(`/workflow/problem?projectId=${projectId}`);
                    } else if (step === 3) {
                      // We'll just navigate to the ideas page without problem ID
                      // The ideas page will handle fetching the problem ID if needed
                      router.push(`/workflow/ideas?projectId=${projectId}`);
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
                            // Stage 4 doesn't exist, need to define problem and select idea first
                            alert(
                              "You need to define a problem and select an idea before generating a report. Redirecting to the problems page."
                            );
                            router.push(
                              `/workflow/problem?projectId=${projectId}`
                            );
                          }
                        })
                        .catch((error) => {
                          console.error("Error checking stage 4:", error);
                          // Default to problem page
                          router.push(
                            `/workflow/problem?projectId=${projectId}`
                          );
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
        <div className="space-y-12">
          <h2 className="text-4xl font-bold">Interview Transcript Analysis</h2>

          {isRestoringState && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded flex items-center">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Restoring your previous session...
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-8">
            {/* Upload Section */}
            <div className="space-y-4">
              <h3 className="text-2xl font-bold">Upload PDF document</h3>
              <div
                className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center min-h-[300px] transition-colors ${
                  isDragging
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);

                  const file = e.dataTransfer.files?.[0];
                  if (!file) return;

                  if (file.type !== "application/pdf") {
                    setError("Only PDF files are supported");
                    return;
                  }

                  setError(null);
                  console.log("File dropped:", file.name);
                  await handleUploadToServer(file);
                }}
              >
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
                  {isUploading ? (
                    <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                  ) : (
                    <Upload className="w-12 h-12" />
                  )}
                  <span className="text-xl font-medium">
                    {isUploading
                      ? "Uploading..."
                      : isDragging
                      ? "Drop PDF here"
                      : "Drop PDF here or click to upload"}
                  </span>
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
                <div className="bg-white rounded-lg p-4">
                  <h4 className="text-xl font-medium mb-4">Uploaded files:</h4>
                  <div className="space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded"
                      >
                        <span>{file.name}</span>
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
            <div className="space-y-4">
              <h3 className="text-2xl font-bold">Paste copied text</h3>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste text here..."
                className="w-full h-[300px] p-4 border rounded-lg resize-none"
              />
            </div>
          </div>

          {/* Generate Analysis Button */}
          <div className="flex justify-start">
            <button
              onClick={handleGenerateAnalysis}
              disabled={isAnalyzing || (!uploadedFiles.length && !pastedText)}
              className="bg-black text-white px-8 py-3 rounded-[10px] text-xl font-medium
                      hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Generate Analysis"
              )}
            </button>
          </div>

          {/* Analysis Results */}
          {analysis && (
            <div className="space-y-4">
              <h3 className="text-2xl font-bold">Analysis Results:</h3>
              <div className="p-4 border rounded-lg bg-gray-50">
                <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                  {renderMarkdown(analysis)}
                </p>
              </div>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="flex flex-wrap gap-4 justify-start">
            <button
              onClick={() => router.push("/workflow")}
              className="bg-black text-white px-8 py-3 rounded-[10px] text-xl font-medium
                      hover:opacity-90 transition-opacity"
            >
              Return Home
            </button>
            <button
              onClick={() => {
                // Save state before navigating
                saveStateToLocalStorage();
                router.push(`/workflow/problem?projectId=${projectId}`);
              }}
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

export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <UploadContent />
    </Suspense>
  );
}
