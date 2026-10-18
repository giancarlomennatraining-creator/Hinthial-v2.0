import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { setupKeyPair } from "@/lib/crypto/keypair";
import { setupMasterKey, unlockMasterKeyWithPassword } from "@/lib/crypto/master-key";
import { serializeEnvelope } from "@/lib/crypto/envelope";
import { serializePbkdf2Params } from "@/lib/crypto/pbkdf2";
import { wipeOwnerStorage } from "@/lib/storage/wipe-owner-storage";
import type { Database } from "@/types/supabase";

/**
 * Gli account demo: dati di prova nel progetto di sviluppo, MAI in produzione. Le email NON iniziano con
 * "hinthial-e2e-", così la pulizia dei test e2e (v. tests/e2e/global-teardown.ts) non li cancella.
 */
export const DEMO_PASSWORD = "Demo-Hinthial-2026";
export const DEMO_MASTER_PASSWORD = "master-demo-hinthial-2026";

export interface DemoAccount {
  email: string;
  firstName: string;
  lastName: string;
}

export const DEMO_A: DemoAccount = { email: "marta.conti.demo@mailinator.com", firstName: "Marta", lastName: "Conti" };
export const DEMO_B: DemoAccount = { email: "paolo.conti.demo@mailinator.com", firstName: "Paolo", lastName: "Conti" };

export interface Session {
  supabase: SupabaseClient<Database>;
  masterKey: CryptoKey;
  userId: string;
  account: DemoAccount;
  recoveryKey: string;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string);
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export function adminClient(): SupabaseClient<Database> {
  if (!url || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY servono in .env.local.");
  return createClient<Database>(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function findUserId(admin: SupabaseClient<Database>, email: string): Promise<string | null> {
  const perPage = 200;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data) throw new Error(`listUsers: ${error?.message}`);
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < perPage) return null;
  }
}

/** Cancella l'account demo se c'è (con tutto ciò che ne discende) e lo ricrea pulito, con la cassaforte già configurata. */
export async function createDemoSession(account: DemoAccount): Promise<Session> {
  const admin = adminClient();
  const existing = await findUserId(admin, account.email);
  if (existing) {
    const { error } = await admin.auth.admin.deleteUser(existing);
    if (error) throw new Error(`deleteUser ${account.email}: ${error.message}`);
    // I file cifrati dell'account restano in Storage (non sono in cascata): si tolgono qui.
    await wipeOwnerStorage(admin, existing);
  }

  const created = await admin.auth.admin.createUser({
    email: account.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { first_name: account.firstName, last_name: account.lastName },
  });
  if (created.error || !created.data.user) throw new Error(`createUser ${account.email}: ${created.error?.message}`);
  const userId = created.data.user.id;

  const supabase = createClient<Database>(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const signIn = await supabase.auth.signInWithPassword({ email: account.email, password: DEMO_PASSWORD });
  if (signIn.error) throw new Error(`signIn ${account.email}: ${signIn.error.message}`);

  // La stessa configurazione che fa l'app (v. MasterKeyProvider: setup + confirmSetup), con parametri di produzione.
  const setup = await setupMasterKey(DEMO_MASTER_PASSWORD);
  const masterKey = await unlockMasterKeyWithPassword(DEMO_MASTER_PASSWORD, setup.pbkdf2Params, setup.masterKeyWrappedByPassword);
  const keyPair = await setupKeyPair(masterKey);
  const { error } = await supabase.from("encryption_setup").insert({
    owner_id: userId,
    master_key_wrapped_by_password: serializeEnvelope(setup.masterKeyWrappedByPassword),
    master_key_wrapped_by_recovery_key: serializeEnvelope(setup.masterKeyWrappedByRecoveryKey),
    pbkdf2_params: serializePbkdf2Params(setup.pbkdf2Params),
    public_key: keyPair.publicKeyJwk,
    wrapped_private_key: serializeEnvelope(keyPair.wrappedPrivateKey),
  });
  if (error) throw new Error(`encryption_setup ${account.email}: ${error.message}`);

  return { supabase, masterKey, userId, account, recoveryKey: setup.recoveryKey.formatted };
}
