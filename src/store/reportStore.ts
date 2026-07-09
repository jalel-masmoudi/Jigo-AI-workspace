import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Report } from "@/types";

interface State {
  reports: Report[];
  addReport: (report: Report) => void;
}

export const useReportStore = create<State>()(
  persist(
    (set) => ({
      reports: [],
      addReport: (report) => set((state) => ({ reports: [report, ...state.reports] })),
    }),
    {
      name: "report-storage",
    },
  ),
);
