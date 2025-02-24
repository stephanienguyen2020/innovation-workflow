"use client"

import { useState } from "react"
import { ChevronDown, Rocket } from "lucide-react"
import { useRouter } from "next/navigation"

interface ProblemStatement {
  id: string
  title: string
  description: string
}

const problemStatements: ProblemStatement[] = [
  {
    id: "1",
    title: "Problem Statement 1",
    description: "Detailed explanation of problem statement 1...",
  },
  {
    id: "2",
    title: "Problem Statement 2",
    description: "Detailed explanation of problem statement 2...",
  },
  {
    id: "3",
    title: "Problem Statement 3",
    description: "Detailed explanation of problem statement 3...",
  },
  {
    id: "4",
    title: "Problem Statement 4",
    description: "Detailed explanation of problem statement 4...",
  },
]

export default function ProblemDefinitionPage() {
  const router = useRouter()
  const [selectedProblem, setSelectedProblem] = useState<string>("")
  const [expandedProblem, setExpandedProblem] = useState<string | null>(null)
  const [customProblem, setCustomProblem] = useState("")
  const [customExplanation, setCustomExplanation] = useState("")
  const [showWarning, setShowWarning] = useState(false)

  const handleProblemSelect = (id: string) => {
    setSelectedProblem(id)
    setExpandedProblem(expandedProblem === id ? null : id)
    if (showWarning) {
      setShowWarning(false)
    }
  }

  const handleGenerateIdeas = () => {
    if (!selectedProblem || (selectedProblem === "custom" && !customProblem.trim())) {
      setShowWarning(true)
      return
    }
    router.push("/workflow/ideas")
  }

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
        <p className="text-2xl">select from the following problem statement or enter your own</p>

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
                  <label htmlFor={problem.id} className="text-lg cursor-pointer">
                    {problem.title}
                  </label>
                </div>
                <ChevronDown
                  className={`w-6 h-6 transition-transform ${expandedProblem === problem.id ? "rotate-180" : ""}`}
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
                    setCustomProblem(e.target.value)
                    if (showWarning) setShowWarning(false)
                  }}
                  placeholder="Enter your own problem statement"
                  className={`w-full p-4 border-2 ${
                    showWarning && !customProblem.trim() ? "border-red-500" : "border-gray-700"
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
            className="bg-[#001DFA] text-white px-8 py-3 rounded-[10px] text-xl font-medium
                     hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            Generate ideas
            <Rocket className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

