"use client";

import { useState } from "react";
import { FileText, Loader2, Download } from "lucide-react";
import jsPDF from "jspdf";

interface StageReportButtonProps {
  projectId: string;
  stageNumber: number;
  stageName: string;
  disabled?: boolean;
}

export default function StageReportButton({
  projectId,
  stageNumber,
  stageName,
  disabled = false,
}: StageReportButtonProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    if (!projectId || generating || disabled) return;

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/stages/${stageNumber}/report`,
        { method: "POST" }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to generate report");
      }

      const data = await response.json();

      // Generate PDF
      const pdf = new jsPDF();
      const marginLeft = 20;
      const maxWidth = 170;
      let y = 20;

      pdf.setFontSize(18);
      pdf.text(`Stage ${stageNumber}: ${stageName} Report`, marginLeft, y);
      y += 12;

      pdf.setFontSize(10);
      pdf.text(
        `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
        marginLeft,
        y
      );
      y += 10;

      pdf.setFontSize(11);
      const lines = pdf.splitTextToSize(
        (data.report_content || "").replace(/\*\*/g, ""),
        maxWidth
      );
      for (const line of lines) {
        if (y > 280) {
          pdf.addPage();
          y = 20;
        }
        pdf.text(line, marginLeft, y);
        y += 5;
      }

      pdf.save(`stage_${stageNumber}_${stageName.toLowerCase()}_report.pdf`);
    } catch (err) {
      console.error("Error generating stage report:", err);
      setError((err as Error).message || "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start">
      <button
        onClick={handleGenerateReport}
        disabled={generating || disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {generating ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <FileText className="w-3.5 h-3.5" />
            Stage Report
          </>
        )}
      </button>
      {error && <span className="text-xs text-red-500 mt-1">{error}</span>}
    </div>
  );
}
