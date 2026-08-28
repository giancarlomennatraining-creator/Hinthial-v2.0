#!/usr/bin/env node
/**
 * DEV-ONLY: wipes every user (and everything that cascades from them ---
 * profiles, categories, documents, encryption_setup, audit_events) plus
 * every object in the "encrypted-documents" Storage bucket, using the
 * service role key. Schema and migrations are left untouched.
 *
 * NEVER run this against a project holding real user data.
 *
 * Usage: npm run reset-dev-data
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
 * .env.local.
 */

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // No .env.local --- the checks below will report exactly what's missing.
  }
}

const { createClient } = await import("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (.env.local).",
  );
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = "encrypted-documents";

async function deleteAllUsers() {
  let deleted = 0;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    if (data.users.length === 0) break;

    for (const user of data.users) {
      const { error: delError } = await admin.auth.admin.deleteUser(user.id);
      if (delError) throw new Error(`deleteUser(${user.id}): ${delError.message}`);
      deleted++;
    }
  }
  return deleted;
}

async function emptyBucket() {
  const { data: topLevel, error: listError } = await admin.storage
    .from(BUCKET)
    .list("", { limit: 1000 });
  if (listError) throw new Error(`storage.list: ${listError.message}`);

  let deleted = 0;
  for (const entry of topLevel ?? []) {
    // Each top-level entry is a user-id "folder" (see documentStoragePath).
    const { data: files, error: subListError } = await admin.storage
      .from(BUCKET)
      .list(entry.name, { limit: 1000 });
    if (subListError) throw new Error(`storage.list(${entry.name}): ${subListError.message}`);

    const paths = (files ?? []).map((f) => `${entry.name}/${f.name}`);
    if (paths.length > 0) {
      const { error: removeError } = await admin.storage.from(BUCKET).remove(paths);
      if (removeError) throw new Error(`storage.remove: ${removeError.message}`);
      deleted += paths.length;
    }
  }
  return deleted;
}

const deletedUsers = await deleteAllUsers();
const deletedObjects = await emptyBucket();

console.log(`Eliminati ${deletedUsers} utenti e ${deletedObjects} file da Storage.`);
console.log("Schema e migration non sono stati toccati.");
