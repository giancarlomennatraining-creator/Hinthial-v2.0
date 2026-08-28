/**
 * Hand-written mirror of the live Postgres schema (see
 * supabase/migrations/). Normally generated via
 * `supabase gen types typescript`, but that command needs a local Docker
 * (or Podman) runtime, which isn't available in this environment ---
 * `supabase db push` (used to apply migrations) doesn't need it, so the
 * schema itself is still authoritative on the server; this file just
 * mirrors it for editor/type-checking support.
 *
 * Regenerate with the CLI when Docker/Podman is available:
 *   npx supabase gen types typescript --db-url "<connection string>" --schema public
 * or update by hand alongside any new migration in the meantime.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_events: {
        Row: {
          id: string;
          owner_id: string;
          event_type: "login" | "logout";
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          event_type: "login" | "logout";
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          event_type?: "login" | "logout";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
