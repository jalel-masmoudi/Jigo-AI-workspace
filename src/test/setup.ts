import { webcrypto } from "node:crypto";
import { beforeEach, vi } from "vitest";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const testStorage = new MemoryStorage();

vi.stubGlobal("crypto", webcrypto);
vi.stubGlobal("localStorage", testStorage);
vi.stubGlobal("window", {
  localStorage: testStorage,
  location: { origin: "https://app.test" },
});

beforeEach(() => {
  testStorage.clear();
});
