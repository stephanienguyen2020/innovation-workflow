"use client";

import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { useState, useRef, useEffect } from "react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowDropdown(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setShowDropdown(false);
    }, 300); // 300ms delay before hiding
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <nav className="bg-white shadow-sm py-4 px-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">
          Innovation Workflow
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link
                href="/past"
                className="inline-flex items-center justify-center bg-black text-white rounded-[10px] px-6 py-2 text-base font-medium"
              >
                Past Projects
              </Link>
              <div
                className="relative"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <button className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-800 font-medium focus:outline-none">
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user?.name || "User"}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span>
                      {user?.name && user.name.length > 0
                        ? user.name.charAt(0).toUpperCase()
                        : "U"}
                    </span>
                  )}
                </button>

                {showDropdown && (
                  <div
                    className="absolute right-0 mt-2 w-48 bg-white rounded-[10px] shadow-lg py-1 z-10"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div className="px-4 py-2 text-sm text-gray-700 border-b flex items-center gap-2">
                      <span className="text-gray-400">👤</span>
                      {user?.name || user?.email || "User"}
                    </div>
                    <button
                      onClick={async () => {
                        await logout();
                        setShowDropdown(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <span className="text-gray-400">🚪</span>
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex items-center justify-center bg-white border border-[#0000FF] text-[#0000FF] rounded-[10px] px-5 py-2 text-sm font-medium hover:bg-blue-50"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center bg-[#0000FF] text-white rounded-[10px] px-5 py-2 text-sm font-medium hover:bg-blue-700"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
