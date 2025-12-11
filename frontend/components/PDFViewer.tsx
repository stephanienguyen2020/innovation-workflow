"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Download,
  ExternalLink,
  Loader2,
  AlertCircle,
  Maximize2,
  Minimize2,
} from "lucide-react";

interface PDFViewerProps {
  projectId: string;
  filename?: string;
  className?: string;
}

export default function PDFViewer({
  projectId,
  filename,
  className = "",
}: PDFViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Create the PDF URL for the iframe
    const url = `/api/projects/${projectId}/file`;
    setPdfUrl(url);
    setLoading(false);
  }, [projectId]);

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/file`);
      if (!response.ok) {
        throw new Error("Failed to download file");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || "document.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading file:", err);
      setError("Failed to download file");
    }
  };

  const handleOpenInNewTab = () => {
    window.open(`/api/projects/${projectId}/file`, "_blank");
  };

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center p-8 bg-gray-50 rounded-lg ${className}`}
      >
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading document...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center p-8 bg-red-50 rounded-lg ${className}`}
      >
        <AlertCircle className="w-6 h-6 text-red-500" />
        <span className="ml-2 text-red-600">{error}</span>
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-red-500" />
          <span className="font-medium text-gray-700 truncate max-w-[200px]">
            {filename || "Uploaded Document"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 hover:bg-gray-200 rounded-md transition-colors"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <Minimize2 className="w-4 h-4 text-gray-600" />
            ) : (
              <Maximize2 className="w-4 h-4 text-gray-600" />
            )}
          </button>
          <button
            onClick={handleOpenInNewTab}
            className="p-2 hover:bg-gray-200 rounded-md transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={handleDownload}
            className="p-2 hover:bg-gray-200 rounded-md transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* PDF Viewer */}
      {pdfUrl && (
        <div
          className={`transition-all duration-300 ${
            expanded ? "h-[80vh]" : "h-[500px]"
          }`}
        >
          <iframe
            src={`${pdfUrl}#toolbar=1&navpanes=0`}
            className="w-full h-full border-0"
            title="PDF Document"
          />
        </div>
      )}
    </div>
  );
}
