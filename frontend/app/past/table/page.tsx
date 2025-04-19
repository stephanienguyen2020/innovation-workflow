"use client";

import { useAuth } from "../../../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

// Placeholder project data
const placeholderProjects = [
  {
    id: "1",
    name: "AI-Powered Customer Service",
    lastModified: "2023-12-15",
    problemDescription:
      "Reducing customer support wait times while maintaining satisfaction",
    status: "Completed",
  },
  {
    id: "2",
    name: "Supply Chain Optimization",
    lastModified: "2023-11-30",
    problemDescription:
      "Improving delivery efficiency and reducing logistics costs",
    status: "In Progress",
  },
  {
    id: "3",
    name: "Employee Wellness Program",
    lastModified: "2023-11-10",
    problemDescription:
      "Increasing employee satisfaction and reducing turnover",
    status: "Completed",
  },
  {
    id: "4",
    name: "Digital Transformation Initiative",
    lastModified: "2023-10-22",
    problemDescription:
      "Modernizing legacy systems and improving data accessibility",
    status: "In Progress",
  },
];

export default function PastProjectsTableView() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [viewType, setViewType] = useState<"table" | "card">("table");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login?redirect=/past/table");
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Past Projects</h1>
        <div className="flex space-x-2">
          <Link
            href="/past"
            className={`px-4 py-2 rounded-md font-medium text-sm ${
              viewType === "card"
                ? "bg-[#0000FF] text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Card View
          </Link>
          <Link
            href="/past/table"
            className={`px-4 py-2 rounded-md font-medium text-sm ${
              viewType === "table"
                ? "bg-[#0000FF] text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Table View
          </Link>
        </div>
      </div>

      {placeholderProjects.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-500 mb-4">
            You don't have any past projects yet.
          </p>
          <button
            onClick={() => router.push("/new")}
            className="inline-flex items-center justify-center bg-[#0000FF] text-white rounded-md px-6 py-3 text-lg font-medium
                     transition-transform duration-200 hover:bg-blue-700"
          >
            Start a New Project
          </button>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Project Name
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Last Modified
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {placeholderProjects.map((project) => (
                <tr key={project.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {project.name}
                    </div>
                    <div className="text-sm text-gray-500 line-clamp-1">
                      {project.problemDescription}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {formatDate(project.lastModified)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${
                        project.status === "Completed"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {project.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => router.push(`/project/${project.id}`)}
                      className="text-[#0000FF] hover:text-blue-700"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
