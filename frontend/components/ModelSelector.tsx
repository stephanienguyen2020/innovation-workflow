"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useModel, PROVIDER_LABELS, ProviderType } from "@/context/ModelContext";

const PROVIDER_ORDER: ProviderType[] = ["gemini", "claude", "openai"];

export default function ModelSelector() {
  const { model, setModel, currentModel, models } = useModel();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const modelsByProvider = PROVIDER_ORDER.map((provider) => ({
    provider,
    label: PROVIDER_LABELS[provider],
    models: models.filter((m) => m.provider === provider),
  }));

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
        <span>{currentModel.name}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-72 bg-white rounded-[10px] border border-gray-200 shadow-lg z-50 overflow-hidden max-h-[420px] overflow-y-auto">
          {modelsByProvider.map(({ provider, label, models: providerModels }) => (
            <div key={provider}>
              <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50 sticky top-0">
                {label}
              </div>
              <div className="py-0.5">
                {providerModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setModel(m.id);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors ${
                      model === m.id
                        ? "bg-gray-100 text-gray-900 font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span>
                      {m.name} ({m.tier})
                    </span>
                    {m.isNew && (
                      <span className="ml-auto px-1.5 py-0.5 text-[10px] font-semibold bg-gray-200 text-gray-600 rounded">
                        New
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
