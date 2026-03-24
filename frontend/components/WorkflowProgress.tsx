"use client";

import { useRouter } from "next/navigation";

const STAGE_NAMES = ["Research", "Understand", "Analysis", "Ideate", "Evaluate"];

interface WorkflowProgressProps {
  currentStep: number;
  projectId: string | null;
  iterationNumber?: number;
}

export default function WorkflowProgress({
  currentStep,
  projectId,
  iterationNumber,
}: WorkflowProgressProps) {
  const router = useRouter();

  const stageRoutes: Record<number, string> = {
    1: "/workflow/research",
    2: "/workflow/understand",
    3: "/workflow/analysis",
    4: "/workflow/ideate",
    5: "/workflow/evaluate",
  };

  const handleStepClick = (step: number) => {
    if (step === currentStep || !projectId) return;
    const route = stageRoutes[step];
    if (route) {
      router.push(`${route}?projectId=${projectId}`);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-0">
        {[1, 2, 3, 4, 5].map((step) => (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm
                  ${step === currentStep ? "bg-[#001DFA]" : "bg-black"}
                  cursor-pointer hover:opacity-80 transition-opacity`}
                onClick={() => handleStepClick(step)}
                title={STAGE_NAMES[step - 1]}
              >
                {step}
              </div>
              <span className="text-[10px] mt-1 text-gray-500 whitespace-nowrap">
                {STAGE_NAMES[step - 1]}
              </span>
            </div>
            {step < 5 && (
              <div className="flex items-center mb-4 mx-3">
                <div className="w-6 h-0.5 bg-black" />
                <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-black" />
              </div>
            )}
          </div>
        ))}
      </div>
      {iterationNumber && iterationNumber > 1 && (
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          Iteration {iterationNumber}
        </span>
      )}
    </div>
  );
}
