"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { Rocket, Loader2 } from "lucide-react";
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

function UnderstandContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { model } = useModel();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIteration, setCurrentIteration] = useState(1);

  useEffect(() => {
    const projectIdFromUrl = searchParams.get("projectId");
    const storedProjectId = localStorage.getItem("currentProjectId");
    const pid = projectIdFromUrl || storedProjectId;

    if (pid) {
      setProjectId(pid);
      restoreAnalysis(pid);
      fetchProjectInfo(pid);
    } else {
      router.push("/workflow");
    }
  }, [searchParams, router]);

  const restoreAnalysis = async (pid: string) => {
    try {
      // Try to restore from stage 2 data on the server
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

  const handleGenerateAnalysis = async () => {
    if (!projectId) {
      setError("Project ID is missing");
      return;
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

      // Save to localStorage for quick restore
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

  return (
    <ProtectedRoute>
      <div className="min-h-screen p-6 flex flex-col max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl md:text-6xl font-bold">Innovation Workflow</h1>
          <WorkflowProgress
            currentStep={2}
            projectId={projectId}
            iterationNumber={currentIteration}
          />
        </div>

        {/* Main Content */}
        <div className="space-y-12">
          <div className="flex items-center justify-between">
            <h2 className="text-4xl font-bold">Understand</h2>
            <div className="flex items-center gap-3">
              <StageReportButton
                projectId={projectId || ""}
                stageNumber={2}
                stageName="Understand"
                disabled={!analysis}
              />
              <ModelSelector />
            </div>
          </div>

          <p className="text-lg text-gray-600">
            Generate an AI-powered summary and analysis of your uploaded research.
            {currentIteration > 1 && (
              <span className="block text-sm text-blue-600 mt-1">
                This is iteration {currentIteration} — analysis incorporates feedback from previous iterations.
              </span>
            )}
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Generate Analysis Button */}
          <div className="flex justify-start">
            <button
              onClick={handleGenerateAnalysis}
              disabled={isAnalyzing}
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
              onClick={() => router.push(`/workflow/research?projectId=${projectId}`)}
              className="bg-black text-white px-8 py-3 rounded-[10px] text-xl font-medium
                      hover:opacity-90 transition-opacity"
            >
              Back to Research
            </button>
            <button
              onClick={() => router.push(`/workflow/analysis?projectId=${projectId}`)}
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

export default function UnderstandPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <UnderstandContent />
    </Suspense>
  );
}
