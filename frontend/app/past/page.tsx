"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, Search } from "lucide-react";
import type { Project } from "../api/projects/route";

type SortField = "problem_domain" | "created_at" | "updated_at" | "status";
type SortDirection = "asc" | "desc";

export default function PastProjectsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("updated_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const filteredAndSortedProjects = useMemo(() => {
    let filtered = projects;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = projects.filter((p) =>
        p.problem_domain.toLowerCase().includes(query)
      );
    }

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortField === "problem_domain" || sortField === "status") {
        comparison = a[sortField].localeCompare(b[sortField]);
      } else {
        comparison =
          new Date(a[sortField]).getTime() - new Date(b[sortField]).getTime();
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [projects, searchQuery, sortField, sortDirection]);

  const allVisibleSelected =
    filteredAndSortedProjects.length > 0 &&
    filteredAndSortedProjects.every((p) => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredAndSortedProjects.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredAndSortedProjects.forEach((p) => next.add(p.id));
        return next;
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login?redirect=/past");
      return;
    }

    const fetchProjects = async () => {
      try {
        const response = await fetch("/api/projects", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) throw new Error("Failed to fetch projects");

        const data = await response.json();
        setProjects(data);
      } catch (err) {
        setError("Failed to load projects. Please try again later.");
        console.error("Error fetching projects:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) fetchProjects();
  }, [user, loading, router]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      setDeletingProjectId(projectId);
      setShowDeleteConfirm(null);

      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Failed to delete project");

      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(projectId);
        return next;
      });
    } catch (err) {
      console.error("Error deleting project:", err);
      setError("Failed to delete project. Please try again.");
    } finally {
      setDeletingProjectId(null);
    }
  };

  const handleDeleteSelected = async () => {
    try {
      setIsDeletingSelected(true);
      setShowBulkDeleteConfirm(false);
      await Promise.all(
        [...selectedIds].map((id) =>
          fetch(`/api/projects/${id}`, { method: "DELETE" })
        )
      );
      setProjects((prev) => prev.filter((p) => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Error deleting selected projects:", err);
      setError("Failed to delete selected projects. Please try again.");
    } finally {
      setIsDeletingSelected(false);
    }
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return <span className="ml-1">{sortDirection === "asc" ? "▲" : "▼"}</span>;
  };

  if (loading || isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-68px)] items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[calc(100vh-68px)] items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Your Past Projects</h1>
        {selectedIds.size > 0 && (
          showBulkDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                Delete {selectedIds.size} selected project{selectedIds.size > 1 ? "s" : ""}?
              </span>
              <button
                onClick={handleDeleteSelected}
                disabled={isDeletingSelected}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
              >
                {isDeletingSelected ? <Loader2 className="w-4 h-4 animate-spin" /> : "Yes, delete"}
              </button>
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete {selectedIds.size} selected
            </button>
          )
        )}
      </div>

      {projects.length === 0 ? (
        <div className="bg-gray-50 rounded-[10px] p-8 text-center">
          <p className="text-gray-500 mb-4">
            You don't have any past projects yet.
          </p>
          <button
            onClick={() => router.push("/new")}
            className="inline-flex items-center justify-center bg-[#001DFA] text-white rounded-[10px] px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            Start a New Project
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-[#001DFA] focus:border-transparent"
              />
            </div>
          </div>

          <div className="bg-white rounded-[10px] shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-[#001DFA] cursor-pointer"
                        title="Select all"
                      />
                    </th>
                    <th
                      className="px-6 py-3 text-left text-sm font-semibold text-gray-900 cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => toggleSort("problem_domain")}
                    >
                      Project Name{sortIndicator("problem_domain")}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-sm font-semibold text-gray-900 cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => toggleSort("created_at")}
                    >
                      Created{sortIndicator("created_at")}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-sm font-semibold text-gray-900 cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => toggleSort("updated_at")}
                    >
                      Last Modified{sortIndicator("updated_at")}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-sm font-semibold text-gray-900 cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => toggleSort("status")}
                    >
                      Status{sortIndicator("status")}
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredAndSortedProjects.map((project) => (
                    <tr
                      key={project.id}
                      className={`hover:bg-gray-50 ${selectedIds.has(project.id) ? "bg-blue-50" : ""}`}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(project.id)}
                          onChange={() => toggleSelect(project.id)}
                          className="w-4 h-4 rounded border-gray-300 text-[#001DFA] cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => router.push(`/project/${project.id}`)}
                          className="text-sm font-medium text-gray-900 hover:text-[#001DFA]"
                        >
                          {project.problem_domain}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(project.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(project.updated_at)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                            ${
                              project.status === "completed"
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                        >
                          {project.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {showDeleteConfirm === project.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-sm text-gray-600">Delete?</span>
                            <button
                              onClick={() => handleDeleteProject(project.id)}
                              disabled={deletingProjectId === project.id}
                              className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                            >
                              {deletingProjectId === project.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                "Yes"
                              )}
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(null)}
                              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowDeleteConfirm(project.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete project"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
