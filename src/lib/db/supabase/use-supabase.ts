"use client";

import { useState } from "react";
import { createClient } from "@/lib/db/supabase/client";

/** Il client Supabase del browser, creato una volta sola per componente (v. createClient: nel browser è comunque un'unica istanza condivisa). */
export function useSupabase() {
  const [supabase] = useState(() => createClient());
  return supabase;
}
