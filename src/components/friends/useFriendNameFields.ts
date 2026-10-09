"use client";

import { useCallback, useState, type ChangeEvent } from "react";

/**
 * I tre campi nome di un amico (v. CreateFriendForm, EditFriendForm): "Nome visualizzato" parte come "Nome Cognome" e
 * resta in sincronia finché non viene toccato direttamente. `fill` precompila i campi da un amico già salvato.
 */
export function useFriendNameFields() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [displayNameEdited, setDisplayNameEdited] = useState(false);

  function handleFirstNameChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setFirstName(value);
    if (!displayNameEdited) setDisplayName(`${value} ${lastName}`.trim());
  }

  function handleLastNameChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setLastName(value);
    if (!displayNameEdited) setDisplayName(`${firstName} ${value}`.trim());
  }

  function handleDisplayNameChange(event: ChangeEvent<HTMLInputElement>) {
    setDisplayName(event.target.value);
    setDisplayNameEdited(true);
  }

  const fill = useCallback((friend: { firstName: string; lastName: string; name: string }) => {
    setFirstName(friend.firstName);
    setLastName(friend.lastName);
    setDisplayName(friend.name);
    // Se il nome visualizzato coincide già con "nome cognome", resta "automatico" finché non viene toccato direttamente.
    setDisplayNameEdited(friend.name !== `${friend.firstName} ${friend.lastName}`.trim());
  }, []);

  return {
    firstName,
    lastName,
    displayName,
    fill,
    handleFirstNameChange,
    handleLastNameChange,
    handleDisplayNameChange,
  };
}
