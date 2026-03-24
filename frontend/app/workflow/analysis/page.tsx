"use client";

export const dynamic = "force-dynamic";

import { useEffect, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

function AnalysisRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const projectId =
      searchParams.get("projectId") ||
      (typeof window !== "undefined"
        ? localStorage.getItem("currentProjectId")
        : null);

    // Analysis is now inline on the Understand page
    router.replace(
      projectId
        ? `/workflow/understand?projectId=${projectId}`
        : "/workflow/understand"
    );
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <AnalysisRedirect />
    </Suspense>
  );
}
