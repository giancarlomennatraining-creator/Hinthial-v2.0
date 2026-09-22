"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { getEmergencyCard, saveEmergencyCard } from "@/domain/emergency-card/repository";
import { BLOOD_TYPES, EMPTY_EMERGENCY_CARD, isEmergencyCardEmpty, type EmergencyCard, type EmergencyContact } from "@/domain/emergency-card/types";
import { printOnlyMarkedContent } from "@/lib/print";
import { useToast } from "@/components/ui/ToastProvider";

function emptyContact(): EmergencyContact {
  return { name: "", relation: "", phone: "" };
}

/**
 * La scheda d'emergenza --- pensata per il portafoglio o il frigorifero,
 * non per lo schermo: pochi campi scritti una volta (gruppo sanguigno,
 * allergie, condizioni, farmaci), un medico di riferimento a sé
 * (staccato dai contatti generici: chi presta soccorso ha due domande
 * diverse, chi avvisare e chi conosce la storia clinica), e contatti di
 * emergenza. L'anteprima qui sotto è la stessa cosa che finisce sulla
 * tessera stampata --- non un'approssimazione.
 *
 * Tutto cifrato (v. domain/emergency-card/repository.ts): richiede la
 * master key, come ogni altro contenuto dell'utente.
 */
export function EmergencyCardPanel({
  masterKey,
  userId,
  firstName,
  lastName,
  birthDate,
}: {
  masterKey: CryptoKey;
  userId: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
}) {
  const [supabase] = useState(() => createClient());
  const showToast = useToast();

  const [card, setCard] = useState<EmergencyCard>(EMPTY_EMERGENCY_CARD);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getEmergencyCard(supabase, masterKey, userId);
        if (!cancelled) setCard(loaded);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Impossibile caricare la scheda.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, masterKey, userId]);

  function updateContact(index: number, patch: Partial<EmergencyContact>) {
    setCard((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  }

  function addContact() {
    setCard((prev) => ({ ...prev, contacts: [...prev.contacts, emptyContact()] }));
  }

  function removeContact(index: number) {
    setCard((prev) => ({ ...prev, contacts: prev.contacts.filter((_, i) => i !== index) }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const toSave = { ...card, contacts: card.contacts.filter((c) => c.name.trim()) };
      await saveEmergencyCard(supabase, masterKey, userId, toSave);
      setCard((prev) => ({ ...prev, contacts: toSave.contacts, updatedAt: new Date().toISOString() }));
      showToast("Scheda d'emergenza salvata.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile salvare la scheda.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>;
  }

  const fullName = `${firstName} ${lastName}`.trim();
  const empty = isEmergencyCardEmpty(card);
  const visibleContacts = card.contacts.filter((c) => c.name.trim());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Scheda d&apos;emergenza</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
          Pochi campi, scritti una volta, cifrati come tutto il resto --- servono solo a generare
          una tessera da stampare e portare nel portafoglio o tenere sul frigorifero, per chi
          presta soccorso quando non puoi parlare tu.
        </p>
      </div>

      {/*
        items-start: senza, il pannello di destra (anteprima+stampa) si
        estende per default all'altezza della colonna sinistra --- più
        alta appena si aggiunge un contatto --- e quello spazio vuoto ma
        presente intercetta i click sugli elementi della colonna
        sinistra che finiscono alla stessa altezza (v. segnalazione
        utente: "Rimuovi il contatto" non risponde al click).
      */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,28rem)_1fr]">
        <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="blood-type" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Gruppo sanguigno
              </label>
              <select
                id="blood-type"
                value={card.bloodType}
                onChange={(e) => setCard((prev) => ({ ...prev, bloodType: e.target.value }))}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              >
                <option value="">Non specificato</option>
                {BLOOD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="allergies" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Allergie
            </label>
            <textarea
              id="allergies"
              rows={2}
              value={card.allergies}
              onChange={(e) => setCard((prev) => ({ ...prev, allergies: e.target.value }))}
              placeholder="es. Penicillina, arachidi"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="conditions" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Condizioni rilevanti
            </label>
            <textarea
              id="conditions"
              rows={2}
              value={card.conditions}
              onChange={(e) => setCard((prev) => ({ ...prev, conditions: e.target.value }))}
              placeholder="es. Asma lieve, diabete di tipo 1"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="medications" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Farmaci abituali
            </label>
            <textarea
              id="medications"
              rows={2}
              value={card.medications}
              onChange={(e) => setCard((prev) => ({ ...prev, medications: e.target.value }))}
              placeholder="Facoltativo"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>

          <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">🩺 Medico di riferimento</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              A parte dai contatti qui sotto --- chi presta soccorso vuole sapere subito chi
              avvisare, e separatamente chi conosce la tua storia clinica.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={card.doctorName}
                onChange={(e) => setCard((prev) => ({ ...prev, doctorName: e.target.value }))}
                placeholder="Nome del medico"
                aria-label="Nome del medico di riferimento"
                className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
              <input
                type="text"
                value={card.doctorPhone}
                onChange={(e) => setCard((prev) => ({ ...prev, doctorPhone: e.target.value }))}
                placeholder="Telefono"
                aria-label="Telefono del medico di riferimento"
                className="w-36 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Contatti di emergenza</h3>
            {/*
              Due righe per contatto, non quattro campi in fila: con
              solo due elementi flessibili a riga il layout resta solido
              anche in una colonna stretta (v. segnalazione utente sul
              layout a due colonne qui sopra) o su schermi di telefono,
              invece di dover spartire lo spazio tra quattro elementi
              alla volta.
            */}
            {card.contacts.map((contact, index) => (
              <div
                key={index}
                className="flex flex-col gap-1.5 rounded-md border border-zinc-200 p-2.5 dark:border-zinc-800"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={contact.name}
                    onChange={(e) => updateContact(index, { name: e.target.value })}
                    placeholder="Nome"
                    aria-label={`Nome del contatto ${index + 1}`}
                    className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  />
                  <button
                    type="button"
                    onClick={() => removeContact(index)}
                    aria-label={`Rimuovi il contatto ${index + 1}`}
                    className="rounded-md px-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                  >
                    ×
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={contact.relation}
                    onChange={(e) => updateContact(index, { relation: e.target.value })}
                    placeholder="Relazione"
                    aria-label={`Relazione del contatto ${index + 1}`}
                    className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  />
                  <input
                    type="text"
                    value={contact.phone}
                    onChange={(e) => updateContact(index, { phone: e.target.value })}
                    placeholder="Telefono"
                    aria-label={`Telefono del contatto ${index + 1}`}
                    className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addContact}
              className="w-fit text-sm font-medium text-brand hover:underline"
            >
              + Aggiungi un contatto
            </button>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-fit rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {saving ? "Salvataggio…" : "Salva e aggiorna la scheda"}
          </button>
        </div>

        <div className="flex flex-col items-start gap-3">
          <EmergencyCardPreview
            fullName={fullName}
            birthDate={birthDate}
            card={card}
            contacts={visibleContacts}
          />
          <button
            type="button"
            onClick={printOnlyMarkedContent}
            disabled={empty}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            🖨️ Stampa scheda (formato tessera)
          </button>
          {empty ? (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Compila almeno un campo per poter stampare la scheda.
            </p>
          ) : null}
        </div>
      </div>

      {/*
        Fuori vista sullo schermo, mostrato solo nella finestra di
        stampa (v. lib/print.ts + la regola @media print in
        globals.css) --- stesso schema del kit di recovery in
        SetupMasterKeyForm. Stesso contenuto dell'anteprima qui sopra,
        solo il layout adattato al foglio.
      */}
      <div className="print-only hidden flex-col items-center gap-6 p-12 print:flex">
        <EmergencyCardPreview fullName={fullName} birthDate={birthDate} card={card} contacts={visibleContacts} />
      </div>
    </div>
  );
}

function formatBirthDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** La tessera stessa --- identica a schermo e in stampa, non due versioni che possono disallinearsi. */
function EmergencyCardPreview({
  fullName,
  birthDate,
  card,
  contacts,
}: {
  fullName: string;
  birthDate: string | null;
  card: EmergencyCard;
  contacts: EmergencyContact[];
}) {
  const hasDoctor = Boolean(card.doctorName.trim());

  return (
    <div className="flex w-[340px] flex-col gap-2.5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_8px_20px_rgba(16,24,40,0.06)] dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-brand">🌿 Hinthial</span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          Scheda d&apos;emergenza
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
          {fullName || "—"}
        </span>
        {birthDate ? (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Nato/a il {formatBirthDate(birthDate)}</span>
        ) : null}
      </div>

      {card.bloodType ? (
        <span className="w-fit rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-bold text-brand">
          🩸 Gruppo {card.bloodType}
        </span>
      ) : null}

      {card.allergies.trim() || card.conditions.trim() ? (
        <div className="grid grid-cols-2 gap-2 text-xs">
          {card.allergies.trim() ? (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Allergie
              </span>
              <p className="text-zinc-800 dark:text-zinc-200">{card.allergies}</p>
            </div>
          ) : null}
          {card.conditions.trim() ? (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Condizioni
              </span>
              <p className="text-zinc-800 dark:text-zinc-200">{card.conditions}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {card.medications.trim() ? (
        <div className="text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Farmaci
          </span>
          <p className="text-zinc-800 dark:text-zinc-200">{card.medications}</p>
        </div>
      ) : null}

      {hasDoctor ? (
        <div className="flex justify-between border-t border-zinc-200 pt-2 text-xs dark:border-zinc-800">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">🩺 {card.doctorName} (medico di base)</span>
          <span className="font-mono text-zinc-500 dark:text-zinc-400">{card.doctorPhone}</span>
        </div>
      ) : null}

      {contacts.length > 0 ? (
        <div className="flex flex-col gap-1 border-t border-zinc-200 pt-2 text-xs dark:border-zinc-800">
          {contacts.map((contact, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span className="text-zinc-800 dark:text-zinc-200">
                {contact.name}
                {contact.relation ? ` (${contact.relation})` : ""}
              </span>
              <span className="font-mono text-zinc-500 dark:text-zinc-400">{contact.phone}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
