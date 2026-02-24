"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ModelType = 'openai' | 'gemini';

interface ModelContextType {
  model: ModelType;
  setModel: (model: ModelType) => void;
}

const ModelContext = createContext<ModelContextType | undefined>(undefined);

export function ModelProvider({ children }: { children: ReactNode }) {
  const [model, setModelState] = useState<ModelType>('openai');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const savedModel = localStorage.getItem('selected_model') as ModelType;
    if (savedModel && (savedModel === 'openai' || savedModel === 'gemini')) {
      setModelState(savedModel);
    }
    setIsInitialized(true);
  }, []);

  const setModel = (newModel: ModelType) => {
    setModelState(newModel);
    localStorage.setItem('selected_model', newModel);
  };

  return (
    <ModelContext.Provider value={{ model, setModel }}>
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
