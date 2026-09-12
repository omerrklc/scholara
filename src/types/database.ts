export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      blocked_users: {
        Row: {
          blocked_user_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_user_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_user_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_users_blocked_user_id_fkey"
            columns: ["blocked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_helpful: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_helpful_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_post_helpful_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_id: string
          body: string
          category: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          category: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          category?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_requests: {
        Row: {
          created_at: string
          recipient_id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          recipient_id: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          recipient_id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_requests_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_export_requests: {
        Row: {
          completed_at: string | null
          expires_at: string | null
          id: string
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          expires_at?: string | null
          id?: string
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          expires_at?: string | null
          id?: string
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          document_key: string
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          document_key: string
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          document_key?: string
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_acceptances_document_key_version_fkey"
            columns: ["document_key", "version"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["document_key", "version"]
          },
        ]
      }
      legal_documents: {
        Row: {
          document_key: string
          published_at: string
          required: boolean
          version: string
        }
        Insert: {
          document_key: string
          published_at: string
          required?: boolean
          version: string
        }
        Update: {
          document_key?: string
          published_at?: string
          required?: boolean
          version?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          academic_stage: string
          avatar_path: string
          created_at: string
          current_city: string
          current_country: string
          department: string
          destination_city: string
          destination_country: string
          full_name: string
          id: string
          intents: string[]
          is_relocating: boolean
          languages: Json
          onboarding_completed: boolean
          program: string
          relocation_date: string
          research_description: string
          research_interests: string[]
          show_current_location: boolean
          show_relocation_date: boolean
          show_relocation_destination: boolean
          university: string
          updated_at: string
          username: string
        }
        Insert: {
          academic_stage?: string
          avatar_path?: string
          created_at?: string
          current_city?: string
          current_country?: string
          department?: string
          destination_city?: string
          destination_country?: string
          full_name?: string
          id: string
          intents?: string[]
          is_relocating?: boolean
          languages?: Json
          onboarding_completed?: boolean
          program?: string
          relocation_date?: string
          research_description?: string
          research_interests?: string[]
          show_current_location?: boolean
          show_relocation_date?: boolean
          show_relocation_destination?: boolean
          university?: string
          updated_at?: string
          username: string
        }
        Update: {
          academic_stage?: string
          avatar_path?: string
          created_at?: string
          current_city?: string
          current_country?: string
          department?: string
          destination_city?: string
          destination_country?: string
          full_name?: string
          id?: string
          intents?: string[]
          is_relocating?: boolean
          languages?: Json
          onboarding_completed?: boolean
          program?: string
          relocation_date?: string
          research_description?: string
          research_interests?: string[]
          show_current_location?: boolean
          show_relocation_date?: boolean
          show_relocation_destination?: boolean
          university?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      saved_profiles: {
        Row: {
          created_at: string
          saved_profile_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          saved_profile_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          saved_profile_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_profiles_saved_profile_id_fkey"
            columns: ["saved_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_preferences: {
        Row: {
          community_enabled: boolean
          matches_enabled: boolean
          messages_enabled: boolean
          product_updates_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          community_enabled?: boolean
          matches_enabled?: boolean
          messages_enabled?: boolean
          product_updates_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          community_enabled?: boolean
          matches_enabled?: boolean
          messages_enabled?: boolean
          product_updates_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          community_comment_id: string | null
          community_post_id: string | null
          created_at: string
          details: string
          id: string
          reason: string
          reasons: string[]
          reported_user_id: string | null
          reporter_id: string | null
          reviewed_at: string | null
          source: string
          status: string
        }
        Insert: {
          community_comment_id?: string | null
          community_post_id?: string | null
          created_at?: string
          details?: string
          id?: string
          reason: string
          reasons: string[]
          reported_user_id?: string | null
          reporter_id?: string | null
          reviewed_at?: string | null
          source: string
          status?: string
        }
        Update: {
          community_comment_id?: string | null
          community_post_id?: string | null
          created_at?: string
          details?: string
          id?: string
          reason?: string
          reasons?: string[]
          reported_user_id?: string | null
          reporter_id?: string | null
          reviewed_at?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_reports_community_comment_id_fkey"
            columns: ["community_comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_community_post_id_fkey"
            columns: ["community_post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_current_legal_documents: { Args: never; Returns: number }
      are_matched: {
        Args: { first_user_id: string; second_user_id: string }
        Returns: boolean
      }
      block_user: { Args: { target_user_id: string }; Returns: boolean }
      create_community_comment: {
        Args: { comment_body: string; target_post_id: string }
        Returns: string
      }
      create_community_post: {
        Args: { post_body: string; post_category: string }
        Returns: string
      }
      delete_community_comment: {
        Args: { target_comment_id: string }
        Returns: boolean
      }
      delete_community_post: {
        Args: { target_post_id: string }
        Returns: boolean
      }
      delete_my_account: { Args: { confirmation: string }; Returns: boolean }
      discover_profiles: {
        Args: never
        Returns: {
          academic_stage: string
          avatar_path: string
          current_city: string
          current_country: string
          department: string
          destination_city: string
          destination_country: string
          full_name: string
          id: string
          intents: string[]
          is_relocating: boolean
          program: string
          relocation_date: string
          research_description: string
          research_interests: string[]
          university: string
        }[]
      }
      can_view_profile_photo: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      get_account_settings: { Args: never; Returns: Json }
      get_blocked_users: {
        Args: never
        Returns: {
          academic_stage: string
          blocked_at: string
          full_name: string
          university: string
          user_id: string
        }[]
      }
      get_community_comments: {
        Args: {
          before_time?: string
          page_size?: number
          target_post_id: string
        }
        Returns: {
          author_id: string
          author_name: string
          author_stage: string
          author_university: string
          body: string
          comment_id: string
          created_at: string
          viewer_owns: boolean
        }[]
      }
      get_community_posts: {
        Args: {
          before_time?: string
          category_filter?: string
          page_size?: number
        }
        Returns: {
          author_id: string
          author_name: string
          author_stage: string
          author_university: string
          body: string
          category: string
          created_at: string
          helpful_count: number
          post_id: string
          reply_count: number
          viewer_helpful: boolean
          viewer_owns: boolean
        }[]
      }
      get_conversation_messages: {
        Args: {
          before_time?: string
          other_user_id: string
          page_size?: number
        }
        Returns: {
          body: string
          created_at: string
          id: string
          read_at: string
          recipient_id: string
          sender_id: string
        }[]
      }
      get_conversation_summaries: {
        Args: never
        Returns: {
          last_message: string
          last_message_at: string
          other_name: string
          other_stage: string
          other_university: string
          other_user_id: string
          unread_count: number
        }[]
      }
      is_blocked_with: { Args: { target_user_id: string }; Returns: boolean }
      is_discoverable_profile: {
        Args: { target_profile_id: string }
        Returns: boolean
      }
      is_valid_bounded_text_array: {
        Args: {
          maximum_item_length: number
          maximum_items: number
          values_to_check: string[]
        }
        Returns: boolean
      }
      is_valid_languages: { Args: { value_to_check: Json }; Returns: boolean }
      mark_conversation_read: {
        Args: { other_user_id: string }
        Returns: number
      }
      report_community_comment: {
        Args: {
          report_details?: string
          report_reasons: string[]
          target_comment_id: string
        }
        Returns: string
      }
      report_community_post: {
        Args: {
          report_details?: string
          report_reasons: string[]
          target_post_id: string
        }
        Returns: string
      }
      report_user:
        | {
            Args: {
              report_details?: string
              report_reason: string
              report_source?: string
              target_user_id: string
            }
            Returns: string
          }
        | {
            Args: {
              report_details?: string
              report_reasons: string[]
              report_source?: string
              target_user_id: string
            }
            Returns: string
          }
      request_connection: { Args: { target_user_id: string }; Returns: string }
      request_data_export: { Args: never; Returns: string }
      send_message: {
        Args: { message_body: string; target_user_id: string }
        Returns: string
      }
      toggle_community_post_helpful: {
        Args: { target_post_id: string }
        Returns: boolean
      }
      unblock_user: { Args: { target_user_id: string }; Returns: boolean }
      update_notification_preferences: {
        Args: {
          community_enabled: boolean
          matches_enabled: boolean
          messages_enabled: boolean
          product_updates_enabled: boolean
        }
        Returns: boolean
      }
      update_profile_privacy: {
        Args: {
          current_location_visible: boolean
          relocation_date_visible: boolean
          relocation_destination_visible: boolean
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
