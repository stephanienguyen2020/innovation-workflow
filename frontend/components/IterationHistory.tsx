"use client";

import { useState, useEffect } from "react";
import { Clock, ChevronDown, Loader2 } from "lucide-react";

interface IterationSnapshot {
  iteration_number: number;
  created_at: string;
  feedback_text?: string;
  stages_snapshot: Record<string, any>;
}

interface IterationHistoryProps {
  projectId: string;
  currentIteration: number;
}

export default function IterationHistory({
  projectId,
  currentIteration,
}: IterationHistoryProps) {
  const [iterations, setIterations] = useState<IterationSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!projectId || !isOpen) return;

    const fetchIterations = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/projects/${projectId}/iterations`);
        if (response.ok) {
          const data = await response.json();
          setIterations(data);
        }
      } catch (err) {
        console.error("Error fetching iterations:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchIterations();
  }, [projectId, isOpen]);

  if (currentIteration <= 1 && iterations.length === 0) {
    return null;
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-600" />
          <span className="font-medium text-gray-800">
            Iteration History
          </span>
          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
            v{currentIteration}
          </span>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-500 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : iterations.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-2">
              No previous iterations yet.
            </p>
          ) : (
            iterations.map((iter) => (
              <div key={iter.iteration_number} className="border border-gray-100 rounded-lg">
                <button
                  onClick={() =>
                    setExpanded(
                      expanded === iter.iteration_number
                        ? null
                        : iter.iteration_number
                    )
                  }
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      Iteration {iter.iteration_number}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(iter.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      expanded === iter.iteration_number ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {expanded === iter.iteration_number && (
                  <div className="px-3 pb-3 space-y-2">
                    {iter.feedback_text && (
                      <div>
                        <span className="text-xs font-medium text-gray-500">
                          Feedback:
                        </span>
                        <p className="text-sm text-gray-700 mt-0.5">
                          {iter.feedback_text}
                        </p>
                      </div>
                    )}
                    <div className="text-xs text-gray-400">
                      Snapshot of stages 1-5 at this iteration
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
