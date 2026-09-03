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

type AuditEventTypeColumn =
  | "login"
  | "logout"
  | "document_created"
  | "document_deleted"
  | "trusted_contact_added"
  | "vault_wiped";

type TrustedContactStatusColumn = "pending" | "active" | "revoked";

type CapsuleStatusColumn = "draft" | "ready" | "shared";
type CapsuleAccessConditionColumn = "manual";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          avatar_path: string | null;
          list_view_preferences: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          first_name: string;
          last_name: string;
          avatar_path?: string | null;
          list_view_preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string;
          last_name?: string;
          avatar_path?: string | null;
          list_view_preferences?: Json;
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
          event_type: AuditEventTypeColumn;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          event_type: AuditEventTypeColumn;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          event_type?: AuditEventTypeColumn;
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
      encryption_setup: {
        Row: {
          owner_id: string;
          master_key_wrapped_by_password: string;
          master_key_wrapped_by_recovery_key: string;
          pbkdf2_params: string;
          created_at: string;
        };
        Insert: {
          owner_id: string;
          master_key_wrapped_by_password: string;
          master_key_wrapped_by_recovery_key: string;
          pbkdf2_params: string;
          created_at?: string;
        };
        Update: {
          owner_id?: string;
          master_key_wrapped_by_password?: string;
          master_key_wrapped_by_recovery_key?: string;
          pbkdf2_params?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "encryption_setup_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          icon: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          icon: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          icon?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      assets: {
        Row: {
          id: string;
          owner_id: string;
          encrypted_name: string;
          category_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          encrypted_name: string;
          category_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          encrypted_name?: string;
          category_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assets_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assets_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          id: string;
          owner_id: string;
          encrypted_filename: string;
          wrapped_document_key: string;
          storage_path: string;
          mime_type: string;
          size: number;
          category_id: string | null;
          related_asset_id: string | null;
          version: number;
          expires_at: string | null;
          encrypted_notes: string | null;
          encrypted_tags: string | null;
          encrypted_transcript: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          encrypted_filename: string;
          wrapped_document_key: string;
          storage_path: string;
          mime_type: string;
          size: number;
          category_id?: string | null;
          related_asset_id?: string | null;
          version?: number;
          expires_at?: string | null;
          encrypted_notes?: string | null;
          encrypted_tags?: string | null;
          encrypted_transcript?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          encrypted_filename?: string;
          wrapped_document_key?: string;
          storage_path?: string;
          mime_type?: string;
          size?: number;
          category_id?: string | null;
          related_asset_id?: string | null;
          version?: number;
          expires_at?: string | null;
          encrypted_notes?: string | null;
          encrypted_tags?: string | null;
          encrypted_transcript?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_related_asset_id_fkey";
            columns: ["related_asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
      reminders: {
        Row: {
          id: string;
          owner_id: string;
          encrypted_title: string;
          due_at: string;
          related_document_id: string | null;
          related_asset_id: string | null;
          completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          encrypted_title: string;
          due_at: string;
          related_document_id?: string | null;
          related_asset_id?: string | null;
          completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          encrypted_title?: string;
          due_at?: string;
          related_document_id?: string | null;
          related_asset_id?: string | null;
          completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminders_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reminders_related_document_id_fkey";
            columns: ["related_document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reminders_related_asset_id_fkey";
            columns: ["related_asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
      trusted_contacts: {
        Row: {
          id: string;
          owner_id: string;
          encrypted_name: string;
          encrypted_email: string;
          role: string;
          status: TrustedContactStatusColumn;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          encrypted_name: string;
          encrypted_email: string;
          role: string;
          status?: TrustedContactStatusColumn;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          encrypted_name?: string;
          encrypted_email?: string;
          role?: string;
          status?: TrustedContactStatusColumn;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trusted_contacts_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      capsules: {
        Row: {
          id: string;
          owner_id: string;
          encrypted_payload: string;
          status: CapsuleStatusColumn;
          access_condition: CapsuleAccessConditionColumn;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          encrypted_payload: string;
          status?: CapsuleStatusColumn;
          access_condition?: CapsuleAccessConditionColumn;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          encrypted_payload?: string;
          status?: CapsuleStatusColumn;
          access_condition?: CapsuleAccessConditionColumn;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "capsules_owner_id_fkey";
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
