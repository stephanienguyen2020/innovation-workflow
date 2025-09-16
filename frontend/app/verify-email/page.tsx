"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function VerifyEmailContent() {
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();

  // Handle hydration and auto-refresh
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasRefreshed = window.location.hash === "#refreshed";

    if (!hasRefreshed) {
      // First visit - add hash and refresh
      window.location.hash = "#refreshed";
      setNeedsRefresh(true);
      window.location.reload();
      return;
    }

    // Remove hash and proceed normally
    if (window.location.hash === "#refreshed") {
      window.history.replaceState(
        null,
        document.title,
        window.location.pathname + window.location.search
      );
    }

    setIsHydrated(true);
  }, []);

  useEffect(() => {
    // Only run after hydration
    if (!isHydrated) return;

    // Get email from query params
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams, isHydrated]);

  useEffect(() => {
    // Countdown timer for resend cooldown
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!email || !verificationCode) {
      setError("Please fill in all fields");
      return;
    }

    if (verificationCode.length !== 6) {
      setError("Verification code must be 6 digits");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          verification_code: verificationCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Verification failed");
        return;
      }

      setSuccessMessage("Email verified successfully! Redirecting to login...");
      // Clean up the refresh flag on successful verification
      sessionStorage.removeItem("verify-email-refreshed");
      setTimeout(() => {
        router.push(
          "/login?message=Email verified successfully! Please log in."
        );
      }, 2000);
    } catch (err) {
      setError("An error occurred during verification");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    if (resendCooldown > 0) {
      return;
    }

    setResendLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Failed to resend verification code");
        return;
      }

      setSuccessMessage("Verification code resent! Please check your email.");
      setResendCooldown(60); // 60 second cooldown
    } catch (err) {
      setError("An error occurred while resending verification code");
    } finally {
      setResendLoading(false);
    }
  };

  // Show loading until hydrated or if refresh is needed
  if (!isHydrated || needsRefresh) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 p-8 bg-white rounded-[10px] shadow-md">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-bold">
              {needsRefresh ? "Refreshing..." : "Loading..."}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {needsRefresh
                ? "Fixing page display..."
                : "Preparing email verification..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 p-8 bg-white rounded-[10px] shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold">
            Verify Your Email
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            We've sent a 6-digit verification code to your email address.
          </p>
          {error && (
            <p className="mt-2 text-center text-sm text-red-600">{error}</p>
          )}
          {successMessage && (
            <p className="mt-2 text-center text-sm text-green-600">
              {successMessage}
            </p>
          )}
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleVerify}>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email Address
              </label>
              <input
                id="email"
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
                htmlFor="verification-code"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Verification Code
              </label>
              <input
                id="verification-code"
                name="verification-code"
                type="text"
                maxLength={6}
                pattern="[0-9]{6}"
                required
                className="relative block w-full rounded-[10px] border border-gray-200 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#001DFA] focus:ring-1 focus:ring-[#001DFA] text-center text-2xl tracking-widest"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(
                    e.target.value.replace(/\D/g, "").slice(0, 6)
                  )
                }
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter the 6-digit code sent to your email
              </p>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-[10px] bg-[#001DFA] px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#001DFA] disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify Email"}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center space-y-3">
          <button
            onClick={handleResendCode}
            disabled={resendLoading || resendCooldown > 0}
            className="text-[#001DFA] hover:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resendLoading
              ? "Resending..."
              : resendCooldown > 0
              ? `Resend code in ${resendCooldown}s`
              : "Resend verification code"}
          </button>

          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Already verified?{" "}
              <Link
                href="/login"
                className="text-[#001DFA] hover:text-blue-700 font-medium"
              >
                Log in
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
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          Loading...
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
