"use client";

import type React from "react";
import { Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function NewProject() {
  const router = useRouter();
  const [problem, setProblem] = useState("");
  const [showWarning, setShowWarning] = useState(false);

  const handleStartWorkflow = () => {
    if (problem.trim()) {
      localStorage.setItem("currentProblem", problem);
      router.push("/workflow");
    } else {
      setShowWarning(true);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProblem(e.target.value);
    if (showWarning) {
      setShowWarning(false);
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
              />
              <div className="min-h-[24px]">
                {showWarning && (
                  <p className="text-red-500 text-sm animate-fade-in">
                    Please enter a problem before continuing
                  </p>
                )}
                {!showWarning && (
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
                className="inline-flex items-center justify-center gap-2 bg-[#001DFA] text-white rounded-[10px] px-6 py-3 text-lg font-medium
                         transition-transform duration-200 hover:scale-105 active:scale-95"
              >
                start workflow
                <Rocket className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
