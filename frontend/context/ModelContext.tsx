"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

export type ProviderType = "gemini" | "claude" | "openai";

export interface AIModel {
  id: string;
  name: string;
  provider: ProviderType;
  tier: string;
  isNew?: boolean;
}

export const AI_MODELS: AIModel[] = [
  // Gemini models
  {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    provider: "gemini",
    tier: "High",
    isNew: true,
  },
  {
    id: "gemini-3.1-flash-lite-preview",
    name: "Gemini 3.1 Flash Lite",
    provider: "gemini",
    tier: "Low",
    isNew: true,
  },

  // Claude models
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    provider: "claude",
    tier: "High",
    isNew: true,
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "claude",
    tier: "Medium",
    isNew: true,
  },

  // OpenAI models
  {
    id: "gpt-5.4",
    name: "GPT-5.4",
    provider: "openai",
    tier: "High",
    isNew: true,
  },
  { id: "o3", name: "o3", provider: "openai", tier: "High" },
  { id: "o4-mini", name: "o4-mini", provider: "openai", tier: "Medium" },
];

// Keep backward-compatible exports
export type GeminiModel = AIModel;
export const GEMINI_MODELS = AI_MODELS;

const DEFAULT_MODEL = "gemini-3.1-flash-lite-preview";

export const PROVIDER_LABELS: Record<ProviderType, string> = {
  gemini: "Google Gemini",
  claude: "Anthropic Claude",
  openai: "OpenAI",
};

interface ModelContextType {
  model: string;
  setModel: (model: string) => void;
  currentModel: AIModel;
  models: AIModel[];
  provider: ProviderType;
}

const ModelContext = createContext<ModelContextType | undefined>(undefined);

export function ModelProvider({ children }: { children: ReactNode }) {
  const [model, setModelState] = useState<string>(DEFAULT_MODEL);

  useEffect(() => {
    const savedModel = localStorage.getItem("selected_model");
    if (savedModel && AI_MODELS.some((m) => m.id === savedModel)) {
      setModelState(savedModel);
    }
  }, []);

  const setModel = (newModel: string) => {
    setModelState(newModel);
    localStorage.setItem("selected_model", newModel);
  };

  const currentModel = AI_MODELS.find((m) => m.id === model) || AI_MODELS[0];
  const provider = currentModel.provider;

  return (
    <ModelContext.Provider
      value={{ model, setModel, currentModel, models: AI_MODELS, provider }}
    >
      {children}
    </ModelContext.Provider>
  );
}

export function useModel() {
  const context = useContext(ModelContext);
  if (context === undefined) {
    throw new Error("useModel must be used within a ModelProvider");
  }
  return context;
}
