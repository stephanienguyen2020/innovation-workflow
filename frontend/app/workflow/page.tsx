"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";

export default function WorkflowPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentIteration, setCurrentIteration] = useState(1);
  const [iterationFeedback, setIterationFeedback] = useState<{
    has_problem_feedback?: boolean;
    has_solution_feedback?: boolean;
    has_image_feedback?: boolean;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const evaluateRef = useRef<HTMLButtonElement>(null);
  const understandRef = useRef<HTMLButtonElement>(null);
  const [arrowPath, setArrowPath] = useState("");

  useEffect(() => {
    const initializePage = () => {
      if (authLoading) return;

      if (!user) {
        window.location.href = "/login?redirect=/workflow";
        return;
      }

      const storedProjectId = localStorage.getItem("currentProjectId");
      const storedProblem = localStorage.getItem("currentProblem");

      if (!storedProjectId) {
        window.location.href = "/new";
        return;
      }

      setProjectId(storedProjectId);
      setProblem(storedProblem);
      setIsLoading(false);
      setIsInitialized(true);

      fetch(`/api/projects/${storedProjectId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.current_iteration) {
            setCurrentIteration(data.current_iteration);
          }
          if (data.iteration_feedback) {
            setIterationFeedback(data.iteration_feedback);
          }
        })
        .catch(() => {});
    };

    if (!isInitialized) {
      initializePage();
    }
  }, [user, authLoading, isInitialized]);

  // Calculate feedback loop arrow from Evaluate left edge -> Understand left edge
  useEffect(() => {
    const calculateArrow = () => {
      if (
        !containerRef.current ||
        !evaluateRef.current ||
        !understandRef.current
      )
        return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const evalRect = evaluateRef.current.getBoundingClientRect();
      const understandRect = understandRef.current.getBoundingClientRect();

      const startX = evalRect.left - containerRect.left;
      const startY = evalRect.top - containerRect.top + evalRect.height / 2;

      const endX = understandRect.left - containerRect.left;
      const endY =
        understandRect.top - containerRect.top + understandRect.height / 2;

      const gutterX = startX - 30;

      setArrowPath(
        `M ${startX} ${startY} L ${gutterX} ${startY} L ${gutterX} ${endY} L ${endX} ${endY}`
      );
    };

    calculateArrow();
    window.addEventListener("resize", calculateArrow);
    const timer = setTimeout(calculateArrow, 100);
    return () => {
      window.removeEventListener("resize", calculateArrow);
      clearTimeout(timer);
    };
  }, [isInitialized, isLoading]);

  const nav = (route: string) => router.push(`${route}?projectId=${projectId}`);

  if (isLoading || authLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl">Loading workflow...</p>
      </div>
    );
  }

  if (!projectId || !problem) {
    return null;
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen p-10 flex flex-col">
        {/* Header */}
        <h1 className="text-4xl md:text-6xl font-bold text-center mb-3">
          Problem Domain
        </h1>
        <p className="text-4xl text-center mb-2">
          {problem || "Not specified"}
        </p>
        {currentIteration > 1 && (
          <p className="text-center text-gray-500 text-sm mb-2">
            Iteration {currentIteration}
          </p>
        )}

        {/* Workflow Diagram */}
        <div className="flex-1 flex items-center justify-center">
          <div
            ref={containerRef}
            className="relative w-full max-w-[820px] overflow-visible"
          >
            {/* Feedback loop SVG overlay */}
            {arrowPath && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
                style={{ overflow: "visible" }}
              >
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="8"
                    markerHeight="6"
                    refX="7"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="black" />
                  </marker>
                </defs>
                <path
                  d={arrowPath}
                  stroke="black"
                  strokeWidth="1.5"
                  fill="none"
                  markerEnd="url(#arrowhead)"
                />
              </svg>
            )}

            {/* -- Research -- */}
            <div className="flex justify-center">
              <button
                onClick={() => nav("/workflow/research")}
                className="bg-black text-white font-semibold rounded-[10px] hover:opacity-90 transition-opacity
                           px-10 py-5 w-full max-w-[540px] text-center"
              >
                <span className="block text-[22px] font-bold">Research</span>
                <span className="block text-sm font-normal mt-1 opacity-80">
                  (Upload primary and secondary research)
                </span>
              </button>
            </div>

            {/* Arrow down */}
            <div className="flex justify-center">
              <svg width="20" height="40" viewBox="0 0 20 40" fill="none">
                <line
                  x1="10"
                  y1="0"
                  x2="10"
                  y2="32"
                  stroke="black"
                  strokeWidth="1.5"
                />
                <polygon points="6,30 10,38 14,30" fill="black" />
              </svg>
            </div>

            {/* -- Understand -- */}
            <div className="flex justify-center">
              <button
                ref={understandRef}
                onClick={() => nav("/workflow/understand")}
                className="bg-[#4a4a4a] text-white font-semibold rounded-[10px] hover:opacity-90 transition-opacity
                           px-10 py-5 w-full max-w-[500px] text-center"
              >
                <span className="block text-[22px] font-bold">Understand</span>
                <span className="block text-sm font-normal mt-1 opacity-80">
                  (Summarize each piece of research)
                </span>
              </button>
            </div>

            {/* Arrow down */}
            <div className="flex justify-center">
              <svg width="20" height="40" viewBox="0 0 20 40" fill="none">
                <line
                  x1="10"
                  y1="0"
                  x2="10"
                  y2="32"
                  stroke="black"
                  strokeWidth="1.5"
                />
                <polygon points="6,30 10,38 14,30" fill="black" />
              </svg>
            </div>

            {/* -- Analyze -- */}
            <div className="flex justify-center">
              <button
                onClick={() => nav("/workflow/analysis")}
                className="bg-[#7a7a7a] text-white font-semibold rounded-[10px] hover:opacity-90 transition-opacity
                           px-10 py-5 w-full max-w-[460px] text-center"
              >
                <span className="block text-[22px] font-bold">
                  {currentIteration > 1 && iterationFeedback?.has_problem_feedback
                    ? "Refine Problem"
                    : currentIteration > 1 && !iterationFeedback?.has_problem_feedback
                      ? "Chosen Problem"
                      : "Analyze"}
                </span>
                <span className="block text-sm font-normal mt-1 opacity-80">
                  {currentIteration > 1 && iterationFeedback?.has_problem_feedback
                    ? "(Refine the problem based on feedback)"
                    : currentIteration > 1 && !iterationFeedback?.has_problem_feedback
                      ? "(Problem carried from previous round)"
                      : "(Identify a Problem)"}
                </span>
              </button>
            </div>

            {/* Arrow down */}
            <div className="flex justify-center">
              <svg width="20" height="40" viewBox="0 0 20 40" fill="none">
                <line
                  x1="10"
                  y1="0"
                  x2="10"
                  y2="32"
                  stroke="black"
                  strokeWidth="1.5"
                />
                <polygon points="6,30 10,38 14,30" fill="black" />
              </svg>
            </div>

            {/* -- Ideate (centered) with Evaluate (left) -- */}
            <div className="flex justify-center">
              <div className="relative">
                {/* Ideate - centered in the main flow */}
                <button
                  onClick={() => nav("/workflow/ideate")}
                  className="bg-[#b0b0b0] text-black font-semibold rounded-[10px] hover:opacity-90 transition-opacity
                             px-6 py-5 w-[240px] text-center"
                >
                  <span className="block text-[22px] font-bold">
                    {currentIteration > 1 && (iterationFeedback?.has_solution_feedback || iterationFeedback?.has_image_feedback)
                      ? "Refine Ideas"
                      : "Ideate"}
                  </span>
                  <span className="block text-sm font-normal mt-1 opacity-70">
                    {currentIteration > 1 && iterationFeedback?.has_solution_feedback
                      ? "(Refine solutions based on feedback)"
                      : currentIteration > 1 && iterationFeedback?.has_image_feedback
                        ? "(Regenerate images based on feedback)"
                        : "(Generate solutions)"}
                  </span>
                </button>

                {/* Evaluate + arrow positioned to the left of Ideate */}
                <div className="absolute right-full top-1/2 -translate-y-1/2 flex items-center">
                  <button
                    ref={evaluateRef}
                    onClick={() => nav("/workflow/evaluate")}
                    className="bg-[#d0d0d0] text-black font-semibold rounded-[10px] hover:opacity-90 transition-opacity
                               px-6 py-5 w-[240px] text-center"
                  >
                    <span className="block text-[22px] font-bold">
                      Evaluate
                    </span>
                    <span className="block text-sm font-normal mt-1 opacity-70">
                      (Get user feedback)
                    </span>
                  </button>
                  <div className="px-2">
                    <svg width="30" height="20" viewBox="0 0 30 20" fill="none">
                      <line
                        x1="6"
                        y1="10"
                        x2="30"
                        y2="10"
                        stroke="black"
                        strokeWidth="1.5"
                      />
                      <polygon points="8,6 0,10 8,14" fill="black" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* -- Arrow down to Result (centered) + Progress Report (right) -- */}
            <div className="relative flex justify-center">
              <div className="flex flex-col items-center">
                <svg width="20" height="36" viewBox="0 0 20 36" fill="none">
                  <line
                    x1="10"
                    y1="0"
                    x2="10"
                    y2="28"
                    stroke="black"
                    strokeWidth="1.5"
                  />
                  <polygon points="6,26 10,34 14,26" fill="black" />
                </svg>

                <button
                  onClick={() => nav("/workflow/report")}
                  className="w-40 h-16 rounded-full bg-black text-white flex items-center justify-center
                             text-2xl font-bold hover:opacity-90 transition-opacity mt-1"
                >
                  Result
                </button>
              </div>

              {/* Progress Report - positioned to the right */}
              <button
                onClick={() => nav("/workflow/report")}
                className="absolute right-0 bottom-0 bg-[#e0e0e0] text-black font-semibold rounded-[10px] hover:opacity-90 transition-opacity
                           px-8 py-3 text-center"
              >
                <span className="block text-[16px] font-bold">Progress</span>
                <span className="block text-[16px] font-bold">Report</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
