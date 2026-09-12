/**
 * FASE 7: solo struttura dati e gestione dello stato --- nessuno sblocco
 * automatico dei dati in questa fase (v. HINTHIAL_MVP.md).
 */
export type FriendStatus = "pending" | "active" | "revoked";

export interface FriendListItem {
  id: string;
  /** Decrypted client-side for display. */
  name: string;
  email: string;
  /** Free text (es. "Coniuge", "Avvocato", "Fratello") --- non cifrato, etichetta gestionale. */
  role: string;
  status: FriendStatus;
  /**
   * "Guardiano" --- riceve un avviso informale se il proprietario risulta
   * inattivo a lungo (Dead Man's Switch semplificato per le capsule, v.
   * domain/capsules). Nessuna conferma richiesta da parte sua, nessun
   * accesso concesso: solo un flag, come `status`.
   */
  isGuardian: boolean;
  /**
   * Se questo amico ha un account Hinthial registrato con la stessa
   * email, il suo id --- risolto via lookupFriendAccount() e salvato
   * qui (v. FASE A del piano di condivisione capsule). Null finché non
   * risolto o se non corrisponde a nessun account: non è un errore, è
   * lo stato di partenza per ogni amico appena aggiunto.
   */
  linkedUserId: string | null;
  createdAt: string;
}

/** Esito di lookupFriendAccount() quando l'email corrisponde a un account registrato. */
export interface LinkedAccountMatch {
  userId: string;
  /** Nome e cognome del profilo --- già in chiaro lato server, nessuna decrittazione qui. */
  displayName: string;
}

export interface FriendInput {
  name: string;
  email: string;
  role: string;
}
