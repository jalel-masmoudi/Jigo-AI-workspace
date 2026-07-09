export const APP_NAME = "Jigo AI Workspace";
export const APP_SHORT_NAME = "Jigo";
export const API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL) ||
  "/api";
