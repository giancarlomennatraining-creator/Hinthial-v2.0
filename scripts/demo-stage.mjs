#!/usr/bin/env node
/**
 * DEV-ONLY: porta il profilo demo di Marta (v. tests/seed/demo.seed.ts) in una fase di "Eredità digitale", per vedere cosa
 * succede a Paolo, il suo guardiano, quando lei non accede più. Scrive solo nel database (stato di Marta e richiesta a
 * Paolo): non spedisce email e non tocca nulla di cifrato.
 *
 * Uso:  npm run demo-stage -- <fase>
 *   normale    Marta ha accesso da poco: nessuna richiesta, tutto fermo.
 *   promemoria Marta non accede da mesi: Hinthial le ha scritto due volte. Paolo non vede ancora nulla.
 *   grazia     Ultimo mese di grazia prima di coinvolgere i guardiani. Paolo non vede ancora nulla.
 *   attesa     Hinthial chiede a Paolo "hai notizie di Marta?": compare in Oggi e in Protetti, e si apre la pagina di risposta.
 *   confermata Paolo ha risposto "non riesco a raggiungerla": l'ultimo avviso a Marta, poi la verifica.
 *   verifica   Verifica formale in corso.
 *   attesafinale  Ultima attesa prima della consegna.
 *   consegna   Le capsule "anche se non ci sono più" sono aperte per chi le riceve: Paolo le vede in "Condivise con me".
 * Richiede NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY in .env.local. Mai su un progetto con dati reali.
 */

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Senza .env.local i controlli qui sotto dicono cosa manca.
  }
}

const { createClient } = await import("@supabase/supabase-js");

const MARTA = "marta.conti.demo@mailinator.com";
const PAOLO = "paolo.conti.demo@mailinator.com";

const STAGES = {
  normale: { state: "normal", requests: null },
  promemoria: { state: "reminding", requests: null, reminders: 2 },
  grazia: { state: "grace_period", requests: null, reminders: 4 },
  attesa: { state: "awaiting_guardians", requests: "pending", reminders: 4 },
  confermata: { state: "guardians_confirmed", requests: "unreachable", reminders: 4 },
  verifica: { state: "formal_verification", requests: "unreachable", reminders: 4 },
  attesafinale: { state: "final_wait", requests: "unreachable", reminders: 4 },
  consegna: { state: "triggered", requests: "unreachable", reminders: 4, triggered: true },
};

const stageName = process.argv[2];
const stage = STAGES[stageName];
if (!stage) {
  console.error(`Uso: npm run demo-stage -- <${Object.keys(STAGES).join(" | ")}>`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY servono in .env.local.");
  process.exit(1);
}
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function userId(email) {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < 200) return null;
  }
}

const [marta, paolo] = await Promise.all([userId(MARTA), userId(PAOLO)]);
if (!marta || !paolo) {
  console.error("Gli account demo non ci sono: lancia prima  npm run seed-demo");
  process.exit(1);
}

const now = new Date().toISOString();
const daysAgo = (d) => new Date(Date.now() - d * 86_400_000).toISOString();

const { error: profileError } = await admin
  .from("profiles")
  .update({
    digital_legacy_enabled: true,
    digital_legacy_state: stage.state,
    digital_legacy_state_entered_at: now,
    digital_legacy_reminders_sent: stage.reminders ?? 0,
    digital_legacy_last_reminder_at: stage.reminders ? daysAgo(8) : null,
    digital_legacy_triggered_at: stage.triggered ? now : null,
  })
  .eq("id", marta);
if (profileError) throw new Error(`profilo di Marta: ${profileError.message}`);

// Le richieste ai guardiani partono da zero a ogni cambio di fase, come in un episodio nuovo.
await admin.from("guardian_verification_requests").delete().eq("owner_id", marta);

if (stage.requests) {
  const { data: friend, error: friendError } = await admin
    .from("friends")
    .select("id")
    .eq("owner_id", marta)
    .eq("linked_user_id", paolo)
    .single();
  if (friendError || !friend) throw new Error(`Paolo non è nella rubrica di Marta: ${friendError?.message}`);

  const answered = stage.requests !== "pending";
  const { error } = await admin.from("guardian_verification_requests").insert({
    owner_id: marta,
    guardian_user_id: paolo,
    friend_id: friend.id,
    response: answered ? stage.requests : null,
    responded_at: answered ? daysAgo(2) : null,
    created_at: daysAgo(answered ? 3 : 1),
  });
  if (error) throw new Error(`richiesta a Paolo: ${error.message}`);
}

const { data: request } = await admin.from("guardian_verification_requests").select("id").eq("owner_id", marta).maybeSingle();
console.log(`Marta è in fase "${stageName}" (${stage.state}).`);
if (request) console.log(`Pagina di risposta di Paolo: /guardian-check/${request.id}`);
console.log("Accedi come Paolo (paolo.conti.demo@mailinator.com) e guarda Oggi, Amici → Protetti, Capsule → Condivise con me.");
