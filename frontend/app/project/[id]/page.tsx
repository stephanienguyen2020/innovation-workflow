"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";

interface ProjectFile {
  name: string;
  size: string;
  type: string;
}

interface Project {
  id: string;
  name: string;
  lastModified: string;
  problemDescription: string;
  finalSummary: string;
  files: ProjectFile[];
}

type ProjectsData = {
  [key: string]: Project;
};

// Placeholder project data for demo purposes
const projectDetails: ProjectsData = {
  "1": {
    id: "1",
    name: "AI-Powered Customer Service",
    lastModified: "2023-12-15",
    problemDescription:
      "Reducing customer support wait times while maintaining satisfaction",
    finalSummary: `
      # AI-Powered Customer Service Solution
      
      ## Problem Statement
      Company XYZ is facing increasing customer wait times for support, leading to decreased customer satisfaction scores.
      
      ## Solution Overview
      An AI-powered customer service platform that:
      - Provides immediate responses to common questions
      - Categorizes and routes complex inquiries to the right specialist
      - Learns from interactions to continuously improve response quality
      
      ## Expected Impact
      - 65% reduction in first-response time
      - 40% decrease in ticket resolution time
      - 25% improvement in customer satisfaction scores
      
      ## Implementation Timeline
      Phase 1 (Q1): Deployment of AI chatbot for common inquiries
      Phase 2 (Q2): Integration with existing CRM and knowledge base
      Phase 3 (Q3): Advanced ML models for continuous improvement
    `,
    files: [
      {
        name: "AI_Customer_Service_Proposal.pdf",
        size: "1.2 MB",
        type: "application/pdf",
      },
      {
        name: "Implementation_Timeline.xlsx",
        size: "850 KB",
        type: "application/excel",
      },
      { name: "Cost_Analysis.pdf", size: "945 KB", type: "application/pdf" },
    ],
  },
  "2": {
    id: "2",
    name: "Supply Chain Optimization",
    lastModified: "2023-11-30",
    problemDescription:
      "Improving delivery efficiency and reducing logistics costs",
    finalSummary: `
      # Supply Chain Optimization Initiative
      
      ## Problem Statement
      Rising logistics costs and delivery delays are impacting profit margins and customer satisfaction.
      
      ## Solution Overview
      A data-driven supply chain optimization system that:
      - Uses predictive analytics to anticipate demand fluctuations
      - Optimizes inventory levels across distribution centers
      - Recommends optimal shipping routes based on real-time conditions
      
      ## Expected Impact
      - 18% reduction in logistics costs
      - 30% decrease in delivery delays
      - 22% improvement in inventory turnover
      
      ## Implementation Timeline
      Phase 1 (Q1): Data integration and analytics platform setup
      Phase 2 (Q2): Predictive demand modeling implementation
      Phase 3 (Q3): Route optimization and real-time monitoring deployment
    `,
    files: [
      {
        name: "Supply_Chain_Analysis.pdf",
        size: "2.3 MB",
        type: "application/pdf",
      },
      {
        name: "Logistics_Cost_Projections.xlsx",
        size: "1.1 MB",
        type: "application/excel",
      },
      {
        name: "Implementation_Plan.pdf",
        size: "1.5 MB",
        type: "application/pdf",
      },
    ],
  },
  "3": {
    id: "3",
    name: "Employee Wellness Program",
    lastModified: "2023-11-10",
    problemDescription:
      "Increasing employee satisfaction and reducing turnover",
    finalSummary: `
      # Comprehensive Employee Wellness Program
      
      ## Problem Statement
      High employee turnover and declining engagement are impacting productivity and company culture.
      
      ## Solution Overview
      A holistic employee wellness program that:
      - Provides physical and mental health resources
      - Offers flexible work arrangements based on role requirements
      - Creates career development pathways tailored to individual goals
      
      ## Expected Impact
      - 35% reduction in employee turnover
      - 28% increase in employee engagement scores
      - 15% decrease in absenteeism
      
      ## Implementation Timeline
      Phase 1 (Q1): Health resources and wellness platform launch
      Phase 2 (Q2): Flexible work policy implementation
      Phase 3 (Q3): Career development pathway creation
    `,
    files: [
      {
        name: "Wellness_Program_Outline.pdf",
        size: "1.7 MB",
        type: "application/pdf",
      },
      {
        name: "Employee_Survey_Results.xlsx",
        size: "920 KB",
        type: "application/excel",
      },
      { name: "ROI_Analysis.pdf", size: "1.3 MB", type: "application/pdf" },
    ],
  },
  "4": {
    id: "4",
    name: "Digital Transformation Initiative",
    lastModified: "2023-10-22",
    problemDescription:
      "Modernizing legacy systems and improving data accessibility",
    finalSummary: `
      # Enterprise Digital Transformation
      
      ## Problem Statement
      Legacy systems are causing inefficiencies, data siloes, and limiting business agility.
      
      ## Solution Overview
      A comprehensive digital transformation that:
      - Migrates core systems to cloud infrastructure
      - Implements a unified data platform for cross-department insights
      - Deploys modern APIs for system integration and future scalability
      
      ## Expected Impact
      - 40% improvement in system performance
      - 60% reduction in maintenance costs
      - 25% increase in business process efficiency
      
      ## Implementation Timeline
      Phase 1 (Q1): Cloud infrastructure and migration planning
      Phase 2 (Q2-Q3): System migration and data platform implementation
      Phase 3 (Q4): API development and legacy system decommissioning
    `,
    files: [
      {
        name: "Digital_Transformation_Roadmap.pdf",
        size: "3.2 MB",
        type: "application/pdf",
      },
      {
        name: "System_Migration_Plan.xlsx",
        size: "1.8 MB",
        type: "application/excel",
      },
      {
        name: "Budget_and_ROI_Projection.pdf",
        size: "2.1 MB",
        type: "application/pdf",
      },
    ],
  },
};

