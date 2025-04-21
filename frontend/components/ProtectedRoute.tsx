"use client";

import { useAuth } from "../context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  // Wait until component is mounted to prevent hydration errors
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && !user && mounted) {
      router.push(`/login?redirect=${pathname}`);
    }
  }, [user, loading, router, pathname, mounted]);

  // During SSR and initial mount, render a common UI that will be the same on server and client
  if (!mounted) {
    return (
      <div className="flex min-h-[calc(100vh-68px)] items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  // After mounting, we can safely use client-only states
  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-68px)] items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[calc(100vh-68px)] items-center justify-center">
        <p className="text-gray-500">Redirecting to login...</p>
      </div>
    );
  }

  return <>{children}</>;
}
