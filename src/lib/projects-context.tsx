'use client';
import { createContext, useContext } from 'react';
import type { Project } from './types';

export const ProjectsContext = createContext<Project[]>([]);

export function useProjects() {
  return useContext(ProjectsContext);
}
