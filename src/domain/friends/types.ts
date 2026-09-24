/** FASE 7: solo struttura dati e stato, nessuno sblocco automatico. Ogni amico nasce "active" --- lo stato "pending" è stato eliminato, nascondeva l'amico dal selettore capsule in modo confuso. */
export type FriendStatus = "active" | "revoked";

export interface FriendListItem {
  id: string;
  /** "Nome visualizzato" --- parte come nome+cognome ma resta un campo a sé, modificabile senza aggiornarsi da solo. Decrypted client-side. */
  name: string;
  email: string;
  /** "" se non impostato (amici pre-esistenti) --- mai un errore. Decrypted client-side. */
  firstName: string;
  /** V. firstName. */
  lastName: string;
  /** Path Storage di una foto caricata a mano, o null --- v. avatarUrl. */
  avatarPath: string | null;
  /** URL della SOLA foto caricata a mano --- quella di un account collegato si risolve altrove (v. FriendsPanel, checkLinkedAccounts). */
  avatarUrl: string | null;
  /** Free text (es. "Coniuge", "Avvocato") --- non cifrato, etichetta gestionale. */
  role: string;
  status: FriendStatus;
  /** PERSONA (false) vs AMICO (true) --- true solo se una richiesta di amicizia è accettata da entrambi, mai impostabile direttamente. */
  isFriend: boolean;
  /** Riceve un avviso se il proprietario è inattivo a lungo (Dead Man's Switch semplificato) --- richiede isFriend true. Nessun accesso concesso, solo un flag. */
  isGuardian: boolean;
  /** Id dell'account Hinthial con la stessa email, se c'è (v. lookupFriendAccount) --- null è lo stato di partenza normale. */
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
  /** "Nome visualizzato" --- v. FriendListItem.name. */
  name: string;
  email: string;
  /** Facoltativi --- v. FriendListItem.firstName/lastName. */
  firstName: string;
  lastName: string;
  role: string;
}
