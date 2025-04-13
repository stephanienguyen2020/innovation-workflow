"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";

interface Idea {
  id: string;
  title: string;
  description: string;
}

interface ProblemStatement {
  id: string;
  title: string;
  description: string;
}

export default function IdeationPage() {
  const router = useRouter();
  const [expandedIdea, setExpandedIdea] = useState<string | null>(null);
  const [isHistoricalExpanded, setIsHistoricalExpanded] = useState<
    number | null
  >(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [problemStatement, setProblemStatement] =
    useState<ProblemStatement | null>(null);
  const [allIdeasHistory, setAllIdeasHistory] = useState<Idea[][]>([]);

  useEffect(() => {
    // Get session ID from localStorage
    const storedSessionId = localStorage.getItem("chatSessionId");
    if (storedSessionId) {
      setSessionId(storedSessionId);

      // Get the selected problem statement
      const problemJson = localStorage.getItem("selectedProblem");
      if (problemJson) {
        try {
          const problem = JSON.parse(problemJson) as ProblemStatement;
          setProblemStatement(problem);

          // Generate ideas
          generateIdeas(storedSessionId, problem);
        } catch (err) {
          console.error("Error parsing problem statement:", err);
          setError(
            "Invalid problem statement format. Please go back and select a problem."
          );
        }
      } else {
        setError(
          "No problem statement selected. Please go back and select a problem."
        );
      }
    } else {
      setError("No active session found. Please return to the beginning.");
    }
  }, []);

  const generateIdeas = async (
    sessionId: string,
    problem: ProblemStatement
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      // Get previous ideas if they exist
      const existingIdeasJson = localStorage.getItem("generatedIdeas");
      if (existingIdeasJson) {
        try {
          const existingIdeas = JSON.parse(existingIdeasJson) as Idea[][];
          setAllIdeasHistory(existingIdeas);
        } catch (err) {
          console.error("Error parsing existing ideas:", err);
        }
      }

      // Send a request to generate ideas
      const promptMessage = `Based on the following problem statement, please generate 3 innovative solution ideas.
      Problem statement: ${problem.title}
      Problem description: ${problem.description}
      Format each idea with a concise title and detailed explanation.`;

      // Send the request to generate ideas
      await api.sendMessage(sessionId, promptMessage);

      // Get the updated chat history
      const history = await api.getChatHistory(sessionId);

      // Get the latest assistant message (ideas)
      const assistantMessages = history.messages.filter(
        (msg) => msg.role === "assistant"
      );

      if (assistantMessages.length > 0) {
        const latestResponse =
          assistantMessages[assistantMessages.length - 1].content;

        // Parse the response and convert to ideas
        const newIdeas: Idea[] = [];

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

            newIdeas.push({
              id: i.toString(),
              title: title || `Idea ${i}`,
              description: description || "No detailed explanation available.",
            });
          }
        }

        if (newIdeas.length > 0) {
          setIdeas(newIdeas);

          // Add to history
          const updatedHistory = [...allIdeasHistory, newIdeas];
          setAllIdeasHistory(updatedHistory);

          // Store all ideas
          localStorage.setItem(
            "generatedIdeas",
            JSON.stringify(updatedHistory)
          );
        } else {
          // Fallback if parsing fails
          const fallbackIdea = {
            id: "1",
            title: "Generated Idea",
            description: latestResponse,
          };
          setIdeas([fallbackIdea]);

          // Add to history
          const updatedHistory = [...allIdeasHistory, [fallbackIdea]];
          setAllIdeasHistory(updatedHistory);

          // Store all ideas
          localStorage.setItem(
            "generatedIdeas",
            JSON.stringify(updatedHistory)
          );
        }
      }
    } catch (err) {
      console.error("Error generating ideas:", err);
      setError("Failed to generate ideas. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleIdeaToggle = (id: string) => {
    setExpandedIdea(expandedIdea === id ? null : id);
  };

  const handleRegenerateIdeas = async () => {
    if (!sessionId || !problemStatement) {
      setError("Missing session or problem statement. Please try again.");
      return;
    }

    // Generate new ideas
    await generateIdeas(sessionId, problemStatement);
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
                ${step === 3 ? "bg-[#001DFA]" : "bg-black"}`}
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
        <h2 className="text-4xl font-bold">Ideation</h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            {error}
          </div>
        )}

        {/* Problem Statement Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold">Problem Statement</h3>
            <button
              onClick={() => router.push("/workflow/problem")}
              className="bg-black text-white px-6 py-2 rounded-[10px] text-lg font-medium"
            >
              Modify Problem
            </button>
          </div>
          <p className="text-gray-600 text-xl">
            {problemStatement?.title || "No problem statement selected"}
          </p>
          {problemStatement?.description && (
            <p className="text-gray-600 text-sm mt-2">
              {problemStatement.description}
            </p>
          )}
        </div>

        {/* Generated Ideas Section */}
        <div className="space-y-4">
          <h3 className="text-2xl font-bold">Generated Ideas</h3>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
              <span className="ml-3">Generating ideas...</span>
            </div>
          ) : (
            <>
              {ideas.map((idea) => (
                <div key={idea.id} className="border-b border-gray-200">
                  <div
                    className="flex items-center justify-between py-4 cursor-pointer"
                    onClick={() => handleIdeaToggle(idea.id)}
                  >
                    <div className="flex items-center gap-4">
                      <input
                        type="radio"
                        id={idea.id}
                        name="idea"
                        checked={expandedIdea === idea.id}
                        onChange={() => handleIdeaToggle(idea.id)}
                        className="w-5 h-5"
                      />
                      <label
                        htmlFor={idea.id}
                        className="text-lg cursor-pointer"
                      >
                        {idea.title}
                      </label>
                    </div>
                    <ChevronDown
                      className={`w-6 h-6 transition-transform ${
                        expandedIdea === idea.id ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                  {expandedIdea === idea.id && (
                    <div className="pb-4 pl-9">
                      <p className="text-gray-600">{idea.description}</p>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Historical Ideas Section */}
        {allIdeasHistory.length > 1 && (
          <div className="space-y-4">
            <h3 className="text-2xl font-bold">Historical Ideas</h3>
            {allIdeasHistory.slice(0, -1).map((ideaSet, index) => (
              <div key={index} className="border-b border-gray-200">
                <div
                  className="flex items-center justify-between py-4 cursor-pointer"
                  onClick={() =>
                    setIsHistoricalExpanded(
                      isHistoricalExpanded === index ? null : index
                    )
                  }
                >
                  <span className="text-lg">generation {index + 1}</span>
                  <ChevronDown
                    className={`w-6 h-6 transition-transform ${
                      isHistoricalExpanded === index ? "rotate-180" : ""
                    }`}
                  />
                </div>
                {isHistoricalExpanded === index && (
                  <div className="pb-4">
                    {ideaSet.map((idea) => (
                      <div
                        key={idea.id}
                        className="mb-4 pl-4 border-l-2 border-gray-300"
                      >
                        <h4 className="font-bold">{idea.title}</h4>
                        <p className="text-gray-600 text-sm">
                          {idea.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex flex-wrap gap-4 pt-4">
          <button
            onClick={handleRegenerateIdeas}
            disabled={isLoading}
            className="bg-black text-white px-8 py-3 rounded-[10px] text-xl font-medium
                     hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isLoading ? "Generating..." : "Regenerate Ideas"}
          </button>
          <button
            onClick={() => router.push("/workflow/report")}
            className="bg-[#001DFA] text-white px-8 py-3 rounded-[10px] text-xl font-medium
                     hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            Generate report
            <Rocket className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
