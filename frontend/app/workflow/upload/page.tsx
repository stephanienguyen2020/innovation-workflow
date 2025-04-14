"use client"

import type React from "react"

import { useState } from "react"
import { Upload, Rocket } from "lucide-react"
import { useRouter } from "next/navigation"

export default function UploadPage() {
  const router = useRouter()
  const [pastedText, setPastedText] = useState("")
  const [analysis, setAnalysis] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Handle file upload logic here
      console.log("File uploaded:", file.name)
    }
  }

  const handleGenerateAnalysis = async () => {
    setIsAnalyzing(true)
    // Simulate analysis
    setTimeout(() => {
      setAnalysis(
        "This is an analysis of the uploaded research this is an analysis of the uploaded research " +
          "this is an analysis of the uploaded research this is an analysis of the uploaded research " +
          "this is an analysis of the uploaded research this is an analysis of the uploaded research",
      )
      setIsAnalyzing(false)
    }, 1500)
  }

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
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center space-y-4">
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
            disabled={isAnalyzing}
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
            className="bg-[#001DFA] text-white px-8 py-3 rounded-[10px] text-xl font-medium
                     hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            Update Problem Statement
            <Rocket className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

