"use client";

import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function WelcomeScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Add a useEffect to force component update when user state changes
  useEffect(() => {
    // This is just a dependency effect to ensure the component re-renders
    // when the user state changes
    console.log(
      "User state in WelcomeScreen:",
      user ? "logged in" : "not logged in"
    );
  }, [user]);

  const handleStartNewClick = () => {
    if (!user) {
      router.push("/login?redirect=/new");
      return;
    }
    router.push("/new");
  };

  return (
    <div className="flex min-h-[calc(100vh-68px)] flex-col items-center justify-center p-4">
      <div className="text-center space-y-4">
        <h1 className="text-2xl md:text-3xl font-medium">
          Hi{user ? ` ${user.name},` : ","} welcome to
        </h1>
        <div className="text-4xl md:text-6xl font-bold space-y-2">
          <div>Innovation</div>
          <div>Workflow</div>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
          <button
            onClick={handleStartNewClick}
            className="inline-flex items-center justify-center bg-[#0000FF] text-white rounded-[20px] px-8 py-6 text-lg font-medium min-w-[200px]
                     transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            start new
          </button>
          {!user && (
            <button
              onClick={() => router.push("/login?redirect=/past")}
              className="inline-flex items-center justify-center bg-black text-white rounded-[20px] px-8 py-6 text-lg font-medium min-w-[200px]
                       transition-transform duration-200 hover:scale-105 active:scale-95"
            >
              past project
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
