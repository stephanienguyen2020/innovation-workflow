"use client";

import { useState, useEffect, Suspense } from "react";
import { useAuth } from "../../context/AuthContext";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";

function SignupContent() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [redirectMessage, setRedirectMessage] = useState("");
  const { signup, loading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Check if redirected from a protected page
    const redirect = searchParams.get("redirect");
    if (redirect) {
      setRedirectMessage("Create an account to continue");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      await signup(firstName, lastName, email, password);
      // After successful signup, redirect to login page with a success message
      router.push(
        "/login?message=Account created successfully! Please log in."
      );
    } catch (err) {
      console.error("Signup error:", err);
      setError(err instanceof Error ? err.message : "Error creating account");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 p-8 bg-white rounded-[10px] shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold">Sign Up</h2>
          {redirectMessage && (
            <p className="mt-2 text-center text-sm text-amber-600">
              {redirectMessage}
            </p>
          )}
          {error && (
            <p className="mt-2 text-center text-sm text-red-600">{error}</p>
          )}
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="first-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  First Name
                </label>
                <input
                  id="first-name"
                  name="first-name"
                  type="text"
                  autoComplete="given-name"
                  required
                  className="relative block w-full rounded-[10px] border border-gray-200 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#001DFA] focus:ring-1 focus:ring-[#001DFA]"
                  placeholder="Enter your first name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="last-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Last Name
                </label>
                <input
                  id="last-name"
                  name="last-name"
                  type="text"
                  autoComplete="family-name"
                  required
                  className="relative block w-full rounded-[10px] border border-gray-200 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#001DFA] focus:ring-1 focus:ring-[#001DFA]"
                  placeholder="Enter your last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
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
                autoComplete="new-password"
                required
                className="relative block w-full rounded-[10px] border border-gray-200 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#001DFA] focus:ring-1 focus:ring-[#001DFA]"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirm Password
              </label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                className="relative block w-full rounded-[10px] border border-gray-200 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#001DFA] focus:ring-1 focus:ring-[#001DFA]"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-6">
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-[10px] bg-[#001DFA] px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#001DFA] disabled:opacity-50"
            >
              {loading ? "Creating Account..." : "Sign Up"}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-gray-600">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-[#001DFA] hover:text-blue-700 font-medium"
            >
              Login
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

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          Loading...
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  );
}
