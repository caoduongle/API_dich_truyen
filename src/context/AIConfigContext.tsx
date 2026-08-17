import React, { createContext, useContext } from 'react';
import { useAIConfig } from '../hooks/useAIConfig';

export type AIConfigContextType = ReturnType<typeof useAIConfig>;

const AIConfigContext = createContext<AIConfigContextType | null>(null);

export function AIConfigProvider({ children }: { children: React.ReactNode }) {
  const aiConfig = useAIConfig();

  return (
    <AIConfigContext.Provider value={aiConfig}>
      {children}
    </AIConfigContext.Provider>
  );
}

export function useAIConfigContext(): AIConfigContextType {
  const context = useContext(AIConfigContext);
  if (!context) {
    throw new Error('useAIConfigContext must be used within an AIConfigProvider');
  }
  return context;
}
