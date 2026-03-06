"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", provider: "gemini", tier: "High", isNew: true },
  { id: "gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite", provider: "gemini", tier: "Low", isNew: true },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "gemini", tier: "High" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "gemini", tier: "Medium" },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", provider: "gemini", tier: "Low" },

  // Claude models
  { id: "claude-opus-4-6", name: "Claude Opus 4.6", provider: "claude", tier: "High", isNew: true },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "claude", tier: "Medium", isNew: true },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "claude", tier: "Low" },
  { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", provider: "claude", tier: "Medium" },

  // OpenAI models
  { id: "gpt-5.4", name: "GPT-5.4", provider: "openai", tier: "High", isNew: true },
  { id: "gpt-4.1", name: "GPT-4.1", provider: "openai", tier: "High" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "openai", tier: "Medium" },
  { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", provider: "openai", tier: "Low" },
  { id: "gpt-4o", name: "GPT-4o", provider: "openai", tier: "Medium" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai", tier: "Low" },
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
    const savedModel = localStorage.getItem('selected_model');
    if (savedModel && AI_MODELS.some(m => m.id === savedModel)) {
      setModelState(savedModel);
    }
  }, []);

  const setModel = (newModel: string) => {
    setModelState(newModel);
    localStorage.setItem('selected_model', newModel);
  };

  const currentModel = AI_MODELS.find(m => m.id === model) || AI_MODELS[0];
  const provider = currentModel.provider;

  return (
    <ModelContext.Provider value={{ model, setModel, currentModel, models: AI_MODELS, provider }}>
      {children}
    </ModelContext.Provider>
  );
}

export function useModel() {
  const context = useContext(ModelContext);
  if (context === undefined) {
    throw new Error('useModel must be used within a ModelProvider');
  }
  return context;
}
