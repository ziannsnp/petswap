export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          username: string;
          photo_url: string | null;
          phone_number: string | null;
          location: string | null;
          created_at: string;
          updated_at: string;
          consent_version: string | null;
          consent_given_at: string | null;
        };
        Insert: {
          id: string;
          display_name: string;
          username: string;
          photo_url?: string | null;
          phone_number?: string | null;
          location?: string | null;
          created_at?: string;
          updated_at?: string;
          consent_version?: string | null;
          consent_given_at?: string | null;
        };
        Update: {
          id?: string;
          display_name?: string;
          username?: string;
          photo_url?: string | null;
          phone_number?: string | null;
          location?: string | null;
          created_at?: string;
          updated_at?: string;
          consent_version?: string | null;
          consent_given_at?: string | null;
        };
        Relationships: [];
      };
      pets: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          species: Database['public']['Enums']['pet_species'];
          breed: string | null;
          age_year: number | null;
          photo_url: string | null;
          description: string | null;
          feeding_instruction: string | null;
          medical_note: string | null;
          behavior_note: string | null;
          allergies: string | null;
          vaccination_info: string | null;
          special_requirement: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          species: Database['public']['Enums']['pet_species'];
          breed?: string | null;
          age_year?: number | null;
          photo_url?: string | null;
          description?: string | null;
          feeding_instruction?: string | null;
          medical_note?: string | null;
          behavior_note?: string | null;
          allergies?: string | null;
          vaccination_info?: string | null;
          special_requirement?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['pets']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'pets_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      listings: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          location: string;
          description: string;
          capacity: number;
          accepted_pet_types: Database['public']['Enums']['pet_species'][];
          facilities: string | null;
          status: Database['public']['Enums']['listing_status'];
          deleted_at: string | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title: string;
          location: string;
          description: string;
          capacity: number;
          accepted_pet_types?: Database['public']['Enums']['pet_species'][];
          facilities?: string | null;
          status?: Database['public']['Enums']['listing_status'];
          deleted_at?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['listings']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'listings_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      listing_images: {
        Row: {
          id: string;
          listing_id: string;
          storage_path: string;
          alt_text: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          storage_path: string;
          alt_text?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['listing_images']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'listing_images_listing_id_fkey';
            columns: ['listing_id'];
            isOneToOne: false;
            referencedRelation: 'listings';
            referencedColumns: ['id'];
          },
        ];
      };
      bookings: {
        Row: {
          id: string;
          listing_id: string;
          pet_id: string;
          requester_id: string;
          status: Database['public']['Enums']['booking_status'];
          start_date: string;
          end_date: string;
          requester_note: string | null;
          owner_note: string | null;
          created_at: string;
          updated_at: string;
          confirmed_at: string | null;
          declined_at: string | null;
          cancelled_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          listing_id: string;
          pet_id: string;
          requester_id: string;
          status?: Database['public']['Enums']['booking_status'];
          start_date: string;
          end_date: string;
          requester_note?: string | null;
          owner_note?: string | null;
          created_at?: string;
          updated_at?: string;
          confirmed_at?: string | null;
          declined_at?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['bookings']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'bookings_listing_id_fkey';
            columns: ['listing_id'];
            isOneToOne: false;
            referencedRelation: 'listings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_pet_id_fkey';
            columns: ['pet_id'];
            isOneToOne: false;
            referencedRelation: 'pets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_requester_id_fkey';
            columns: ['requester_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_user_owns_listing: {
        Args: { target_listing_id: string };
        Returns: boolean;
      };
      listing_is_public: {
        Args: { target_listing_id: string };
        Returns: boolean;
      };
      storage_folder_listing_id: {
        Args: { object_name: string };
        Returns: string | null;
      };
    };
    Enums: {
      booking_status: 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed';
      listing_status: 'draft' | 'published' | 'deleted';
      pet_species: 'dog' | 'cat' | 'rabbit' | 'hamster' | 'guinea_pig' | 'fish' | 'reptile' | 'exotic_mammal' | 'bird' | 'other';
    };
    CompositeTypes: Record<string, never>;
  };
};

export type PetSpecies = Database['public']['Enums']['pet_species'];
