'use client';
import { createContext, useContext } from 'react';
import type { User } from './types';

export const UsersContext = createContext<User[]>([]);

export function useUsers() {
  return useContext(UsersContext);
}
