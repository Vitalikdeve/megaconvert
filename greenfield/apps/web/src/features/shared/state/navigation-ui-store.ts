'use client';

import { create } from 'zustand';

interface NavigationUiState {
  closeMobileNavigation(): void;
  mobileNavigationOpen: boolean;
  openMobileNavigation(): void;
  setMobileNavigationOpen(value: boolean): void;
  toggleMobileNavigation(): void;
}

export const useNavigationUiStore = create<NavigationUiState>()((set) => ({
  closeMobileNavigation: () => set({ mobileNavigationOpen: false }),
  mobileNavigationOpen: false,
  openMobileNavigation: () => set({ mobileNavigationOpen: true }),
  setMobileNavigationOpen: (mobileNavigationOpen) => set({ mobileNavigationOpen }),
  toggleMobileNavigation: () =>
    set((state) => ({
      mobileNavigationOpen: !state.mobileNavigationOpen,
    })),
}));
