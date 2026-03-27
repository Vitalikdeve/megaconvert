'use client';

import { themeModes } from '@megaconvert/design-system';
import { z } from 'zod';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createValidatedPersistStorage } from '@/lib/storage/create-validated-persist-storage';

export const motionModes = ['full', 'reduced', 'system'] as const;
export const dockModes = ['collapsed', 'expanded'] as const;

export type MotionMode = (typeof motionModes)[number];
export type DockMode = (typeof dockModes)[number];

const shellPreferenceSchema = z.object({
  dockMode: z.enum(dockModes),
  motionMode: z.enum(motionModes),
  themeMode: z.enum(themeModes),
});

type ShellPreferenceSnapshot = z.infer<typeof shellPreferenceSchema>;

interface ShellPreferencesState extends ShellPreferenceSnapshot {
  setDockMode(value: DockMode): void;
  setMotionMode(value: MotionMode): void;
  setThemeMode(value: ShellPreferenceSnapshot['themeMode']): void;
  toggleDockMode(): void;
}

const storageKey = 'mc-shell-preferences';

export const useShellPreferencesStore = create<ShellPreferencesState>()(
  persist(
    (set) => ({
      dockMode: 'expanded',
      motionMode: 'system',
      setDockMode: (dockMode) => set({ dockMode }),
      setMotionMode: (motionMode) => set({ motionMode }),
      setThemeMode: (themeMode) => set({ themeMode }),
      themeMode: 'system',
      toggleDockMode: () =>
        set((state) => ({
          dockMode: state.dockMode === 'expanded' ? 'collapsed' : 'expanded',
        })),
    }),
    {
      merge: (persistedState, currentState) => {
        const parsedPersistedState = shellPreferenceSchema.safeParse(persistedState);

        if (!parsedPersistedState.success) {
          return currentState;
        }

        return {
          ...currentState,
          ...parsedPersistedState.data,
        };
      },
      name: storageKey,
      partialize: (state) => ({
        dockMode: state.dockMode,
        motionMode: state.motionMode,
        themeMode: state.themeMode,
      }),
      storage: createValidatedPersistStorage({
        key: storageKey,
        schema: shellPreferenceSchema,
      }),
      version: 2,
    },
  ),
);
