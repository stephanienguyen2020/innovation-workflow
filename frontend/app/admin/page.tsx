"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";

interface AllowedEmailsData {
  allowed_usernames: string[];
  allowed_domains: string[];
}

interface BulkResult {
  message: string;
  added: string[];
  skipped: string[];
  domains_added: string[];
  total_processed: number;
}

interface UserActivity {
  id: string;
  name: string;
  email: string;
  role: string;
  is_email_verified: boolean;
  created_at: string | null;
  last_login: string | null;
  total_projects: number;
  completed_projects: number;
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

  // Single username form
  const [newUsername, setNewUsername] = useState("");
  const [addingUsername, setAddingUsername] = useState(false);

  // Search
  const [usernameSearch, setUsernameSearch] = useState("");

  // Inline delete confirmation
  const [confirmingUsername, setConfirmingUsername] = useState<string | null>(null);

  // Bulk upload
  const [parsedEmails, setParsedEmails] = useState<string[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Student activity
  const [users, setUsers] = useState<UserActivity[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearch, setUserSearch] = useState("");
  const [sortField, setSortField] = useState<keyof UserActivity>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.role === "admin") {
      fetchData();
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const response = await fetch("/api/admin/users");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to fetch users");
      }
      const result = await response.json();
      setUsers(result);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleSort = (field: keyof UserActivity) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedAndFilteredUsers = users
    .filter(
      (u) =>
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === "boolean" && typeof bVal === "boolean") {
        return sortDirection === "asc"
          ? Number(aVal) - Number(bVal)
          : Number(bVal) - Number(aVal);
      }
      return 0;
    });

  const studentUsers = users.filter((u) => u.role !== "admin");
  const totalStudents = studentUsers.length;
  const verifiedStudents = studentUsers.filter(
    (u) => u.is_email_verified
  ).length;
  const totalProjects = studentUsers.reduce(
    (sum, u) => sum + u.total_projects,
    0
  );

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Invalid";
    }
  };

  const SortIcon = ({ field }: { field: keyof UserActivity }) => {
    if (sortField !== field)
      return <span className="text-gray-300 ml-1">&#8597;</span>;
    return (
      <span className="text-blue-600 ml-1">
        {sortDirection === "asc" ? "\u2191" : "\u2193"}
      </span>
    );
  };

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
    setTimeout(() => setSuccessMessage(""), 5000);
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
        throw new Error(errorData.detail || "Failed to add");
      }

      const result = await response.json();
      setNewUsername("");
      await fetchData();
      showSuccess(result.message || `"${newUsername}" added successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add username");
    } finally {
      setAddingUsername(false);
    }
  };

  const handleRemoveUsername = async (username: string) => {
    setConfirmingUsername(null);
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

  const parseCSVText = (text: string): string[] => {
    const emails: string[] = [];
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const parts = line.split(/[,;\t]/);
      for (const part of parts) {
        const val = part.trim().replace(/^["']|["']$/g, "");
        if (val.includes("@")) {
          emails.push(val.toLowerCase());
        }
      }
    }
    return [...new Set(emails)];
  };

  const parseExcelFile = async (file: File): Promise<string[]> => {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
      header: 1,
    });
    const emails: string[] = [];
    for (const row of rows) {
      for (const cell of row) {
        const val = String(cell || "").trim();
        if (val.includes("@")) {
          emails.push(val.toLowerCase());
        }
      }
    }
    return [...new Set(emails)];
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkResult(null);
    setError("");

    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let emails: string[] = [];

      if (ext === "csv" || ext === "txt") {
        const text = await file.text();
        emails = parseCSVText(text);
      } else if (ext === "xlsx" || ext === "xls") {
        emails = await parseExcelFile(file);
      } else {
        throw new Error(
          "Unsupported file type. Please use .csv, .xlsx, .xls, or .txt"
        );
      }

      if (emails.length === 0) {
        throw new Error("No valid email addresses found in the file");
      }

      setParsedEmails(emails);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
      setParsedEmails([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleBulkUpload = async () => {
    if (parsedEmails.length === 0) return;

    setBulkUploading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/allowed-emails/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: parsedEmails }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to bulk upload");
      }

      const result = await response.json();
      setBulkResult(result);
      setParsedEmails([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchData();
      showSuccess(result.message);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to bulk upload emails"
      );
    } finally {
      setBulkUploading(false);
    }
  };

  const filteredUsernames = data.allowed_usernames.filter((u) =>
    u.toLowerCase().includes(usernameSearch.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return null;
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
                  placeholder="e.g., abc1234 or abc1234@columbia.edu"
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
                    <li key={username} className="px-4 py-3 hover:bg-gray-50">
                      {confirmingUsername === username ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-gray-600">
                            Remove{" "}
                            <span className="font-mono font-medium text-gray-800">
                              {username}
                            </span>
                            ?
                          </span>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => setConfirmingUsername(null)}
                              className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleRemoveUsername(username)}
                              className="px-3 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-md"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-mono text-gray-700">
                            {username}
                          </span>
                          <button
                            onClick={() => setConfirmingUsername(username)}
                            className="text-red-500 hover:text-red-700 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Bulk Upload Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Bulk Upload
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Upload a file containing a list of email addresses
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* File Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select file
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.txt"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Supported: .csv, .xlsx, .xls, .txt — emails parsed from any
                  column
                </p>
              </div>

              {/* Preview */}
              {parsedEmails.length > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 mb-2">
                    Found {parsedEmails.length} email
                    {parsedEmails.length !== 1 ? "s" : ""}
                  </p>
                  <div className="max-h-40 overflow-y-auto mb-3">
                    <ul className="text-xs text-blue-700 space-y-0.5 font-mono">
                      {parsedEmails.slice(0, 15).map((email) => (
                        <li key={email}>{email}</li>
                      ))}
                      {parsedEmails.length > 15 && (
                        <li className="text-blue-500 italic">
                          ...and {parsedEmails.length - 15} more
                        </li>
                      )}
                    </ul>
                  </div>
                  <button
                    onClick={handleBulkUpload}
                    disabled={bulkUploading}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {bulkUploading
                      ? "Uploading..."
                      : `Add ${parsedEmails.length} emails to whitelist`}
                  </button>
                </div>
              )}

              {/* Results */}
              {bulkResult && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-1">
                  <p className="text-sm font-semibold text-green-800">
                    {bulkResult.message}
                  </p>
                  {bulkResult.added.length > 0 && (
                    <p className="text-xs text-green-700">
                      Added: {bulkResult.added.length} username
                      {bulkResult.added.length !== 1 ? "s" : ""}
                      {bulkResult.domains_added.length > 0 &&
                        ` + ${bulkResult.domains_added.length} domain${bulkResult.domains_added.length !== 1 ? "s" : ""}`}
                    </p>
                  )}
                  {bulkResult.skipped.length > 0 && (
                    <p className="text-xs text-yellow-700">
                      Skipped (already existed): {bulkResult.skipped.length}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Student Activity Section */}
        <div className="mt-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Student Activity
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Overview of all registered students and their activity
              </p>

              {/* Summary Stats */}
              {!usersLoading && (
                <div className="flex gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-sm text-gray-600">
                      Total Students:{" "}
                      <span className="font-semibold text-gray-900">
                        {totalStudents}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm text-gray-600">
                      Verified:{" "}
                      <span className="font-semibold text-gray-900">
                        {verifiedStudents}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    <span className="text-sm text-gray-600">
                      Total Projects:{" "}
                      <span className="font-semibold text-gray-900">
                        {totalProjects}
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-100">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Table */}
            {usersLoading ? (
              <div className="p-12 text-center">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                <p className="mt-2 text-sm text-gray-500">
                  Loading students...
                </p>
              </div>
            ) : sortedAndFilteredUsers.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                {userSearch
                  ? "No students match your search"
                  : "No students registered yet"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th
                        className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                        onClick={() => handleSort("name")}
                      >
                        Name
                        <SortIcon field="name" />
                      </th>
                      <th
                        className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                        onClick={() => handleSort("email")}
                      >
                        Email
                        <SortIcon field="email" />
                      </th>
                      <th
                        className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                        onClick={() => handleSort("role")}
                      >
                        Role
                        <SortIcon field="role" />
                      </th>
                      <th
                        className="px-4 py-3 text-center font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                        onClick={() => handleSort("is_email_verified")}
                      >
                        Verified
                        <SortIcon field="is_email_verified" />
                      </th>
                      <th
                        className="px-4 py-3 text-center font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                        onClick={() => handleSort("total_projects")}
                      >
                        Projects
                        <SortIcon field="total_projects" />
                      </th>
                      <th
                        className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                        onClick={() => handleSort("last_login")}
                      >
                        Last Login
                        <SortIcon field="last_login" />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedAndFilteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-medium">
                          {u.name || "-"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                          {u.email}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                              u.role === "admin"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {u.is_email_verified ? (
                            <span className="inline-block w-5 h-5 text-green-600">
                              &#10003;
                            </span>
                          ) : (
                            <span className="inline-block w-5 h-5 text-gray-300">
                              &#10007;
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700">
                          {u.total_projects}
                          {u.completed_projects > 0 && (
                            <span className="text-green-600 text-xs ml-1">
                              ({u.completed_projects} done)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {formatDate(u.last_login)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
