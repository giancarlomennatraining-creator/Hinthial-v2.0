/**
 * FASE 7: solo struttura dati e gestione dello stato --- nessuno sblocco
 * automatico dei dati in questa fase (v. HINTHIAL_MVP.md). Ogni amico
 * nasce "active": lo stato intermedio "pending" ("In attesa") è stato
 * eliminato (v. richiesta utente) --- non bloccava nulla di voluto, solo
 * nascondeva l'amico dal selettore dei destinatari delle capsule finché
 * non lo si segnava a mano come attivo, un effetto collaterale confuso.
 */
export type FriendStatus = "active" | "revoked";

export interface FriendListItem {
  id: string;
  /**
   * "Nome visualizzato" in interfaccia --- non necessariamente "nome
   * cognome": alla creazione parte come combinazione dei due (v.
   * Create/EditFriendForm), ma resta un campo a sé, modificabile in
   * seguito senza che si aggiorni più da solo. Decrypted client-side.
   */
  name: string;
  email: string;
  /** "" se non impostato (amici creati prima che questi campi esistessero) --- mai un errore. Decrypted client-side. */
  firstName: string;
  /** V. firstName. */
  lastName: string;
  /** Path Storage di una foto caricata a mano dal proprietario, o null --- v. avatarUrl. */
  avatarPath: string | null;
  /**
   * URL pubblico della SOLA foto caricata a mano (da avatarPath) --- la
   * foto reale di un eventuale account collegato si risolve altrove, di
   * proposito (v. FriendsPanel.tsx, checkLinkedAccounts): una chiamata a
   * parte per amico, per non rallentare ogni caricamento dell'elenco.
   */
  avatarUrl: string | null;
  /** Free text (es. "Coniuge", "Avvocato", "Fratello") --- non cifrato, etichetta gestionale. */
  role: string;
  status: FriendStatus;
  /**
   * PERSONA (false) vs AMICO (true) --- v. domain/friends/friend-requests.
   * Diventa true SOLO se una richiesta di amicizia è stata accettata da
   * entrambe le parti: mai impostabile direttamente, a differenza di
   * `status`/`isGuardian`. Una PERSONA resta comunque un destinatario
   * valido di capsule --- solo un AMICO può diventare GUARDIANO.
   */
  isFriend: boolean;
  /**
   * "Guardiano" --- riceve un avviso informale se il proprietario risulta
   * inattivo a lungo (Dead Man's Switch semplificato per le capsule, v.
   * domain/capsules). Diventa true solo accettando una richiesta apposita
   * (v. domain/friends/guardian-requests) --- possibile solo se `isFriend`
   * è già true. Nessun accesso concesso di per sé: solo un flag.
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
  /** "Nome visualizzato" --- v. FriendListItem.name. */
  name: string;
  email: string;
  /** Facoltativi --- v. FriendListItem.firstName/lastName. */
  firstName: string;
  lastName: string;
  role: string;
}
