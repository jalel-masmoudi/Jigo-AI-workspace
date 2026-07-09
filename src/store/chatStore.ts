import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage, Conversation } from "@/types";

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  messages: Record<string, ChatMessage[]>;
  setActive: (id: string | null) => void;
  newConversation: () => string;
  appendMessage: (id: string, msg: ChatMessage) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,
      messages: {},
      setActive: (id) => set({ activeId: id }),
      newConversation: () => {
        const id = `c_${Date.now()}`;
        const conv: Conversation = { id, title: "New chat", updatedAt: "now" };
        set({
          conversations: [conv, ...get().conversations],
          activeId: id,
          messages: { ...get().messages, [id]: [] },
        });
        return id;
      },
      appendMessage: (id, msg) =>
        set((s) => ({ messages: { ...s.messages, [id]: [...(s.messages[id] || []), msg] } })),
    }),
    {
      name: "chat-storage",
    },
  ),
);
