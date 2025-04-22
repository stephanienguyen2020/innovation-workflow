"use client";

import { useState, useEffect, Suspense } from "react";
import { useAuth } from "../../context/AuthContext";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [redirectMessage, setRedirectMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const { login, loading, user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Add a useEffect to check if user is already logged in when the component mounts
  useEffect(() => {
    if (user && !loading) {
      const redirectTo = searchParams.get("redirect") || "/";
      router.push(redirectTo);
    }
  }, [user, loading, router, searchParams]);

  useEffect(() => {
    // Check if redirected from a protected page
    const redirect = searchParams.get("redirect");
    const message = searchParams.get("message");

    if (redirect) {
      setRedirectMessage("Please log in to continue");
    }

    if (message) {
      setSuccessMessage(message);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    try {
      await login(email, password);

      // Get the redirect URL from query params, or default to "/"
      const redirectTo = searchParams.get("redirect") || "/";

      // Use window.location.href for a full page reload after login
      window.location.href = redirectTo;
    } catch (err) {
      setError("Invalid email or password");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 p-8 bg-white rounded-[10px] shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold">Login</h2>
          {redirectMessage && (
            <p className="mt-2 text-center text-sm text-amber-600">
              {redirectMessage}
            </p>
          )}
          {successMessage && (
            <p className="mt-2 text-center text-sm text-green-600">
              {successMessage}
            </p>
          )}
          {error && (
            <p className="mt-2 text-center text-sm text-red-600">{error}</p>
          )}
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email-address"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full rounded-[10px] border border-gray-200 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#001DFA] focus:ring-1 focus:ring-[#001DFA]"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="relative block w-full rounded-[10px] border border-gray-200 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#001DFA] focus:ring-1 focus:ring-[#001DFA]"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-6">
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-[10px] bg-[#001DFA] px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#001DFA] disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-gray-600">
            Don't have an account?{" "}
            <Link
              href="/signup"
              className="text-[#001DFA] hover:text-blue-700 font-medium"
            >
              Sign up
            </Link>
          </p>
          <p className="text-sm text-gray-600">
            <Link
              href="/"
              className="text-[#001DFA] hover:text-blue-700 font-medium"
            >
              Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          Loading...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
