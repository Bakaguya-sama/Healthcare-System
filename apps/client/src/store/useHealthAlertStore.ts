import { create } from "zustand";

export type NotificationType = "critical" | "warning" | "info" | "success";

export interface CriticalAlert {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  displayedAt?: string;
}

interface HealthAlertStore {
  currentAlert: CriticalAlert | null;
  displayedAlertIds: Set<string>;

  // Actions
  setCurrentAlert: (alert: CriticalAlert | null) => void;
  dismissAlert: () => void;
  markAsDisplayed: (alertId: string) => void;
  hasBeenDisplayed: (alertId: string) => boolean;
}

export const useHealthAlertStore = create<HealthAlertStore>((set, get) => ({
  currentAlert: null,
  displayedAlertIds: new Set(),

  setCurrentAlert: (alert: CriticalAlert | null) => {
    set({ currentAlert: alert });
    if (alert) {
      get().markAsDisplayed(alert.id);
    }
  },

  dismissAlert: () => {
    set({ currentAlert: null });
  },

  markAsDisplayed: (alertId: string) => {
    set((state: HealthAlertStore) => ({
      displayedAlertIds: new Set([...state.displayedAlertIds, alertId]),
    }));
  },

  hasBeenDisplayed: (alertId: string) => {
    return get().displayedAlertIds.has(alertId);
  },
}));
