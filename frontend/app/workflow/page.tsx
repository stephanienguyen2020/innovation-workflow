"use client";
import { useRouter } from "next/navigation";

export default function WorkflowPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen p-6 flex flex-col">
      {/* Header
      <h1 className="text-4xl md:text-6xl font-bold text-center mb-20">Innovation Workflow</h1> */}

      {/* Workflow Steps */}
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-4xl w-full space-y-6">
          {/* Upload Interview */}
          <div className="flex items-center gap-4">
            <span className="text-xl font-medium w-32"></span>
            <div className="flex-1 flex justify-center">
              <button
                onClick={() => router.push("/workflow/upload")}
                className="w-[80%] bg-black text-white text-2xl font-medium py-6 rounded-[10px] hover:opacity-90 transition-opacity"
              >
                Upload Interview
              </button>
            </div>
            <div className="w-32"></div> {/* Spacer to balance layout */}
          </div>

          {/* Define Problem */}
          <div className="flex items-center gap-4">
            <div className="w-32"></div> {/* Spacer for consistent layout */}
            <div className="flex-1 flex justify-center">
              <button className="w-[70%] bg-[#666666] text-white text-2xl font-medium py-6 rounded-[10px] hover:opacity-90 transition-opacity">
                Define Problem
              </button>
            </div>
            <div className="w-32"></div> {/* Spacer to balance layout */}
          </div>

          {/* Generate Ideas */}
          <div className="flex items-center gap-4">
            <span className="text-xl font-medium w-32"></span>
            <div className="flex-1 flex justify-center">
              <button className="w-[60%] bg-[#808080] text-white text-2xl font-medium py-6 rounded-[10px] hover:opacity-90 transition-opacity">
                Generate Ideas
              </button>
            </div>
            <div className="w-32"></div> {/* Spacer to balance layout */}
          </div>

          {/* Final Report */}
          <div className="flex items-center gap-4">
            <div className="w-32"></div> {/* Spacer for consistent layout */}
            <div className="flex-1 flex justify-center">
              <button className="w-[50%] bg-[#B3B3B3] text-white text-2xl font-medium py-6 rounded-[10px] hover:opacity-90 transition-opacity">
                Final Report
              </button>
            </div>
            <div className="w-32"></div> {/* Spacer to balance layout */}
          </div>
        </div>
      </div>
    </div>
  );
}
