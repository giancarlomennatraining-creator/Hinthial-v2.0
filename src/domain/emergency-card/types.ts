/**
 * La scheda d'emergenza --- pochi campi scritti una volta (gruppo
 * sanguigno, allergie, condizioni rilevanti, farmaci abituali), un
 * medico di riferimento a sé, e contatti di emergenza --- pensata per
 * essere stampata in formato tessera e portata nel portafoglio, non
 * letta a schermo.
 *
 * Il medico è staccato dai contatti generici di proposito: chi presta
 * soccorso ha due domande diverse --- chi avvisare (la famiglia) e chi
 * conosce la storia clinica di questa persona (il medico) --- non la
 * stessa lista più lunga.
 */
export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

export interface EmergencyCard {
  /** "" --- non specificato. Uno degli otto valori reali, mai testo libero (v. BLOOD_TYPES). */
  bloodType: string;
  allergies: string;
  conditions: string;
  medications: string;
  doctorName: string;
  doctorPhone: string;
  contacts: EmergencyContact[];
  /** ISO, null se non è mai stata salvata. */
  updatedAt: string | null;
}

export const EMPTY_EMERGENCY_CARD: EmergencyCard = {
  bloodType: "",
  allergies: "",
  conditions: "",
  medications: "",
  doctorName: "",
  doctorPhone: "",
  contacts: [],
  updatedAt: null,
};

export const BLOOD_TYPES = ["0+", "0-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

/** Se non c'è ancora niente da mostrare su una scheda --- v. EmergencyCardPanel, per non stampare una tessera vuota. */
export function isEmergencyCardEmpty(card: EmergencyCard): boolean {
  return (
    !card.bloodType &&
    !card.allergies.trim() &&
    !card.conditions.trim() &&
    !card.medications.trim() &&
    !card.doctorName.trim() &&
    !card.doctorPhone.trim() &&
    card.contacts.length === 0
  );
}
