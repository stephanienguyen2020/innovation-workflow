"use client";

export const dynamic = "force-dynamic";

import type React from "react";
import { useState, useEffect, Suspense } from "react";
import { Upload, Rocket, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useModel } from "@/context/ModelContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ModelSelector from "@/components/ModelSelector";
import WorkflowProgress from "@/components/WorkflowProgress";
import StageReportButton from "@/components/StageReportButton";

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

function ResearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { model } = useModel();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [fileUploadStatus, setFileUploadStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{ name: string; uploadedAt: string }>
  >([]);
  const [isDragging, setIsDragging] = useState(false);
  const [textUploaded, setTextUploaded] = useState(false);

  // Understand (analysis) state
  const [analysis, setAnalysis] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentIteration, setCurrentIteration] = useState(1);

  useEffect(() => {
    const projectIdFromUrl = searchParams.get("projectId");
    const storedProjectId = localStorage.getItem("currentProjectId");
    const pid = projectIdFromUrl || storedProjectId;

    if (pid) {
      setProjectId(pid);
      restoreState(pid);
      restoreAnalysis(pid);
      fetchProjectInfo(pid);
    } else {
      router.push("/workflow");
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (projectId && uploadedFiles.length > 0) {
      saveState();
    }
  }, [uploadedFiles, projectId]);

  const saveState = () => {
    if (!projectId) return;
    try {
      localStorage.setItem(
        `project_${projectId}_research_state`,
        JSON.stringify({ uploadedFiles, lastUpdated: new Date().toISOString() })
      );
    } catch {}
  };

  const restoreState = (pid: string) => {
    try {
      const saved = localStorage.getItem(`project_${pid}_research_state`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.uploadedFiles?.length > 0) {
          setUploadedFiles(parsed.uploadedFiles);
        }
      }
    } catch {}
  };

  const restoreAnalysis = async (pid: string) => {
    try {
      const response = await fetch(`/api/projects/${pid}/stages/2`);
      if (response.ok) {
        const data = await response.json();
        if (data.data?.analysis && data.status === "completed") {
          setAnalysis(data.data.analysis);
        }
      }
    } catch {}
  };

  const fetchProjectInfo = async (pid: string) => {
    try {
      const response = await fetch(`/api/projects/${pid}`);
      if (response.ok) {
        const data = await response.json();
        if (data.current_iteration) {
          setCurrentIteration(data.current_iteration);
        }
      }
    } catch {}
  };

  const getAuthToken = () => {
    try {
      const userData = localStorage.getItem("innovation_workflow_user");
      if (userData) {
        const parsed = JSON.parse(userData);
        return {
          accessToken: parsed.access_token,
          tokenType: parsed.token_type || "bearer",
        };
      }
    } catch {}
    return null;
  };

  const handleUploadToServer = async (file: File) => {
    if (!file || !projectId || !user) {
      setError(
        !file
          ? "No file to upload"
          : !projectId
            ? "Project ID is missing"
            : "You must be logged in"
      );
      return null;
    }

    setIsUploading(true);
    setFileUploadStatus("Uploading...");
    setError(null);

    const auth = getAuthToken();
    if (!auth) {
      setError("Authentication failed. Please log in again.");
      setIsUploading(false);
      setFileUploadStatus(null);
      return null;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`/api/projects/${projectId}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401 || response.status === 403) {
          setError("Authentication failed. Please log in again.");
          return null;
        }
        throw new Error(errorText || "Failed to upload file");
      }

      const data = await response.json();
      setFileUploadStatus("Upload successful");
      setUploadedFiles((prev) => [
        ...prev,
        { name: file.name, uploadedAt: new Date().toLocaleString() },
      ]);
      return data;
    } catch (err) {
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
      if (file.type !== "application/pdf") {
        setError("Only PDF files are supported");
        return;
      }
      setError(null);
      await handleUploadToServer(file);
    }
  };

  const handleUploadText = async () => {
    if (!projectId || !pastedText.trim()) {
      setError(!projectId ? "Project ID is missing" : "Please enter some text");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/upload-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pastedText.trim() }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to upload text");
      }

      setTextUploaded(true);
      setUploadedFiles((prev) => [
        ...prev,
        { name: "Pasted text", uploadedAt: new Date().toLocaleString() },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload text");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerateAnalysis = async () => {
    if (!projectId) {
      setError("Project ID is missing");
      return;
    }

    // If text is pasted but not uploaded, upload it first
    if (pastedText.trim() && !textUploaded) {
      await handleUploadText();
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysis("");

    try {
      const proxyUrl = `/api/projects/${projectId}/stages/2/generate`;

      const response = await fetch(proxyUrl, {
        method: "POST",
        headers: {
          "X-Model-Type": model,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
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
              if (eventType === "error") throw parseErr;
            }
          }
        }
      }

      if (!streamedAnalysis) {
        throw new Error("No analysis data received from the server");
      }

      localStorage.setItem(
        `project_${projectId}_upload_state`,
        JSON.stringify({
          analysis: streamedAnalysis,
          uploadedFiles: [],
          lastUpdated: new Date().toISOString(),
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setAnalysis("");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const hasContent = uploadedFiles.length > 0 || textUploaded;

  return (
    <ProtectedRoute>
      <div className="min-h-screen p-6 flex flex-col max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl md:text-6xl font-bold">
            Innovation Workflow
          </h1>
          <WorkflowProgress
            currentStep={analysis ? 2 : 1}
            projectId={projectId}
            iterationNumber={currentIteration}
          />
        </div>

        {/* Main Content */}
        <div className="space-y-12">
          <div className="flex items-center justify-between">
            <h2 className="text-4xl font-bold">Research</h2>
            <div className="flex items-center gap-3">
              <StageReportButton
                projectId={projectId || ""}
                stageNumber={1}
                stageName="Research"
                disabled={!hasContent}
              />
              <ModelSelector />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-8">
            {/* Upload Section */}
            <div className="space-y-4">
              <h3 className="text-2xl font-bold">Upload Document(s)</h3>
              <div
                className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center min-h-[300px] transition-colors ${
                  isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300"
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
                        ? "Drop file(s) here"
                        : "Drop PDF here or click to upload"}
                  </span>
                  {fileUploadStatus && (
                    <span
                      className={
                        fileUploadStatus.includes("successful")
                          ? "text-green-600"
                          : "text-blue-600"
                      }
                    >
                      {fileUploadStatus}
                    </span>
                  )}
                </label>
              </div>

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
              {pastedText.trim() && !textUploaded && (
                <button
                  onClick={handleUploadText}
                  disabled={isUploading}
                  className="bg-gray-800 text-white px-6 py-2 rounded-[10px] text-base font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isUploading ? "Uploading..." : "Upload Text"}
                </button>
              )}
              {textUploaded && (
                <span className="text-green-600 text-sm">
                  Text uploaded successfully
                </span>
              )}
            </div>
          </div>

          {/* Generate Analysis / Re-Analyze Button */}
          <div className="flex justify-start">
            <button
              onClick={handleGenerateAnalysis}
              disabled={isAnalyzing || (!hasContent && !pastedText.trim())}
              className="bg-black text-white px-8 py-3 rounded-[10px] text-xl font-medium
                      hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing...
                </>
              ) : analysis ? (
                "Re-Analyze"
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
              className="bg-black text-white px-8 py-3 rounded-[10px] text-xl font-medium hover:opacity-90 transition-opacity"
            >
              Return Home
            </button>
            {analysis && (
              <button
                onClick={() =>
                  router.push(`/workflow/analysis?projectId=${projectId}`)
                }
                className="bg-[#001DFA] text-white px-8 py-3 rounded-[10px] text-xl font-medium
                        hover:opacity-90 transition-opacity inline-flex items-center gap-2"
              >
                Define Problems
                <Rocket className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function ResearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <ResearchContent />
    </Suspense>
  );
}
