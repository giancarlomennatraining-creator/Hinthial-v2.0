"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { AISource } from "@/domain/ai/types";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  sources?: AISource[];
  /** Solo per mostrare l'ora nella bolla --- non un vero log, v. nota sotto. */
  createdAt: number;
}

interface AIChatContextValue {
  messages: ChatMessage[];
  addMessages: (newMessages: ChatMessage[]) => void;
  clear: () => void;
}

const AIChatContext = createContext<AIChatContextValue | null>(null);

/**
 * Cronologia della chat dell'Assistente AI, vive qui e non dentro AIPanel: AIPanel si smonta e rimonta ogni volta
 * che si lascia /ai e ci si torna, mentre questo Provider è montato una sola volta in AppShell come
 * MasterKeyProvider, sopravvive alla navigazione. Deliberatamente non persistita (niente localStorage/database):
 * il testo della chat è già contenuto sensibile in chiaro, non solo la chiave per leggerlo.
 */
export function AIChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const addMessages = useCallback((newMessages: ChatMessage[]) => {
    setMessages((prev) => [...prev, ...newMessages]);
  }, []);

  const clear = useCallback(() => setMessages([]), []);

  const value = useMemo(() => ({ messages, addMessages, clear }), [messages, addMessages, clear]);

  return <AIChatContext.Provider value={value}>{children}</AIChatContext.Provider>;
}

export function useAIChat(): AIChatContextValue {
  const ctx = useContext(AIChatContext);
  if (!ctx) {
    throw new Error("useAIChat must be used within an AIChatProvider");
  }
  return ctx;
}
