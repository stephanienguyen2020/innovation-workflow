"use client"

import { useState } from "react"
import { ChevronDown, Rocket } from "lucide-react"
import { useRouter } from "next/navigation"

interface Idea {
  id: string
  title: string
  description: string
}

const generatedIdeas: Idea[] = [
  {
    id: "1",
    title: "idea 1",
    description: "Detailed explanation of idea 1...",
  },
  {
    id: "2",
    title: "idea 2",
    description: "Detailed explanation of idea 2...",
  },
  {
    id: "3",
    title: "idea 3",
    description: "Detailed explanation of idea 3...",
  },
]

export default function IdeationPage() {
  const router = useRouter()
  const [expandedIdea, setExpandedIdea] = useState<string | null>(null)
  const [isHistoricalExpanded, setIsHistoricalExpanded] = useState(false)

  const handleIdeaToggle = (id: string) => {
    setExpandedIdea(expandedIdea === id ? null : id)
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
          <p className="text-gray-600 text-xl">Problem statement from current flow</p>
        </div>

        {/* Research Summary Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold">Research Summary</h3>
            <button
              onClick={() => router.push("/workflow/upload")}
              className="bg-black text-white px-6 py-2 rounded-[10px] text-lg font-medium"
            >
              Modify Research
            </button>
          </div>
          <p className="text-gray-600 text-xl">summary of key insights from user interview & web research</p>
        </div>

        {/* Generated Ideas Section */}
        <div className="space-y-4">
          <h3 className="text-2xl font-bold">Generated Ideas</h3>
          {generatedIdeas.map((idea) => (
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
                  <label htmlFor={idea.id} className="text-lg cursor-pointer">
                    {idea.title}
                  </label>
                </div>
                <ChevronDown
                  className={`w-6 h-6 transition-transform ${expandedIdea === idea.id ? "rotate-180" : ""}`}
                />
              </div>
              {expandedIdea === idea.id && (
                <div className="pb-4 pl-9">
                  <p className="text-gray-600">{idea.description}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Historical Ideas Section */}
        <div className="space-y-4">
          <h3 className="text-2xl font-bold">Historical Ideas</h3>
          <div className="border-b border-gray-200">
            <div
              className="flex items-center justify-between py-4 cursor-pointer"
              onClick={() => setIsHistoricalExpanded(!isHistoricalExpanded)}
            >
              <span className="text-lg">generation 1</span>
              <ChevronDown className={`w-6 h-6 transition-transform ${isHistoricalExpanded ? "rotate-180" : ""}`} />
            </div>
            {isHistoricalExpanded && (
              <div className="pb-4">
                <p className="text-gray-600">Historical ideas from generation 1...</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-wrap gap-4 pt-4">
          <button
            onClick={() => console.log("Regenerate idea")}
            className="bg-black text-white px-8 py-3 rounded-[10px] text-xl font-medium
                     hover:opacity-90 transition-opacity"
          >
            Regenerate Idea
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
  )
}

