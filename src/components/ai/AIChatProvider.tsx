"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { AISource } from "@/domain/ai/types";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  sources?: AISource[];
}

interface AIChatContextValue {
  messages: ChatMessage[];
  addMessages: (newMessages: ChatMessage[]) => void;
  clear: () => void;
}

const AIChatContext = createContext<AIChatContextValue | null>(null);

/**
 * Cronologia della chat dell'Assistente AI --- vive qui apposta, non
 * dentro AIPanel: AIPanel si smonta e rimonta ogni volta che lasci /ai e
 * ci torni (normale navigazione interna di Next.js), mentre questo
 * Provider è montato una sola volta in AppShell, esattamente come
 * MasterKeyProvider --- sopravvive alla navigazione, si perde solo a un
 * refresh vero o a un nuovo login.
 *
 * Deliberatamente non persistita da nessun'altra parte (niente
 * localStorage/sessionStorage, niente database): a differenza della
 * Master Key, il testo della chat *è già* il contenuto sensibile in
 * chiaro, non solo la chiave per leggerlo --- salvarlo da qualche parte
 * allargherebbe cosa resta esposto a riposo. Se in futuro (FASE 11)
 * avrà senso una cronologia vera, sarà un salto deliberato, non un
 * effetto collaterale di questo Provider.
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
