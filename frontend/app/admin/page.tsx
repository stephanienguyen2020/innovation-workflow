"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface AllowedEmailsData {
  allowed_usernames: string[];
  allowed_domains: string[];
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<AllowedEmailsData>({
    allowed_usernames: [],
    allowed_domains: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Form states
  const [newUsername, setNewUsername] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [addingUsername, setAddingUsername] = useState(false);
  const [addingDomain, setAddingDomain] = useState(false);

  // Search/filter states
  const [usernameSearch, setUsernameSearch] = useState("");
  const [domainSearch, setDomainSearch] = useState("");

  // Check if user is admin
  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  // Fetch data
  useEffect(() => {
    if (user?.role === "admin") {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/allowed-emails");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to fetch data");
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const handleAddUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;

    setAddingUsername(true);
    setError("");

    try {
      const response = await fetch("/api/admin/allowed-emails/usernames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername.trim().toLowerCase() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to add username");
      }

      setNewUsername("");
      await fetchData();
      showSuccess(`Username "${newUsername}" added successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add username");
    } finally {
      setAddingUsername(false);
    }
  };

  const handleRemoveUsername = async (username: string) => {
    if (!confirm(`Are you sure you want to remove "${username}"?`)) return;

    setError("");

    try {
      const response = await fetch(
        `/api/admin/allowed-emails/usernames/${encodeURIComponent(username)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to remove username");
      }

      await fetchData();
      showSuccess(`Username "${username}" removed successfully`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove username"
      );
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;

    setAddingDomain(true);
    setError("");

    try {
      const response = await fetch("/api/admin/allowed-emails/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomain.trim().toLowerCase() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to add domain");
      }

      setNewDomain("");
      await fetchData();
      showSuccess(`Domain "${newDomain}" added successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add domain");
    } finally {
      setAddingDomain(false);
    }
  };

  const handleRemoveDomain = async (domain: string) => {
    if (!confirm(`Are you sure you want to remove "${domain}"?`)) return;

    setError("");

    try {
      const response = await fetch(
        `/api/admin/allowed-emails/domains/${encodeURIComponent(domain)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to remove domain");
      }

      await fetchData();
      showSuccess(`Domain "${domain}" removed successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove domain");
    }
  };

  // Filter usernames and domains based on search
  const filteredUsernames = data.allowed_usernames.filter((u) =>
    u.toLowerCase().includes(usernameSearch.toLowerCase())
  );
  const filteredDomains = data.allowed_domains.filter((d) =>
    d.toLowerCase().includes(domainSearch.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {successMessage}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Allowed Usernames Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Allowed Usernames
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {data.allowed_usernames.length} usernames registered
              </p>
            </div>

            {/* Add Username Form */}
            <form
              onSubmit={handleAddUsername}
              className="p-4 border-b border-gray-100 bg-gray-50"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Enter username (e.g., abc1234)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={addingUsername || !newUsername.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingUsername ? "Adding..." : "Add"}
                </button>
              </div>
            </form>

            {/* Search */}
            <div className="p-4 border-b border-gray-100">
              <input
                type="text"
                value={usernameSearch}
                onChange={(e) => setUsernameSearch(e.target.value)}
                placeholder="Search usernames..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Username List */}
            <div className="max-h-96 overflow-y-auto">
              {filteredUsernames.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  {usernameSearch
                    ? "No usernames match your search"
                    : "No usernames added yet"}
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filteredUsernames.map((username) => (
                    <li
                      key={username}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                    >
                      <span className="text-sm font-mono text-gray-700">
                        {username}
                      </span>
                      <button
                        onClick={() => handleRemoveUsername(username)}
                        className="text-red-500 hover:text-red-700 text-sm font-medium"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Allowed Domains Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Allowed Domains
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {data.allowed_domains.length} domains registered
              </p>
            </div>

            {/* Add Domain Form */}
            <form
              onSubmit={handleAddDomain}
              className="p-4 border-b border-gray-100 bg-gray-50"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="Enter domain (e.g., example.edu)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={addingDomain || !newDomain.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingDomain ? "Adding..." : "Add"}
                </button>
              </div>
            </form>

            {/* Search */}
            <div className="p-4 border-b border-gray-100">
              <input
                type="text"
                value={domainSearch}
                onChange={(e) => setDomainSearch(e.target.value)}
                placeholder="Search domains..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Domain List */}
            <div className="max-h-96 overflow-y-auto">
              {filteredDomains.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  {domainSearch
                    ? "No domains match your search"
                    : "No domains added yet"}
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filteredDomains.map((domain) => (
                    <li
                      key={domain}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                    >
                      <span className="text-sm font-mono text-gray-700">
                        {domain}
                      </span>
                      <button
                        onClick={() => handleRemoveDomain(domain)}
                        className="text-red-500 hover:text-red-700 text-sm font-medium"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
