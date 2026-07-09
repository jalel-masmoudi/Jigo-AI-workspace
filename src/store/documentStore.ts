import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DocumentItem } from "@/types";

interface State {
  documents: DocumentItem[];
  add: (d: DocumentItem) => void;
}

export const useDocumentStore = create<State>()(
  persist(
    (set) => ({
      documents: [],
      add: (d) => set((s) => ({ documents: [d, ...s.documents] })),
    }),
    {
      name: "document-storage",
    },
  ),
);
