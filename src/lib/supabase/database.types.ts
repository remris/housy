// Automatisch erzeugt (scripts/db-types-pglite.mjs bzw. supabase gen types). Nicht von Hand ändern.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      ansprechpartner: {
        Row: {
          id: string;
          betrieb_id: string;
          kunde_id: string;
          name: string;
          funktion: string | null;
          email: string | null;
          telefon: string | null;
          ist_hauptkontakt: boolean;
          erstellt_am: string;
        };
        Insert: {
          id?: string;
          betrieb_id: string;
          kunde_id: string;
          name: string;
          funktion?: string | null;
          email?: string | null;
          telefon?: string | null;
          ist_hauptkontakt?: boolean;
          erstellt_am?: string;
        };
        Update: {
          id?: string;
          betrieb_id?: string;
          kunde_id?: string;
          name?: string;
          funktion?: string | null;
          email?: string | null;
          telefon?: string | null;
          ist_hauptkontakt?: boolean;
          erstellt_am?: string;
        };
        Relationships: [
            {
              foreignKeyName: "ansprechpartner_betrieb_id_fkey";
              columns: ["betrieb_id"];
              isOneToOne: false;
              referencedRelation: "betrieb";
              referencedColumns: ["id"];
            },
            {
              foreignKeyName: "ansprechpartner_kunde_id_betrieb_id_fkey";
              columns: ["kunde_id", "betrieb_id"];
              isOneToOne: false;
              referencedRelation: "kunde";
              referencedColumns: ["id", "betrieb_id"];
            },
          ];
      };
      artikel: {
        Row: {
          id: string;
          betrieb_id: string;
          name: string;
          art: Database["public"]["Enums"]["artikelart"];
          einheit: string;
          gebinde_name: string | null;
          gebinde_menge: number;
          preis_cent: number | null;
          lieferant: string | null;
          bestellnummer: string | null;
          mindestbestand: number;
          lieferzeit_tage: number;
          lebensdauer: number | null;
          lebensdauer_einheit: string | null;
          auto_wechsel: boolean;
          pruefintervall_monate: number | null;
          notiz: string | null;
          aktiv: boolean;
          erstellt_am: string;
          aktualisiert_am: string;
        };
        Insert: {
          id?: string;
          betrieb_id: string;
          name: string;
          art?: Database["public"]["Enums"]["artikelart"];
          einheit?: string;
          gebinde_name?: string | null;
          gebinde_menge?: number;
          preis_cent?: number | null;
          lieferant?: string | null;
          bestellnummer?: string | null;
          mindestbestand?: number;
          lieferzeit_tage?: number;
          lebensdauer?: number | null;
          lebensdauer_einheit?: string | null;
          auto_wechsel?: boolean;
          pruefintervall_monate?: number | null;
          notiz?: string | null;
          aktiv?: boolean;
          erstellt_am?: string;
          aktualisiert_am?: string;
        };
        Update: {
          id?: string;
          betrieb_id?: string;
          name?: string;
          art?: Database["public"]["Enums"]["artikelart"];
          einheit?: string;
          gebinde_name?: string | null;
          gebinde_menge?: number;
          preis_cent?: number | null;
          lieferant?: string | null;
          bestellnummer?: string | null;
          mindestbestand?: number;
          lieferzeit_tage?: number;
          lebensdauer?: number | null;
          lebensdauer_einheit?: string | null;
          auto_wechsel?: boolean;
          pruefintervall_monate?: number | null;
          notiz?: string | null;
          aktiv?: boolean;
          erstellt_am?: string;
          aktualisiert_am?: string;
        };
        Relationships: [
            {
              foreignKeyName: "artikel_betrieb_id_fkey";
              columns: ["betrieb_id"];
              isOneToOne: false;
              referencedRelation: "betrieb";
              referencedColumns: ["id"];
            },
          ];
      };
      auftragsvorlage: {
        Row: {
          id: string;
          betrieb_id: string;
          name: string;
          branche: string | null;
          beschreibung: string | null;
          sollzeit_minuten: number;
          minuten_pro_100m2: number | null;
          minuten_pro_fenster: number | null;
          aktiv: boolean;
          erstellt_am: string;
          aktualisiert_am: string;
        };
        Insert: {
          id?: string;
          betrieb_id: string;
          name: string;
          branche?: string | null;
          beschreibung?: string | null;
          sollzeit_minuten?: number;
          minuten_pro_100m2?: number | null;
          minuten_pro_fenster?: number | null;
          aktiv?: boolean;
          erstellt_am?: string;
          aktualisiert_am?: string;
        };
        Update: {
          id?: string;
          betrieb_id?: string;
          name?: string;
          branche?: string | null;
          beschreibung?: string | null;
          sollzeit_minuten?: number;
          minuten_pro_100m2?: number | null;
          minuten_pro_fenster?: number | null;
          aktiv?: boolean;
          erstellt_am?: string;
          aktualisiert_am?: string;
        };
        Relationships: [
            {
              foreignKeyName: "auftragsvorlage_betrieb_id_fkey";
              columns: ["betrieb_id"];
              isOneToOne: false;
              referencedRelation: "betrieb";
              referencedColumns: ["id"];
            },
          ];
      };
      bereich: {
        Row: {
          id: string;
          betrieb_id: string;
          objekt_id: string;
          name: string;
          flaeche_m2: number | null;
          bodenart: string | null;
          etage: string | null;
          reihenfolge: number;
          notiz: string | null;
          erstellt_am: string;
        };
        Insert: {
          id?: string;
          betrieb_id: string;
          objekt_id: string;
          name: string;
          flaeche_m2?: number | null;
          bodenart?: string | null;
          etage?: string | null;
          reihenfolge?: number;
          notiz?: string | null;
          erstellt_am?: string;
        };
        Update: {
          id?: string;
          betrieb_id?: string;
          objekt_id?: string;
          name?: string;
          flaeche_m2?: number | null;
          bodenart?: string | null;
          etage?: string | null;
          reihenfolge?: number;
          notiz?: string | null;
          erstellt_am?: string;
        };
        Relationships: [
            {
              foreignKeyName: "bereich_betrieb_id_fkey";
              columns: ["betrieb_id"];
              isOneToOne: false;
              referencedRelation: "betrieb";
              referencedColumns: ["id"];
            },
            {
              foreignKeyName: "bereich_objekt_id_betrieb_id_fkey";
              columns: ["objekt_id", "betrieb_id"];
              isOneToOne: false;
              referencedRelation: "objekt";
              referencedColumns: ["id", "betrieb_id"];
            },
          ];
      };
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
      fensteraufmass: {
        Row: {
          id: string;
          betrieb_id: string;
          objekt_id: string;
          bezeichnung: string | null;
          typ: string;
          anzahl: number;
          etage: string | null;
          mit_rahmen: boolean;
          hilfsmittel: string[];
          notiz: string | null;
          erstellt_am: string;
        };
        Insert: {
          id?: string;
          betrieb_id: string;
          objekt_id: string;
          bezeichnung?: string | null;
          typ?: string;
          anzahl?: number;
          etage?: string | null;
          mit_rahmen?: boolean;
          hilfsmittel?: string[];
          notiz?: string | null;
          erstellt_am?: string;
        };
        Update: {
          id?: string;
          betrieb_id?: string;
          objekt_id?: string;
          bezeichnung?: string | null;
          typ?: string;
          anzahl?: number;
          etage?: string | null;
          mit_rahmen?: boolean;
          hilfsmittel?: string[];
          notiz?: string | null;
          erstellt_am?: string;
        };
        Relationships: [
            {
              foreignKeyName: "fensteraufmass_betrieb_id_fkey";
              columns: ["betrieb_id"];
              isOneToOne: false;
              referencedRelation: "betrieb";
              referencedColumns: ["id"];
            },
            {
              foreignKeyName: "fensteraufmass_objekt_id_betrieb_id_fkey";
              columns: ["objekt_id", "betrieb_id"];
              isOneToOne: false;
              referencedRelation: "objekt";
              referencedColumns: ["id", "betrieb_id"];
            },
          ];
      };
      kunde: {
        Row: {
          id: string;
          betrieb_id: string;
          kundennummer: number;
          typ: Database["public"]["Enums"]["kundentyp"];
          name: string;
          zusatz: string | null;
          strasse: string | null;
          plz: string | null;
          ort: string | null;
          land: string;
          email: string | null;
          telefon: string | null;
          rechnungs_email: string | null;
          leitweg_id: string | null;
          ust_id: string | null;
          zahlungsziel_tage: number;
          notiz: string | null;
          aktiv: boolean;
          erstellt_am: string;
          aktualisiert_am: string;
        };
        Insert: {
          id?: string;
          betrieb_id: string;
          kundennummer?: number;
          typ?: Database["public"]["Enums"]["kundentyp"];
          name: string;
          zusatz?: string | null;
          strasse?: string | null;
          plz?: string | null;
          ort?: string | null;
          land?: string;
          email?: string | null;
          telefon?: string | null;
          rechnungs_email?: string | null;
          leitweg_id?: string | null;
          ust_id?: string | null;
          zahlungsziel_tage?: number;
          notiz?: string | null;
          aktiv?: boolean;
          erstellt_am?: string;
          aktualisiert_am?: string;
        };
        Update: {
          id?: string;
          betrieb_id?: string;
          kundennummer?: number;
          typ?: Database["public"]["Enums"]["kundentyp"];
          name?: string;
          zusatz?: string | null;
          strasse?: string | null;
          plz?: string | null;
          ort?: string | null;
          land?: string;
          email?: string | null;
          telefon?: string | null;
          rechnungs_email?: string | null;
          leitweg_id?: string | null;
          ust_id?: string | null;
          zahlungsziel_tage?: number;
          notiz?: string | null;
          aktiv?: boolean;
          erstellt_am?: string;
          aktualisiert_am?: string;
        };
        Relationships: [
            {
              foreignKeyName: "kunde_betrieb_id_fkey";
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
      nummernkreis: {
        Row: {
          betrieb_id: string;
          art: string;
          naechste: number;
        };
        Insert: {
          betrieb_id: string;
          art: string;
          naechste?: number;
        };
        Update: {
          betrieb_id?: string;
          art?: string;
          naechste?: number;
        };
        Relationships: [
            {
              foreignKeyName: "nummernkreis_betrieb_id_fkey";
              columns: ["betrieb_id"];
              isOneToOne: false;
              referencedRelation: "betrieb";
              referencedColumns: ["id"];
            },
          ];
      };
      objekt: {
        Row: {
          id: string;
          betrieb_id: string;
          kunde_id: string;
          name: string;
          strasse: string | null;
          plz: string | null;
          ort: string | null;
          land: string;
          breitengrad: number | null;
          laengengrad: number | null;
          zugangshinweise: string | null;
          schluessel: string | null;
          notiz: string | null;
          qr_kennung: string;
          aktiv: boolean;
          erstellt_am: string;
          aktualisiert_am: string;
        };
        Insert: {
          id?: string;
          betrieb_id: string;
          kunde_id: string;
          name: string;
          strasse?: string | null;
          plz?: string | null;
          ort?: string | null;
          land?: string;
          breitengrad?: number | null;
          laengengrad?: number | null;
          zugangshinweise?: string | null;
          schluessel?: string | null;
          notiz?: string | null;
          qr_kennung?: string;
          aktiv?: boolean;
          erstellt_am?: string;
          aktualisiert_am?: string;
        };
        Update: {
          id?: string;
          betrieb_id?: string;
          kunde_id?: string;
          name?: string;
          strasse?: string | null;
          plz?: string | null;
          ort?: string | null;
          land?: string;
          breitengrad?: number | null;
          laengengrad?: number | null;
          zugangshinweise?: string | null;
          schluessel?: string | null;
          notiz?: string | null;
          qr_kennung?: string;
          aktiv?: boolean;
          erstellt_am?: string;
          aktualisiert_am?: string;
        };
        Relationships: [
            {
              foreignKeyName: "objekt_betrieb_id_fkey";
              columns: ["betrieb_id"];
              isOneToOne: false;
              referencedRelation: "betrieb";
              referencedColumns: ["id"];
            },
            {
              foreignKeyName: "objekt_kunde_id_betrieb_id_fkey";
              columns: ["kunde_id", "betrieb_id"];
              isOneToOne: false;
              referencedRelation: "kunde";
              referencedColumns: ["id", "betrieb_id"];
            },
          ];
      };
      objekt_foto: {
        Row: {
          id: string;
          betrieb_id: string;
          objekt_id: string;
          pfad: string;
          beschreibung: string | null;
          erstellt_von: string | null;
          erstellt_am: string;
        };
        Insert: {
          id?: string;
          betrieb_id: string;
          objekt_id: string;
          pfad: string;
          beschreibung?: string | null;
          erstellt_von?: string | null;
          erstellt_am?: string;
        };
        Update: {
          id?: string;
          betrieb_id?: string;
          objekt_id?: string;
          pfad?: string;
          beschreibung?: string | null;
          erstellt_von?: string | null;
          erstellt_am?: string;
        };
        Relationships: [
            {
              foreignKeyName: "objekt_foto_betrieb_id_fkey";
              columns: ["betrieb_id"];
              isOneToOne: false;
              referencedRelation: "betrieb";
              referencedColumns: ["id"];
            },
            {
              foreignKeyName: "objekt_foto_objekt_id_betrieb_id_fkey";
              columns: ["objekt_id", "betrieb_id"];
              isOneToOne: false;
              referencedRelation: "objekt";
              referencedColumns: ["id", "betrieb_id"];
            },
          ];
      };
      preisliste: {
        Row: {
          id: string;
          betrieb_id: string;
          name: string;
          beschreibung: string | null;
          einheit: Database["public"]["Enums"]["preiseinheit"];
          preis_cent: number;
          ust_satz: number;
          sonderleistung: boolean;
          vorlage_id: string | null;
          aktiv: boolean;
          erstellt_am: string;
          aktualisiert_am: string;
        };
        Insert: {
          id?: string;
          betrieb_id: string;
          name: string;
          beschreibung?: string | null;
          einheit?: Database["public"]["Enums"]["preiseinheit"];
          preis_cent: number;
          ust_satz?: number;
          sonderleistung?: boolean;
          vorlage_id?: string | null;
          aktiv?: boolean;
          erstellt_am?: string;
          aktualisiert_am?: string;
        };
        Update: {
          id?: string;
          betrieb_id?: string;
          name?: string;
          beschreibung?: string | null;
          einheit?: Database["public"]["Enums"]["preiseinheit"];
          preis_cent?: number;
          ust_satz?: number;
          sonderleistung?: boolean;
          vorlage_id?: string | null;
          aktiv?: boolean;
          erstellt_am?: string;
          aktualisiert_am?: string;
        };
        Relationships: [
            {
              foreignKeyName: "preisliste_betrieb_id_fkey";
              columns: ["betrieb_id"];
              isOneToOne: false;
              referencedRelation: "betrieb";
              referencedColumns: ["id"];
            },
            {
              foreignKeyName: "preisliste_vorlage_id_betrieb_id_fkey";
              columns: ["vorlage_id", "betrieb_id"];
              isOneToOne: false;
              referencedRelation: "auftragsvorlage";
              referencedColumns: ["id", "betrieb_id"];
            },
          ];
      };
      vorlage_bedarf: {
        Row: {
          id: string;
          betrieb_id: string;
          vorlage_id: string;
          artikel_id: string;
          menge: number;
          bezug: Database["public"]["Enums"]["bedarfsbezug"];
        };
        Insert: {
          id?: string;
          betrieb_id: string;
          vorlage_id: string;
          artikel_id: string;
          menge: number;
          bezug?: Database["public"]["Enums"]["bedarfsbezug"];
        };
        Update: {
          id?: string;
          betrieb_id?: string;
          vorlage_id?: string;
          artikel_id?: string;
          menge?: number;
          bezug?: Database["public"]["Enums"]["bedarfsbezug"];
        };
        Relationships: [
            {
              foreignKeyName: "vorlage_bedarf_artikel_id_betrieb_id_fkey";
              columns: ["artikel_id", "betrieb_id"];
              isOneToOne: false;
              referencedRelation: "artikel";
              referencedColumns: ["id", "betrieb_id"];
            },
            {
              foreignKeyName: "vorlage_bedarf_betrieb_id_fkey";
              columns: ["betrieb_id"];
              isOneToOne: false;
              referencedRelation: "betrieb";
              referencedColumns: ["id"];
            },
            {
              foreignKeyName: "vorlage_bedarf_vorlage_id_betrieb_id_fkey";
              columns: ["vorlage_id", "betrieb_id"];
              isOneToOne: false;
              referencedRelation: "auftragsvorlage";
              referencedColumns: ["id", "betrieb_id"];
            },
          ];
      };
      vorlage_taetigkeit: {
        Row: {
          id: string;
          betrieb_id: string;
          vorlage_id: string;
          text: string;
          reihenfolge: number;
          foto_pflicht: boolean;
        };
        Insert: {
          id?: string;
          betrieb_id: string;
          vorlage_id: string;
          text: string;
          reihenfolge?: number;
          foto_pflicht?: boolean;
        };
        Update: {
          id?: string;
          betrieb_id?: string;
          vorlage_id?: string;
          text?: string;
          reihenfolge?: number;
          foto_pflicht?: boolean;
        };
        Relationships: [
            {
              foreignKeyName: "vorlage_taetigkeit_betrieb_id_fkey";
              columns: ["betrieb_id"];
              isOneToOne: false;
              referencedRelation: "betrieb";
              referencedColumns: ["id"];
            },
            {
              foreignKeyName: "vorlage_taetigkeit_vorlage_id_betrieb_id_fkey";
              columns: ["vorlage_id", "betrieb_id"];
              isOneToOne: false;
              referencedRelation: "auftragsvorlage";
              referencedColumns: ["id", "betrieb_id"];
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
      paket_installieren:
        | {
          Args: {
            p_betrieb_id: string;
            p_paket: Json;
          };
          Returns: Json;
        };
    };
    Enums: {
      artikelart: "verbrauch" | "verschleiss" | "geraet";
      bedarfsbezug: "einsatz" | "m2" | "fenster" | "stunde";
      kundentyp: "firma" | "verwaltung" | "privat" | "oeffentlich";
      preiseinheit: "pauschal" | "stunde" | "m2" | "fenster" | "stueck" | "einsatz";
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
