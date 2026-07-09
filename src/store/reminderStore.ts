import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Reminder } from "@/types/integrations";

interface ReminderState {
  reminders: Reminder[];
  add: (r: Reminder) => void;
  addMany: (items: Reminder[]) => void;
  complete: (id: string) => void;
  remove: (id: string) => void;
  snooze: (id: string, dueAt: string) => void;
}

export const useReminderStore = create<ReminderState>()(
  persist(
    (set) => ({
      reminders: [],
      add: (r) => set((s) => ({ reminders: [r, ...s.reminders] })),
      addMany: (items) =>
        set((s) => {
          const ids = new Set(s.reminders.map((r) => r.id));
          const fresh = items.filter((i) => !ids.has(i.id));
          return { reminders: [...fresh, ...s.reminders] };
        }),
      complete: (id) =>
        set((s) => ({
          reminders: s.reminders.map((r) => (r.id === id ? { ...r, completed: true } : r)),
        })),
      remove: (id) => set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) })),
      snooze: (id, dueAt) =>
        set((s) => ({
          reminders: s.reminders.map((r) => (r.id === id ? { ...r, dueAt } : r)),
        })),
    }),
    { name: "jigo-reminders" },
  ),
);
