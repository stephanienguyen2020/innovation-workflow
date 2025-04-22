"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export default function DebugPage() {
  const { user, loading } = useAuth();
  const [storageData, setStorageData] = useState<string | null>(null);
  const [cookieData, setCookieData] = useState<string | null>(null);
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Get data from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const userData = localStorage.getItem("innovation_workflow_user");
      setStorageData(userData);
    }
  }, []);

  // Function to manually check auth status
  const checkAuth = async () => {
    setIsChecking(true);
    try {
      const response = await fetch("/api/auth/me");
      const data = await response.json();
      setApiResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      setApiResponse(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setIsChecking(false);
    }
  };

  // Get cookies (this is just for display, cookies are httpOnly and can't be directly accessed)
  const checkCookies = () => {
    if (typeof document !== "undefined") {
      setCookieData(document.cookie || "No accessible cookies");
    }
  };

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6">Authentication Debug</h1>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Auth Context Status:</h2>
        <div className="bg-gray-100 p-4 rounded-md">
          <p>
            <strong>Loading:</strong> {loading ? "True" : "False"}
          </p>
          <p>
            <strong>User:</strong>{" "}
            {user ? "Authenticated" : "Not authenticated"}
          </p>
          {user && (
            <div className="mt-2">
              <p>
                <strong>User ID:</strong> {user.id}
              </p>
              <p>
                <strong>Name:</strong> {user.name}
              </p>
              <p>
                <strong>Email:</strong> {user.email}
              </p>
              <pre className="mt-2 bg-gray-200 p-2 rounded overflow-auto max-h-40">
                {JSON.stringify(user, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Local Storage:</h2>
        <div className="bg-gray-100 p-4 rounded-md">
          {storageData ? (
            <pre className="overflow-auto max-h-40">{storageData}</pre>
          ) : (
            <p>No user data in localStorage</p>
          )}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Cookies (Accessible):</h2>
        <button
          onClick={checkCookies}
          className="mb-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Check Cookies
        </button>
        <div className="bg-gray-100 p-4 rounded-md">
          {cookieData ? (
            <pre className="overflow-auto max-h-40">{cookieData}</pre>
          ) : (
            <p>Click the button to check cookies</p>
          )}
          <p className="mt-2 text-sm text-gray-600">
            Note: HttpOnly cookies used for authentication cannot be accessed
            via JavaScript
          </p>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Manual API Check:</h2>
        <button
          onClick={checkAuth}
          disabled={isChecking}
          className="mb-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
        >
          {isChecking ? "Checking..." : "Check Auth Status"}
        </button>
        <div className="bg-gray-100 p-4 rounded-md">
          {apiResponse ? (
            <pre className="overflow-auto max-h-40">{apiResponse}</pre>
          ) : (
            <p>Click the button to check authentication status</p>
          )}
        </div>
      </div>

      <div className="mt-8">
        <a
          href="/new"
          className="inline-block bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Return to New Project
        </a>
      </div>
    </div>
  );
}