export default function ProjectDetailsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    const projectId = params.id as string;
    if (projectId && projectDetails[projectId]) {
      setProject(projectDetails[projectId]);
    }
  }, [params.id]);

  if (!project) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Project Details</h1>
            <button
              onClick={() => router.push("/past")}
              className="text-blue-600 hover:text-blue-800"
            >
              Back to Projects
            </button>
          </div>
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">
              Project not found or still loading...
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">{project.name}</h1>
          <button
            onClick={() => router.push("/past")}
            className="inline-flex items-center justify-center bg-gray-200 text-gray-800 rounded-md px-4 py-2 text-sm font-medium hover:bg-gray-300"
          >
            Back to Projects
          </button>
        </div>

        {/* Project Summary Section */}
        <div className="bg-white rounded-lg shadow-md mb-8 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b">
            <h2 className="text-xl font-semibold">Project Summary</h2>
          </div>
          <div className="p-6">
            <pre className="whitespace-pre-wrap font-sans text-gray-800">
              {project.finalSummary}
            </pre>
          </div>
        </div>

        {/* PDF Preview Section */}
        <div className="bg-white rounded-lg shadow-md mb-8 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b">
            <h2 className="text-xl font-semibold">PDF Preview</h2>
          </div>
          <div className="p-6">
            <div className="aspect-w-16 aspect-h-9 bg-gray-100 rounded border">
              {/* In a real app, this would be an actual PDF viewer */}
              <div className="flex items-center justify-center h-96 bg-gray-50 text-gray-400">
                <p>PDF preview would be displayed here</p>
              </div>
            </div>
          </div>
        </div>

        {/* Project Files Section */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b">
            <h2 className="text-xl font-semibold">Project Files</h2>
          </div>
          <div className="p-6">
            <div className="divide-y">
              {project.files.map((file, index) => (
                <div
                  key={index}
                  className="py-4 flex justify-between items-center"
                >
                  <div className="flex items-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-gray-400 mr-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">{file.size}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      className="text-sm text-blue-600 hover:text-blue-800"
                      onClick={() => {
                        // In a real app, this would trigger a file download
                        alert(`Downloading ${file.name}`);
                      }}
                    >
                      Download
                    </button>
                    <button
                      className="text-sm text-blue-600 hover:text-blue-800"
                      onClick={() => {
                        // In a real app, this would open the file in a viewer
                        alert(`Viewing ${file.name}`);
                      }}
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
