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
  | "login_failed"
  | "mfa_challenge_failed"
  | "mfa_enrolled"
  | "mfa_removed"
  | "backup_codes_generated"
  | "document_created"
  | "document_deleted"
  | "asset_created"
  | "asset_deleted"
  | "capsule_created"
  | "capsule_deleted"
  | "category_created"
  | "category_deleted"
  | "friend_added"
  | "vault_wiped"
  | "ai_chat_used"
  | "trusted_device_registered"
  | "trusted_device_revoked"
  | "digital_legacy_reminder_sent"
  | "digital_legacy_grace_period_started"
  | "digital_legacy_awaiting_guardians"
  | "digital_legacy_reset"
  | "digital_legacy_guardian_requested"
  | "digital_legacy_guardian_responded"
  | "digital_legacy_guardians_confirmed"
  | "digital_legacy_reset_by_guardian";

type FriendStatusColumn = "pending" | "active" | "revoked";

type NavOrientationColumn = "sidebar-left" | "sidebar-right" | "topbar";

type CapsuleStatusColumn = "draft" | "ready" | "shared";
type CapsuleAccessConditionColumn = "manual";

type DigitalLegacyPresetColumn = "cautious" | "balanced" | "relaxed" | "custom";
type GuardianQuorumColumn = "unanimous" | "majority" | "single";
type DigitalLegacyStateColumn =
  | "normal"
  | "reminding"
  | "grace_period"
  | "awaiting_guardians"
  | "guardians_confirmed";
