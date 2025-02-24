"use client"

import { useRouter } from "next/navigation"

export default function ReportPage() {
  const router = useRouter()

  const handleDownload = () => {
    // Handle PDF download logic here
    console.log("Downloading PDF...")
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
                ${step === 4 ? "bg-[#001DFA]" : "bg-black"}`}
              >
                {step}
              </div>
              {step < 4 && <div className="w-12 h-0.5 bg-black" />}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-3xl mx-auto space-y-8">
        <div className="space-y-2">
          <p className="text-3xl">Congrats on finishing the workflow here is a</p>
          <p className="text-3xl">
            <span className="font-bold">documentation</span> for your reference:
          </p>
        </div>

        <button
          onClick={handleDownload}
          className="bg-[#001DFA] text-white text-2xl font-medium px-12 py-6 rounded-2xl
                   hover:opacity-90 transition-opacity"
        >
          Download PDF
        </button>
      </div>
    </div>
  )
}

