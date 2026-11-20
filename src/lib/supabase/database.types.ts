// Automatisch erzeugt (scripts/db-types-pglite.mjs bzw. supabase gen types). Nicht von Hand ändern.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      betrieb: {
        Row: {
          id: string;
          name: string;
          branchen: string[];
          firmenname: string | null;
          strasse: string | null;
          plz: string | null;
          ort: string | null;
          land: string;
          telefon: string | null;
          email: string | null;
          website: string | null;
          steuernummer: string | null;
          ust_id: string | null;
          kleinunternehmer: boolean;
          kontoinhaber: string | null;
          iban: string | null;
          bic: string | null;
          bank_name: string | null;
          logo_pfad: string | null;
          tarif: string;
          test_endet_am: string | null;
          erstellt_am: string;
          aktualisiert_am: string;
        };
        Insert: {
          id?: string;
          name: string;
          branchen?: string[];
          firmenname?: string | null;
          strasse?: string | null;
          plz?: string | null;
          ort?: string | null;
          land?: string;
          telefon?: string | null;
          email?: string | null;
          website?: string | null;
          steuernummer?: string | null;
          ust_id?: string | null;
          kleinunternehmer?: boolean;
          kontoinhaber?: string | null;
          iban?: string | null;
          bic?: string | null;
          bank_name?: string | null;
          logo_pfad?: string | null;
          tarif?: string;
          test_endet_am?: string | null;
          erstellt_am?: string;
          aktualisiert_am?: string;
        };
        Update: {
          id?: string;
          name?: string;
          branchen?: string[];
          firmenname?: string | null;
          strasse?: string | null;
          plz?: string | null;
          ort?: string | null;
          land?: string;
          telefon?: string | null;
          email?: string | null;
          website?: string | null;
          steuernummer?: string | null;
          ust_id?: string | null;
          kleinunternehmer?: boolean;
          kontoinhaber?: string | null;
          iban?: string | null;
          bic?: string | null;
          bank_name?: string | null;
          logo_pfad?: string | null;
          tarif?: string;
          test_endet_am?: string | null;
          erstellt_am?: string;
          aktualisiert_am?: string;
        };
        Relationships: [];
      };
      einladung: {
        Row: {
          id: string;
          betrieb_id: string;
          email: string;
          rolle: Database["public"]["Enums"]["rolle"];
          sprache: string;
          token: string;
          eingeladen_von: string | null;
          angenommen_am: string | null;
          laeuft_ab_am: string;
          erstellt_am: string;
        };
        Insert: {
          id?: string;
          betrieb_id: string;
          email: string;
          rolle?: Database["public"]["Enums"]["rolle"];
          sprache?: string;
          token?: string;
          eingeladen_von?: string | null;
          angenommen_am?: string | null;
          laeuft_ab_am?: string;
          erstellt_am?: string;
        };
        Update: {
          id?: string;
          betrieb_id?: string;
          email?: string;
          rolle?: Database["public"]["Enums"]["rolle"];
          sprache?: string;
          token?: string;
          eingeladen_von?: string | null;
          angenommen_am?: string | null;
          laeuft_ab_am?: string;
          erstellt_am?: string;
        };
        Relationships: [
            {
              foreignKeyName: "einladung_betrieb_id_fkey";
              columns: ["betrieb_id"];
              isOneToOne: false;
              referencedRelation: "betrieb";
              referencedColumns: ["id"];
            },
          ];
      };
      mitglied: {
        Row: {
          id: string;
          betrieb_id: string;
          user_id: string;
          rolle: Database["public"]["Enums"]["rolle"];
          sprache: string;
          anzeigename: string | null;
          aktiv: boolean;
          erstellt_am: string;
          aktualisiert_am: string;
        };
        Insert: {
          id?: string;
          betrieb_id: string;
          user_id: string;
          rolle?: Database["public"]["Enums"]["rolle"];
          sprache?: string;
          anzeigename?: string | null;
          aktiv?: boolean;
          erstellt_am?: string;
          aktualisiert_am?: string;
        };
        Update: {
          id?: string;
          betrieb_id?: string;
          user_id?: string;
          rolle?: Database["public"]["Enums"]["rolle"];
          sprache?: string;
          anzeigename?: string | null;
          aktiv?: boolean;
          erstellt_am?: string;
          aktualisiert_am?: string;
        };
        Relationships: [
            {
              foreignKeyName: "mitglied_betrieb_id_fkey";
              columns: ["betrieb_id"];
              isOneToOne: false;
              referencedRelation: "betrieb";
              referencedColumns: ["id"];
            },
          ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      betrieb_anlegen:
        | {
          Args: {
            p_name: string;
            p_branchen?: string[];
            p_anzeigename?: string;
          };
          Returns: string;
        };
      einladung_annehmen:
        | {
          Args: {
            p_token: string;
            p_anzeigename?: string;
          };
          Returns: string;
        };
      einladung_info:
        | {
          Args: {
            p_token: string;
          };
          Returns: {
            betrieb_name: string;
            email: string;
            rolle: Database["public"]["Enums"]["rolle"];
            gueltig: boolean;
          }[];
        };
      hat_rolle:
        | {
          Args: {
            p_betrieb_id: string;
            p_rollen: Database["public"]["Enums"]["rolle"][];
          };
          Returns: boolean;
        };
      ist_buero:
        | {
          Args: {
            p_betrieb_id: string;
          };
          Returns: boolean;
        };
      ist_inhaber:
        | {
          Args: {
            p_betrieb_id: string;
          };
          Returns: boolean;
        };
      ist_mitglied:
        | {
          Args: {
            p_betrieb_id: string;
          };
          Returns: boolean;
        };
    };
    Enums: {
      rolle: "inhaber" | "disponent" | "mitarbeiter";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
