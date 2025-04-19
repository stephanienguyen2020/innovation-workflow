"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";

// Placeholder project data
const placeholderProjects = [
  {
    id: "1",
    name: "AI-Powered Customer Service",
    lastModified: "2023-12-15",
    problemDescription:
      "Reducing customer support wait times while maintaining satisfaction",
  },
  {
    id: "2",
    name: "Supply Chain Optimization",
    lastModified: "2023-11-30",
    problemDescription:
      "Improving delivery efficiency and reducing logistics costs",
  },
  {
    id: "3",
    name: "Employee Wellness Program",
    lastModified: "2023-11-10",
    problemDescription:
      "Increasing employee satisfaction and reducing turnover",
  },
  {
    id: "4",
    name: "Digital Transformation Initiative",
    lastModified: "2023-10-22",
    problemDescription:
      "Modernizing legacy systems and improving data accessibility",
  },
];

export default function PastProjectsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login?redirect=/past");
    }
  }, [user, loading, router]);

  // If still loading or not authenticated, don't render the content
  if (loading || !user) {
    return (
      <div className="flex min-h-[calc(100vh-68px)] items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleDelete = (projectId: string) => {
    // TODO: Implement project deletion
    console.log(`Deleting project ${projectId}`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Your Past Projects</h1>
      </div>

      {placeholderProjects.length === 0 ? (
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
        <div className="bg-white rounded-[10px] shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Project Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Problem Description
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Last Modified
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {placeholderProjects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => router.push(`/project/${project.id}`)}
                        className="text-sm font-medium text-gray-900 hover:text-[#001DFA]"
                      >
                        {project.name}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-md truncate">
                      {project.problemDescription}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(project.lastModified)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="text-red-600 hover:text-red-700 font-medium text-sm rounded-[10px] px-4 py-2 border border-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
