import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Notification } from "@/types";

interface NotificationState {
  items: Notification[];
  add: (n: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  unreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (n) => set((s) => ({ items: [n, ...s.items].slice(0, 100) })),
      markRead: (id) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, read: true } : i)),
        })),
      markAllRead: () => set((s) => ({ items: s.items.map((i) => ({ ...i, read: true })) })),
      unreadCount: () => get().items.filter((i) => !i.read).length,
    }),
    { name: "jigo-notifications-v2" },
  ),
);
