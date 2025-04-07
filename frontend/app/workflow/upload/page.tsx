"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { Upload, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";

export default function UploadPage() {
  const router = useRouter();
  const [pastedText, setPastedText] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize chat session on component mount
  useEffect(() => {
    // Check if we already have a session ID in localStorage
    const storedSessionId = localStorage.getItem("chatSessionId");

    if (storedSessionId) {
      setSessionId(storedSessionId);
    } else {
      // Create a new session
      createNewChatSession();
    }
  }, []);

  const createNewChatSession = async () => {
    try {
      const newSessionId = await api.createChatSession();
      setSessionId(newSessionId);
      localStorage.setItem("chatSessionId", newSessionId);
    } catch (err) {
      console.error("Failed to create chat session:", err);
      setError("Failed to connect to the chat service. Please try again.");
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      // Read file content
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        setPastedText(text);
      };
      reader.readAsText(file);
    }
  };

  const handleGenerateAnalysis = async () => {
    if (!sessionId) {
      setError("No active session. Please refresh the page.");
      return;
    }

    if (!pastedText.trim()) {
      setError(
        "Please upload a file or paste text before generating analysis."
      );
      return;
    }

    setError(null);
    setIsAnalyzing(true);

    try {
      // Send the transcript to the backend
      const response = await api.sendMessage(sessionId, pastedText);

      // Get updated chat history to show the analysis
      const history = await api.getChatHistory(sessionId);

      // Extract assistant response (analysis)
      const assistantMessages = history.messages.filter(
        (msg) => msg.role === "assistant"
      );
      if (assistantMessages.length > 0) {
        setAnalysis(assistantMessages[assistantMessages.length - 1].content);
      }

      // Also store the analysis in localStorage for other pages
      localStorage.setItem(
        "interviewAnalysis",
        JSON.stringify(assistantMessages)
      );
    } catch (err) {
      console.error("Error generating analysis:", err);
      setError("Failed to generate analysis. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen p-6 flex flex-col max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-4xl md:text-6xl font-bold">Innovation Workflow</h1>

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
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">Upload transcript</h3>
            <div className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center min-h-[300px]">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.txt"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center space-y-4"
              >
                <Upload className="w-12 h-12" />
                <span className="text-xl font-medium">Upload Source</span>
              </label>
            </div>
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
            disabled={isAnalyzing || !sessionId}
            className="bg-black text-white px-8 py-3 rounded-[10px] text-xl font-medium
                     hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isAnalyzing ? "Analyzing..." : "Generate Analysis"}
          </button>
        </div>

        {/* Analysis Results */}
        {analysis && (
          <div className="space-y-4">
            <h3 className="text-3xl font-bold">Analyze New Interview:</h3>
            <p className="text-gray-600 leading-relaxed">{analysis}</p>
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
            onClick={() => router.push("/workflow/problem")}
            disabled={!analysis}
            className="bg-[#001DFA] text-white px-8 py-3 rounded-[10px] text-xl font-medium
                     hover:opacity-90 transition-opacity inline-flex items-center gap-2 
                     disabled:opacity-50"
          >
            Update Problem Statement
            <Rocket className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