type GuardianVerificationResponseColumn = "ok" | "unknown" | "unreachable";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          avatar_path: string | null;
          birth_date: string | null;
          list_view_preferences: Json;
          nav_orientation: NavOrientationColumn;
          bottom_nav_items: Json;
          main_nav_items: Json | null;
          onboarding_widget_hidden: boolean;
          master_key_intro_seen: boolean;
          ai_master_enabled: boolean;
          ai_chat_consent: boolean;
          capsule_countdown_visible: boolean;
          digital_legacy_enabled: boolean;
          digital_legacy_preset: DigitalLegacyPresetColumn;
          digital_legacy_inactivity_days: number;
          digital_legacy_reminder_interval_days: number;
          digital_legacy_reminder_count: number;
          digital_legacy_grace_period_days: number;
          digital_legacy_guardian_quorum: GuardianQuorumColumn;
          digital_legacy_formal_verification_days: number;
          digital_legacy_final_wait_days: number;
          digital_legacy_state: DigitalLegacyStateColumn;
          digital_legacy_state_entered_at: string;
          digital_legacy_reminders_sent: number;
          digital_legacy_last_reminder_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          first_name: string;
          last_name: string;
          avatar_path?: string | null;
          birth_date?: string | null;
          list_view_preferences?: Json;
          nav_orientation?: NavOrientationColumn;
          bottom_nav_items?: Json;
          main_nav_items?: Json | null;
          onboarding_widget_hidden?: boolean;
          master_key_intro_seen?: boolean;
          ai_master_enabled?: boolean;
          ai_chat_consent?: boolean;
          capsule_countdown_visible?: boolean;
          digital_legacy_enabled?: boolean;
          digital_legacy_preset?: DigitalLegacyPresetColumn;
          digital_legacy_inactivity_days?: number;
          digital_legacy_reminder_interval_days?: number;
          digital_legacy_reminder_count?: number;
          digital_legacy_grace_period_days?: number;
          digital_legacy_guardian_quorum?: GuardianQuorumColumn;
          digital_legacy_formal_verification_days?: number;
          digital_legacy_final_wait_days?: number;
          digital_legacy_state?: DigitalLegacyStateColumn;
          digital_legacy_state_entered_at?: string;
          digital_legacy_reminders_sent?: number;
          digital_legacy_last_reminder_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string;
          last_name?: string;
          avatar_path?: string | null;
          birth_date?: string | null;
          list_view_preferences?: Json;
          nav_orientation?: NavOrientationColumn;
          bottom_nav_items?: Json;
          main_nav_items?: Json | null;
          onboarding_widget_hidden?: boolean;
          master_key_intro_seen?: boolean;
          ai_master_enabled?: boolean;
          ai_chat_consent?: boolean;
          capsule_countdown_visible?: boolean;
          digital_legacy_enabled?: boolean;
          digital_legacy_preset?: DigitalLegacyPresetColumn;
          digital_legacy_inactivity_days?: number;
          digital_legacy_reminder_interval_days?: number;
          digital_legacy_reminder_count?: number;
          digital_legacy_grace_period_days?: number;
          digital_legacy_guardian_quorum?: GuardianQuorumColumn;
          digital_legacy_formal_verification_days?: number;
          digital_legacy_final_wait_days?: number;
          digital_legacy_state?: DigitalLegacyStateColumn;
          digital_legacy_state_entered_at?: string;
          digital_legacy_reminders_sent?: number;
          digital_legacy_last_reminder_at?: string | null;
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
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          event_type: AuditEventTypeColumn;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          event_type?: AuditEventTypeColumn;
          metadata?: Json | null;
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
          public_key: string | null;
          wrapped_private_key: string | null;
          created_at: string;
        };
        Insert: {
          owner_id: string;
          master_key_wrapped_by_password: string;
          master_key_wrapped_by_recovery_key: string;
          pbkdf2_params: string;
          public_key?: string | null;
          wrapped_private_key?: string | null;
          created_at?: string;
        };
        Update: {
          owner_id?: string;
          master_key_wrapped_by_password?: string;
          master_key_wrapped_by_recovery_key?: string;
          pbkdf2_params?: string;
          public_key?: string | null;
          wrapped_private_key?: string | null;
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
      mfa_backup_codes: {
        Row: {
          id: string;
          owner_id: string;
          code_hash: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          code_hash: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          code_hash?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mfa_backup_codes_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      friends: {
        Row: {
          id: string;
          owner_id: string;
          encrypted_name: string;
          encrypted_email: string;
          encrypted_first_name: string | null;
          encrypted_last_name: string | null;
          avatar_path: string | null;
          role: string;
          status: FriendStatusColumn;
          is_guardian: boolean;
          linked_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          encrypted_name: string;
          encrypted_email: string;
          encrypted_first_name?: string | null;
          encrypted_last_name?: string | null;
          avatar_path?: string | null;
          role: string;
          status?: FriendStatusColumn;
          is_guardian?: boolean;
          linked_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          encrypted_name?: string;
          encrypted_email?: string;
          encrypted_first_name?: string | null;
          encrypted_last_name?: string | null;
          avatar_path?: string | null;
          role?: string;
          status?: FriendStatusColumn;
          is_guardian?: boolean;
          linked_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "friends_owner_id_fkey";
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
          /** Data E ora, in chiaro apposta --- v. migrazioni 20260905000000 e 20260913010000. Null per le capsule create prima di questa colonna, finché non vengono riviste (v. domain/capsules/repository.ts, listCapsules). */
          open_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          encrypted_payload: string;
          status?: CapsuleStatusColumn;
          access_condition?: CapsuleAccessConditionColumn;
          open_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          encrypted_payload?: string;
          status?: CapsuleStatusColumn;
          access_condition?: CapsuleAccessConditionColumn;
          open_at?: string | null;
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
      capsule_shares: {
        Row: {
          id: string;
          capsule_id: string;
          owner_id: string;
          recipient_user_id: string;
          shared_at: string;
          dismissed_at: string | null;
        };
        Insert: {
          id?: string;
          capsule_id: string;
          owner_id: string;
          recipient_user_id: string;
          shared_at?: string;
          dismissed_at?: string | null;
        };
        Update: {
          id?: string;
          capsule_id?: string;
          owner_id?: string;
          recipient_user_id?: string;
          shared_at?: string;
          dismissed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "capsule_shares_capsule_id_fkey";
            columns: ["capsule_id"];
            isOneToOne: false;
            referencedRelation: "capsules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "capsule_shares_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "capsule_shares_recipient_user_id_fkey";
            columns: ["recipient_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      capsule_share_keys: {
        Row: {
          id: string;
          capsule_id: string;
          owner_id: string;
          recipient_user_id: string;
          ephemeral_public_key: string;
          encrypted_payload_for_recipient: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          capsule_id: string;
          owner_id: string;
          recipient_user_id: string;
          ephemeral_public_key: string;
          encrypted_payload_for_recipient: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          capsule_id?: string;
          owner_id?: string;
          recipient_user_id?: string;
          ephemeral_public_key?: string;
          encrypted_payload_for_recipient?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "capsule_share_keys_capsule_id_fkey";
            columns: ["capsule_id"];
            isOneToOne: false;
            referencedRelation: "capsules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "capsule_share_keys_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "capsule_share_keys_recipient_user_id_fkey";
            columns: ["recipient_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      product_updates: {
        Row: {
          id: string;
          title: string;
          description: string;
          published_on: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          published_on: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          published_on?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      trusted_devices: {
        Row: {
          id: string;
          owner_id: string;
          credential_id: string;
          label: string;
          created_at: string;
          last_active_at: string;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          credential_id: string;
          label: string;
          created_at?: string;
          last_active_at?: string;
          revoked_at?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          credential_id?: string;
          label?: string;
          created_at?: string;
          last_active_at?: string;
          revoked_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "trusted_devices_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      device_pairing_requests: {
        Row: {
          id: string;
          owner_id: string;
          new_device_public_key: string;
          approver_public_key: string | null;
          encrypted_master_key: string | null;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          new_device_public_key: string;
          approver_public_key?: string | null;
          encrypted_master_key?: string | null;
          created_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          new_device_public_key?: string;
          approver_public_key?: string | null;
          encrypted_master_key?: string | null;
          created_at?: string;
          expires_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "device_pairing_requests_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      guardian_verification_requests: {
        Row: {
          id: string;
          owner_id: string;
          guardian_user_id: string;
          friend_id: string | null;
          response: GuardianVerificationResponseColumn | null;
          responded_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          guardian_user_id: string;
          friend_id?: string | null;
          response?: GuardianVerificationResponseColumn | null;
          responded_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          guardian_user_id?: string;
          friend_id?: string | null;
          response?: GuardianVerificationResponseColumn | null;
          responded_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guardian_verification_requests_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guardian_verification_requests_guardian_user_id_fkey";
            columns: ["guardian_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guardian_verification_requests_friend_id_fkey";
            columns: ["friend_id"];
            isOneToOne: false;
            referencedRelation: "friends";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      log_failed_login_attempt: {
        Args: { target_email: string };
        Returns: undefined;
      };
      respond_to_guardian_verification_request: {
        Args: { request_id: string; response_value: GuardianVerificationResponseColumn };
        Returns: undefined;
      };
      lookup_friend_account: {
        Args: { target_email: string };
        Returns: { matched_user_id: string; matched_display_name: string }[];
      };
      get_linked_friend_avatar_path: {
        Args: { p_friend_id: string };
        Returns: string | null;
      };
      get_linked_friend_public_key: {
        Args: { p_friend_id: string };
        Returns: string | null;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
