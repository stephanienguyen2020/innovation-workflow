"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";

interface ProblemStatement {
  id: string;
  title: string;
  description: string;
}

export default function ProblemDefinitionPage() {
  const router = useRouter();
  const [selectedProblem, setSelectedProblem] = useState<string>("");
  const [expandedProblem, setExpandedProblem] = useState<string | null>(null);
  const [customProblem, setCustomProblem] = useState("");
  const [customExplanation, setCustomExplanation] = useState("");
  const [showWarning, setShowWarning] = useState(false);
  const [problemStatements, setProblemStatements] = useState<
    ProblemStatement[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get session ID from localStorage
    const storedSessionId = localStorage.getItem("chatSessionId");
    if (storedSessionId) {
      setSessionId(storedSessionId);
      // Generate problem statements based on the analysis
      generateProblemStatements(storedSessionId);
    } else {
      setError("No active session found. Please return to the beginning.");
    }
  }, []);

  const generateProblemStatements = async (sessionId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Get the analysis from localStorage
      const analysisJson = localStorage.getItem("interviewAnalysis");

      if (!analysisJson) {
        setError(
          "No interview analysis found. Please analyze an interview first."
        );
        setIsLoading(false);
        return;
      }

      // Send a request to generate problem statements
      const promptMessage =
        "Based on the interview analysis, please generate 4 clear problem statements with detailed explanations. Format them as numbered statements.";

      // Send the request to generate problem statements
      await api.sendMessage(sessionId, promptMessage);

      // Get the updated chat history
      const history = await api.getChatHistory(sessionId);

      // Get the latest assistant message (problem statements)
      const assistantMessages = history.messages.filter(
        (msg) => msg.role === "assistant"
      );

      if (assistantMessages.length > 0) {
        const latestResponse =
          assistantMessages[assistantMessages.length - 1].content;

        // Parse the response and convert to problem statements
        // This is a simple parsing example - adjust based on your actual response format
        const statements: ProblemStatement[] = [];

        // Split by numbered patterns like "1.", "2.", etc.
        const parts = latestResponse.split(/\d+\.\s+/);

        // Skip the first empty part if it exists
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i].trim();
          if (part) {
            // Extract title (first line) and description (rest)
            const lines = part.split("\n").filter((line) => line.trim());
            const title = lines[0];
            const description = lines.slice(1).join("\n");

            statements.push({
              id: i.toString(),
              title: title || `Problem Statement ${i}`,
              description: description || "No detailed explanation available.",
            });
          }
        }

        if (statements.length > 0) {
          setProblemStatements(statements);
        } else {
          // Fallback if parsing fails
          setProblemStatements([
            {
              id: "1",
              title: "Generated Problem Statement 1",
              description: latestResponse,
            },
          ]);
        }

        // Store the problem statements for later use
        localStorage.setItem("problemStatements", JSON.stringify(statements));
      }
    } catch (err) {
      console.error("Error generating problem statements:", err);
      setError("Failed to generate problem statements. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleProblemSelect = (id: string) => {
    setSelectedProblem(id);
    setExpandedProblem(expandedProblem === id ? null : id);
    if (showWarning) {
      setShowWarning(false);
    }
  };

  const handleGenerateIdeas = async () => {
    if (!sessionId) {
      setError("No active session found. Please return to the beginning.");
      return;
    }

    if (
      !selectedProblem ||
      (selectedProblem === "custom" && !customProblem.trim())
    ) {
      setShowWarning(true);
      return;
    }

    // Store the selected problem statement
    if (selectedProblem === "custom") {
      localStorage.setItem(
        "selectedProblem",
        JSON.stringify({
          id: "custom",
          title: customProblem,
          description: customExplanation,
        })
      );
    } else {
      const selected = problemStatements.find((p) => p.id === selectedProblem);
      if (selected) {
        localStorage.setItem("selectedProblem", JSON.stringify(selected));
      }
    }

    router.push("/workflow/ideas");
  };

  return (
    <div className="min-h-screen p-6 flex flex-col max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-4 mb-12">
        <h1 className="text-4xl md:text-6xl font-bold">Innovation Workflow</h1>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-0 mt-6">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white
                ${step === 2 ? "bg-[#001DFA]" : "bg-black"}`}
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
        <h2 className="text-4xl font-bold">Problem Definition</h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
            <span className="ml-3">Generating problem statements...</span>
          </div>
        ) : (
          <>
            <p className="text-2xl">
              select from the following problem statement or enter your own
            </p>

            {/* Problem Statements */}
            <div className="space-y-4">
              {problemStatements.map((problem) => (
                <div key={problem.id} className="border-b border-gray-200">
                  <div
                    className="flex items-center justify-between py-4 cursor-pointer"
                    onClick={() => handleProblemSelect(problem.id)}
                  >
                    <div className="flex items-center gap-4">
                      <input
                        type="radio"
                        id={problem.id}
                        name="problem"
                        checked={selectedProblem === problem.id}
                        onChange={() => handleProblemSelect(problem.id)}
                        className="w-5 h-5"
                      />
                      <label
                        htmlFor={problem.id}
                        className="text-lg cursor-pointer"
                      >
                        {problem.title}
                      </label>
                    </div>
                    <ChevronDown
                      className={`w-6 h-6 transition-transform ${
                        expandedProblem === problem.id ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                  {expandedProblem === problem.id && (
                    <div className="pb-4 pl-9">
                      <p className="text-gray-600">{problem.description}</p>
                    </div>
                  )}
                </div>
              ))}

              {/* Custom Problem Input */}
              <div className="border-b border-gray-200 pb-4">
                <div className="flex items-center gap-4 py-4">
                  <input
                    type="radio"
                    id="custom"
                    name="problem"
                    checked={selectedProblem === "custom"}
                    onChange={() => handleProblemSelect("custom")}
                    className="w-5 h-5"
                  />
                  <label htmlFor="custom" className="text-lg">
                    Enter you own problem:
                  </label>
                </div>
                {selectedProblem === "custom" && (
                  <div className="space-y-4 pl-9">
                    <input
                      type="text"
                      value={customProblem}
                      onChange={(e) => {
                        setCustomProblem(e.target.value);
                        if (showWarning) setShowWarning(false);
                      }}
                      placeholder="Enter your own problem statement"
                      className={`w-full p-4 border-2 ${
                        showWarning && !customProblem.trim()
                          ? "border-red-500"
                          : "border-gray-700"
                      } rounded-lg`}
                    />
                    <textarea
                      value={customExplanation}
                      onChange={(e) => setCustomExplanation(e.target.value)}
                      placeholder="Enter detailed explanation of your problem statement"
                      className="w-full p-4 border-2 border-gray-700 rounded-lg h-40"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Warning Message */}
            {showWarning && (
              <p className="text-red-500 text-sm animate-fade-in">
                {selectedProblem === "custom"
                  ? "Please enter your problem statement before continuing"
                  : "Please select a problem statement before continuing"}
              </p>
            )}
          </>
        )}

        {/* Bottom Actions */}
        <div className="flex flex-wrap gap-4 pt-4">
          <button
            onClick={() => router.push("/workflow/upload")}
            className="bg-black text-white px-8 py-3 rounded-[10px] text-xl font-medium
                     hover:opacity-90 transition-opacity"
          >
            Add more research
          </button>
          <button
            onClick={handleGenerateIdeas}
            disabled={isLoading}
            className="bg-[#001DFA] text-white px-8 py-3 rounded-[10px] text-xl font-medium
                     hover:opacity-90 transition-opacity inline-flex items-center gap-2
                     disabled:opacity-50"
          >
            Generate ideas
            <Rocket className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
