import React, { createContext, useContext } from 'react';
import { useProjects } from '../hooks/useProjects';

export type ProjectContextType = ReturnType<typeof useProjects>;

const ProjectContext = createContext<ProjectContextType | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const projectState = useProjects();

  return (
    <ProjectContext.Provider value={projectState}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext(): ProjectContextType {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }
  return context;
}
