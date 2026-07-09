import type { User } from "@/types";

const USERS_KEY = "jigo-local-users-v1";
const SESSION_KEY = "jigo-local-session-v1";

type LocalAccount = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
};

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`jigo:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readUsers(): LocalAccount[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]") as LocalAccount[];
  } catch {
    return [];
  }
}

function writeUsers(users: LocalAccount[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getLocalSession(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function setLocalSession(user: User | null) {
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else localStorage.removeItem(SESSION_KEY);
}

export async function localSignUp(
  name: string,
  email: string,
  password: string,
): Promise<{ user: User } | { error: string }> {
  const normalized = email.trim().toLowerCase();
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const users = readUsers();
  if (users.some((u) => u.email === normalized)) {
    return { error: "An account with this email already exists. Sign in instead." };
  }

  const account: LocalAccount = {
    id: `local_${crypto.randomUUID()}`,
    email: normalized,
    name: name.trim(),
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  writeUsers([...users, account]);

  const user: User = {
    id: account.id,
    name: account.name,
    email: account.email,
    role: "Admin",
  };
  setLocalSession(user);
  return { user };
}

export async function localSignIn(
  email: string,
  password: string,
): Promise<{ user: User } | { error: string }> {
  const normalized = email.trim().toLowerCase();
  const users = readUsers();
  const account = users.find((u) => u.email === normalized);
  if (!account) return { error: "Invalid email or password." };

  const hash = await hashPassword(password);
  if (hash !== account.passwordHash) return { error: "Invalid email or password." };

  const user: User = {
    id: account.id,
    name: account.name,
    email: account.email,
    role: "Admin",
  };
  setLocalSession(user);
  return { user };
}

export function localSignOut() {
  setLocalSession(null);
}
