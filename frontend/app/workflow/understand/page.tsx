"use client";

export const dynamic = "force-dynamic";

import { useEffect, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

function UnderstandRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const projectId =
      searchParams.get("projectId") ||
      (typeof window !== "undefined"
        ? localStorage.getItem("currentProjectId")
        : null);

    // Everything is now inline on the Research page
    router.replace(
      projectId
        ? `/workflow/research?projectId=${projectId}`
        : "/workflow/research"
    );
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}

export default function UnderstandPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <UnderstandRedirect />
    </Suspense>
  );
}
