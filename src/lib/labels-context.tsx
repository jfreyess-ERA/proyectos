'use client';
import { createContext, useContext } from 'react';
import type { Label } from './types';

export const LabelsContext = createContext<Label[]>([]);

export function useLabels() {
  return useContext(LabelsContext);
}
