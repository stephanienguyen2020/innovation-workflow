"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 p-8 bg-white rounded-[10px] shadow-md">
        <h2 className="text-center text-2xl font-bold text-red-600">
          Something went wrong!
        </h2>
        <p className="text-center text-gray-600 mt-2">
          {error.message || "An unexpected error occurred"}
        </p>
        <div className="flex justify-center mt-4">
          <button
            onClick={reset}
            className="bg-[#001DFA] text-white px-4 py-2 rounded-md"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
