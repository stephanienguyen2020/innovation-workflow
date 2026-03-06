"use client";

import { useState, Suspense } from "react";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const emailFromUrl = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailFromUrl);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !code || !newPassword || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          token: code,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to reset password");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(
          "/login?message=Password reset successfully! Please log in."
        );
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 p-8 bg-white rounded-[10px] shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold">
            Reset Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter the code sent to your email and your new password
          </p>
        </div>

        {success ? (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-[10px] text-center">
            Password reset successfully! Redirecting to login...
          </div>
        ) : (
          <>
            {error && (
              <p className="text-center text-sm text-red-600">{error}</p>
            )}
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  className="relative block w-full rounded-[10px] border border-gray-200 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#001DFA] focus:ring-1 focus:ring-[#001DFA]"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label
                  htmlFor="code"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Reset Code
                </label>
                <input
                  id="code"
                  type="text"
                  required
                  maxLength={6}
                  className="relative block w-full rounded-[10px] border border-gray-200 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#001DFA] focus:ring-1 focus:ring-[#001DFA] text-center tracking-[0.5em] text-lg font-mono"
                  placeholder="000000"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
              </div>

              <div>
                <label
                  htmlFor="new-password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    required
                    className="relative block w-full rounded-[10px] border border-gray-200 p-3 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#001DFA] focus:ring-1 focus:ring-[#001DFA]"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Confirm New Password
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="relative block w-full rounded-[10px] border border-gray-200 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#001DFA] focus:ring-1 focus:ring-[#001DFA]"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full justify-center rounded-[10px] bg-[#001DFA] px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#001DFA] disabled:opacity-50"
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          </>
        )}

        <div className="mt-6 text-center space-y-2">
          <Link
            href="/forgot-password"
            className="block text-sm text-[#001DFA] hover:text-blue-700 font-medium"
          >
            Resend reset code
          </Link>
          <Link
            href="/login"
            className="block text-sm text-[#001DFA] hover:text-blue-700 font-medium"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          Loading...
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
