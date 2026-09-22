import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  encryptBytes,
  decryptBytes,
  parseEnvelope,
  serializeEnvelope,
  utf8ToBytes,
  bytesToUtf8,
} from "@/lib/crypto";
import { EMPTY_EMERGENCY_CARD, type EmergencyCard, type EmergencyContact } from "@/domain/emergency-card/types";

const COLUMNS =
  "encrypted_blood_type, encrypted_allergies, encrypted_conditions, encrypted_medications, encrypted_doctor_name, encrypted_doctor_phone, encrypted_contacts, updated_at";

/** null/vuoto in -> null fuori: niente da cifrare, niente da salvare --- v. domain/documents/repository.ts, encryptOptionalText. */
async function encryptOptionalText(masterKey: CryptoKey, text: string): Promise<string | null> {
  if (!text.trim()) return null;
  return serializeEnvelope(await encryptBytes(masterKey, utf8ToBytes(text)));
}

async function decryptOptionalText(masterKey: CryptoKey, serialized: string | null): Promise<string> {
  if (!serialized) return "";
  const bytes = await decryptBytes(masterKey, parseEnvelope(serialized));
  return bytesToUtf8(bytes);
}

/** Un contatto malformato (o l'intero campo corrotto) viene scartato in silenzio --- una scheda d'emergenza illeggibile non deve mai bloccare le impostazioni. */
function parseContacts(json: string): EmergencyContact[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is EmergencyContact =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as EmergencyContact).name === "string" &&
        typeof (c as EmergencyContact).relation === "string" &&
        typeof (c as EmergencyContact).phone === "string",
    );
  } catch {
    return [];
  }
}

/** EMPTY_EMERGENCY_CARD --- nessuna scheda mai salvata è lo stato di partenza, non un errore. */
export async function getEmergencyCard(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
): Promise<EmergencyCard> {
  const { data, error } = await supabase
    .from("emergency_cards")
    .select(COLUMNS)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Impossibile caricare la scheda d'emergenza: ${error.message}`);
  }
  if (!data) return EMPTY_EMERGENCY_CARD;

  const [bloodType, allergies, conditions, medications, doctorName, doctorPhone, contactsJson] =
    await Promise.all([
      decryptOptionalText(masterKey, data.encrypted_blood_type),
      decryptOptionalText(masterKey, data.encrypted_allergies),
      decryptOptionalText(masterKey, data.encrypted_conditions),
      decryptOptionalText(masterKey, data.encrypted_medications),
      decryptOptionalText(masterKey, data.encrypted_doctor_name),
      decryptOptionalText(masterKey, data.encrypted_doctor_phone),
      decryptOptionalText(masterKey, data.encrypted_contacts),
    ]);

  return {
    bloodType,
    allergies,
    conditions,
    medications,
    doctorName,
    doctorPhone,
    contacts: parseContacts(contactsJson),
    updatedAt: data.updated_at,
  };
}

/** Sostituisce l'intera scheda --- una riga per account (upsert su owner_id), mai una cronologia di versioni. */
export async function saveEmergencyCard(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  card: Omit<EmergencyCard, "updatedAt">,
): Promise<void> {
  const [
    encryptedBloodType,
    encryptedAllergies,
    encryptedConditions,
    encryptedMedications,
    encryptedDoctorName,
    encryptedDoctorPhone,
    encryptedContacts,
  ] = await Promise.all([
    encryptOptionalText(masterKey, card.bloodType),
    encryptOptionalText(masterKey, card.allergies),
    encryptOptionalText(masterKey, card.conditions),
    encryptOptionalText(masterKey, card.medications),
    encryptOptionalText(masterKey, card.doctorName),
    encryptOptionalText(masterKey, card.doctorPhone),
    card.contacts.length > 0 ? encryptOptionalText(masterKey, JSON.stringify(card.contacts)) : Promise.resolve(null),
  ]);

  const { error } = await supabase.from("emergency_cards").upsert({
    owner_id: ownerId,
    encrypted_blood_type: encryptedBloodType,
    encrypted_allergies: encryptedAllergies,
    encrypted_conditions: encryptedConditions,
    encrypted_medications: encryptedMedications,
    encrypted_doctor_name: encryptedDoctorName,
    encrypted_doctor_phone: encryptedDoctorPhone,
    encrypted_contacts: encryptedContacts,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Impossibile salvare la scheda d'emergenza: ${error.message}`);
  }
}
