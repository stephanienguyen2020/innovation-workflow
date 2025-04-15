"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { Upload, Rocket, CheckCircle2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { getAuthHeaders, createTemporaryAuth } from "@/lib/auth";

// Define interfaces for API responses
interface ProjectResponse {
  _id: string;
  [key: string]: any;
}

interface StageResponse {
  stage_number: number;
  status: string;
  data: {
    analysis?: string;
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

export default function UploadPage() {
  const router = useRouter();
  const [pastedText, setPastedText] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState(false);
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
    // Get projectId from localStorage or create a new project
    const storedProjectId = localStorage.getItem("projectId");
    if (storedProjectId) {
      setProjectId(storedProjectId);
    } else {
      createNewProject();
    }
  }, []);

  const createNewProject = async () => {
    try {
      // Get the user ID from localStorage (set in createTemporaryAuth)
      const userId = localStorage.getItem("userId") || "user123";
      const problem = localStorage.getItem("currentProblem") || "";

      // First try with auth headers
      let response = await fetch(`${apiUrl}/api/projects/`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          problem_domain: problem,
        }),
      });

      // If first approach fails, try with user_id as query parameter
      if (response.status === 401 || response.status === 403) {
        // Re-create temporary auth
        await createTemporaryAuth();

        response = await fetch(`${apiUrl}/api/projects/?user_id=${userId}`, {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            problem_domain: problem,
          }),
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data: ProjectResponse = await response.json();
      const newProjectId = data._id;
      setProjectId(newProjectId);
      localStorage.setItem("projectId", newProjectId);
    } catch (err) {
      console.error("Error creating project:", err);
      setError("Failed to create project. Please try again.");
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !projectId) return;

    setIsUploading(true);
    setError("");
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Get the authentication token
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {};

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Call the backend API for stage 1 - document upload
      const response = await fetch(
        `${apiUrl}/api/projects/${projectId}/stages/1/upload`,
        {
          method: "POST",
          headers,
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      // Process response
      const data: StageResponse = await response.json();
      if (data && data.data.analysis) {
        setAnalysis(data.data.analysis);
      }

      // Add file to the list
      setUploadedFiles((prev) => [...prev, file.name]);
      setUploadSuccess(true);
      console.log("File uploaded successfully");
    } catch (err) {
      console.error("Error uploading file:", err);
      setError("Failed to upload file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    if (uploadedFiles.length <= 1) {
      setUploadSuccess(false);
    }
  };

  const handleGenerateAnalysis = async () => {
    if (!projectId) {
      setError("Project not initialized. Please refresh the page.");
      return;
    }

    setIsAnalyzing(true);
    setError("");

    try {
      // Call the backend API for stage 1 - generate analysis
      const response = await fetch(
        `${apiUrl}/api/projects/${projectId}/stages/1/generate`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      // Display the analysis from the response
      const data: StageResponse = await response.json();
      console.log("Response data:", JSON.stringify(data, null, 2));
      if (data && data.data && data.data.analysis) {
        console.log("Setting analysis to:", data.data.analysis);
        setAnalysis(data.data.analysis);
      } else {
        console.error("Analysis data not found in response:", data);
        setError("No analysis was generated. Please try again.");
      }
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
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {uploadSuccess && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <span>Successfully uploaded files</span>
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
                disabled={isUploading}
              />
              <label
                htmlFor="file-upload"
                className={`cursor-pointer flex flex-col items-center space-y-4 ${
                  isUploading ? "opacity-50" : ""
                }`}
              >
                <Upload className="w-12 h-12" />
                <span className="text-xl font-medium">
                  {isUploading ? "Uploading..." : "Upload Source"}
                </span>
              </label>
            </div>

            {/* File List Display - Moved outside the upload box */}
            {uploadedFiles.length > 0 && (
              <div className="mt-4 border rounded-lg p-4">
                <p className="font-medium mb-2">Uploaded files:</p>
                <ul className="space-y-2 max-h-[180px] overflow-y-auto">
                  {uploadedFiles.map((fileName, index) => (
                    <li
                      key={index}
                      className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded text-sm"
                    >
                      <span className="truncate max-w-[80%]">{fileName}</span>
                      <button
                        onClick={() => removeFile(index)}
                        className="text-gray-500 hover:text-red-500"
                        aria-label="Remove file"
                      >
                        <X size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
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
              disabled={isUploading || isAnalyzing}
            />
          </div>
        </div>

        {/* Generate Analysis Button */}
        <div className="flex justify-start">
          <button
            onClick={handleGenerateAnalysis}
            disabled={isAnalyzing || isUploading}
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
            <div className="text-gray-600 leading-relaxed whitespace-pre-wrap">
              {analysis}
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
            onClick={() => router.push("/workflow/problem")}
            className="bg-[#001DFA] text-white px-8 py-3 rounded-[10px] text-xl font-medium
                     hover:opacity-90 transition-opacity inline-flex items-center gap-2"
            disabled={!analysis}
          >
            Update Problem Statement
            <Rocket className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
