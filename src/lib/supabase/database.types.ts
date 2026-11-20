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
          bundesland: string;
          vertragsbedingungen: string | null;
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
          bundesland?: string;
          vertragsbedingungen?: string | null;
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
          bundesland?: string;
          vertragsbedingungen?: string | null;
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
      einsatz: {
        Row: {
          id: string;
          betrieb_id: string;
          objekt_id: string;
          vorlage_id: string;
          vertrag_id: string | null;
          vertragsleistung_id: string | null;
          datum: string;
          zeitfenster_von: string | null;
          zeitfenster_bis: string | null;
          sollzeit_minuten: number;
          status: Database["public"]["Enums"]["einsatzstatus"];
          mitarbeiter_id: string | null;
          quelle: string;
          verschoben_von: string | null;
          notiz: string | null;
          erstellt_am: string;
          aktualisiert_am: string;
        };
        Insert: {
          id?: string;
          betrieb_id: string;
          objekt_id: string;
          vorlage_id: string;
          vertrag_id?: string | null;
          vertragsleistung_id?: string | null;
          datum: string;
          zeitfenster_von?: string | null;
          zeitfenster_bis?: string | null;
          sollzeit_minuten?: number;
          status?: Database["public"]["Enums"]["einsatzstatus"];
          mitarbeiter_id?: string | null;
          quelle?: string;
          verschoben_von?: string | null;
          notiz?: string | null;
          erstellt_am?: string;
          aktualisiert_am?: string;
        };
        Update: {
          id?: string;
          betrieb_id?: string;
          objekt_id?: string;
          vorlage_id?: string;
          vertrag_id?: string | null;
          vertragsleistung_id?: string | null;
          datum?: string;
          zeitfenster_von?: string | null;
          zeitfenster_bis?: string | null;
          sollzeit_minuten?: number;
          status?: Database["public"]["Enums"]["einsatzstatus"];
          mitarbeiter_id?: string | null;
          quelle?: string;
          verschoben_von?: string | null;
          notiz?: string | null;
          erstellt_am?: string;
          aktualisiert_am?: string;
        };
        Relationships: [
            {
              foreignKeyName: "einsatz_betrieb_id_fkey";
              columns: ["betrieb_id"];
              isOneToOne: false;
              referencedRelation: "betrieb";
              referencedColumns: ["id"];
            },
            {
              foreignKeyName: "einsatz_mitarbeiter_id_fkey";
              columns: ["mitarbeiter_id"];
              isOneToOne: false;
              referencedRelation: "mitglied";
              referencedColumns: ["id"];
            },
            {
              foreignKeyName: "einsatz_objekt_id_betrieb_id_fkey";
              columns: ["objekt_id", "betrieb_id"];
              isOneToOne: false;
              referencedRelation: "objekt";
              referencedColumns: ["id", "betrieb_id"];
            },
            {
              foreignKeyName: "einsatz_vertrag_id_betrieb_id_fkey";
              columns: ["vertrag_id", "betrieb_id"];
              isOneToOne: false;
              referencedRelation: "vertrag";
              referencedColumns: ["id", "betrieb_id"];
            },
            {
              foreignKeyName: "einsatz_vertragsleistung_id_betrieb_id_fkey";
              columns: ["vertragsleistung_id", "betrieb_id"];
              isOneToOne: false;
              referencedRelation: "vertragsleistung";
              referencedColumns: ["id", "betrieb_id"];
            },
            {
              foreignKeyName: "einsatz_vorlage_id_betrieb_id_fkey";
              columns: ["vorlage_id", "betrieb_id"];
              isOneToOne: false;
              referencedRelation: "auftragsvorlage";
              referencedColumns: ["id", "betrieb_id"];
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
      vertrag: {
        Row: {
          id: string;
          betrieb_id: string;
          vertragsnummer: number;
          kunde_id: string;
          objekt_id: string;
          titel: string;
          status: Database["public"]["Enums"]["vertragsstatus"];
          beginn: string;
          laufzeit_monate: number;
          verlaengerung_monate: number;
          kuendigungsfrist_monate: number;
          frist_zum: string;
          gekuendigt_am: string | null;
          endet_am: string | null;
          notiz: string | null;
          freigabe_token: string;
          unterschrieben_am: string | null;
          unterschrift_name: string | null;
          unterschrift_bild: string | null;
          erstellt_am: string;
          aktualisiert_am: string;
        };
        Insert: {
          id?: string;
          betrieb_id: string;
          vertragsnummer?: number;
          kunde_id: string;
          objekt_id: string;
          titel: string;
          status?: Database["public"]["Enums"]["vertragsstatus"];
          beginn: string;
          laufzeit_monate?: number;
          verlaengerung_monate?: number;
          kuendigungsfrist_monate?: number;
          frist_zum?: string;
          gekuendigt_am?: string | null;
          endet_am?: string | null;
          notiz?: string | null;
          freigabe_token?: string;
          unterschrieben_am?: string | null;
          unterschrift_name?: string | null;
          unterschrift_bild?: string | null;
          erstellt_am?: string;
          aktualisiert_am?: string;
        };
        Update: {
          id?: string;
          betrieb_id?: string;
          vertragsnummer?: number;
          kunde_id?: string;
          objekt_id?: string;
          titel?: string;
          status?: Database["public"]["Enums"]["vertragsstatus"];
          beginn?: string;
          laufzeit_monate?: number;
          verlaengerung_monate?: number;
          kuendigungsfrist_monate?: number;
          frist_zum?: string;
          gekuendigt_am?: string | null;
          endet_am?: string | null;
          notiz?: string | null;
          freigabe_token?: string;
          unterschrieben_am?: string | null;
          unterschrift_name?: string | null;
          unterschrift_bild?: string | null;
          erstellt_am?: string;
          aktualisiert_am?: string;
        };
        Relationships: [
            {
              foreignKeyName: "vertrag_betrieb_id_fkey";
              columns: ["betrieb_id"];
              isOneToOne: false;
              referencedRelation: "betrieb";
              referencedColumns: ["id"];
            },
            {
              foreignKeyName: "vertrag_kunde_id_betrieb_id_fkey";
              columns: ["kunde_id", "betrieb_id"];
              isOneToOne: false;
              referencedRelation: "kunde";
              referencedColumns: ["id", "betrieb_id"];
            },
            {
              foreignKeyName: "vertrag_objekt_id_betrieb_id_fkey";
              columns: ["objekt_id", "betrieb_id"];
              isOneToOne: false;
              referencedRelation: "objekt";
              referencedColumns: ["id", "betrieb_id"];
            },
          ];
      };
      vertragsleistung: {
        Row: {
          id: string;
          betrieb_id: string;
          version_id: string;
          vorlage_id: string;
          preis_id: string | null;
          bezeichnung: string | null;
          frequenz: Database["public"]["Enums"]["frequenz"];
          intervall: number;
          wochentage: number[];
          monatstag: number | null;
          startdatum: string | null;
          zeitfenster_von: string | null;
          zeitfenster_bis: string | null;
          erlaubte_wochentage: number[];
          feiertag_regel: Database["public"]["Enums"]["feiertagregel"];
          menge_m2: number | null;
          menge_fenster: number | null;
          preis_cent: number | null;
          reihenfolge: number;
        };
        Insert: {
          id?: string;
          betrieb_id: string;
          version_id: string;
          vorlage_id: string;
          preis_id?: string | null;
          bezeichnung?: string | null;
          frequenz?: Database["public"]["Enums"]["frequenz"];
          intervall?: number;
          wochentage?: number[];
          monatstag?: number | null;
          startdatum?: string | null;
          zeitfenster_von?: string | null;
          zeitfenster_bis?: string | null;
          erlaubte_wochentage?: number[];
          feiertag_regel?: Database["public"]["Enums"]["feiertagregel"];
          menge_m2?: number | null;
          menge_fenster?: number | null;
          preis_cent?: number | null;
          reihenfolge?: number;
        };
        Update: {
          id?: string;
          betrieb_id?: string;
          version_id?: string;
          vorlage_id?: string;
          preis_id?: string | null;
          bezeichnung?: string | null;
          frequenz?: Database["public"]["Enums"]["frequenz"];
          intervall?: number;
          wochentage?: number[];
          monatstag?: number | null;
          startdatum?: string | null;
          zeitfenster_von?: string | null;
          zeitfenster_bis?: string | null;
          erlaubte_wochentage?: number[];
          feiertag_regel?: Database["public"]["Enums"]["feiertagregel"];
          menge_m2?: number | null;
          menge_fenster?: number | null;
          preis_cent?: number | null;
          reihenfolge?: number;
        };
        Relationships: [
            {
              foreignKeyName: "vertragsleistung_betrieb_id_fkey";
              columns: ["betrieb_id"];
              isOneToOne: false;
              referencedRelation: "betrieb";
              referencedColumns: ["id"];
            },
            {
              foreignKeyName: "vertragsleistung_preis_id_betrieb_id_fkey";
              columns: ["preis_id", "betrieb_id"];
              isOneToOne: false;
              referencedRelation: "preisliste";
              referencedColumns: ["id", "betrieb_id"];
            },
            {
              foreignKeyName: "vertragsleistung_version_id_betrieb_id_fkey";
              columns: ["version_id", "betrieb_id"];
              isOneToOne: false;
              referencedRelation: "vertragsversion";
              referencedColumns: ["id", "betrieb_id"];
            },
            {
              foreignKeyName: "vertragsleistung_vorlage_id_betrieb_id_fkey";
              columns: ["vorlage_id", "betrieb_id"];
              isOneToOne: false;
              referencedRelation: "auftragsvorlage";
              referencedColumns: ["id", "betrieb_id"];
            },
          ];
      };
      vertragsversion: {
        Row: {
          id: string;
          betrieb_id: string;
          vertrag_id: string;
          version: number;
          gueltig_ab: string;
          abrechnungsart: Database["public"]["Enums"]["abrechnungsart"];
          pauschale_cent: number | null;
          grund: string | null;
          quelle: string;
          erstellt_von: string | null;
          erstellt_am: string;
        };
        Insert: {
          id?: string;
          betrieb_id: string;
          vertrag_id: string;
          version: number;
          gueltig_ab: string;
          abrechnungsart?: Database["public"]["Enums"]["abrechnungsart"];
          pauschale_cent?: number | null;
          grund?: string | null;
          quelle?: string;
          erstellt_von?: string | null;
          erstellt_am?: string;
        };
        Update: {
          id?: string;
          betrieb_id?: string;
          vertrag_id?: string;
          version?: number;
          gueltig_ab?: string;
          abrechnungsart?: Database["public"]["Enums"]["abrechnungsart"];
          pauschale_cent?: number | null;
          grund?: string | null;
          quelle?: string;
          erstellt_von?: string | null;
          erstellt_am?: string;
        };
        Relationships: [
            {
              foreignKeyName: "vertragsversion_betrieb_id_fkey";
              columns: ["betrieb_id"];
              isOneToOne: false;
              referencedRelation: "betrieb";
              referencedColumns: ["id"];
            },
            {
              foreignKeyName: "vertragsversion_vertrag_id_betrieb_id_fkey";
              columns: ["vertrag_id", "betrieb_id"];
              isOneToOne: false;
              referencedRelation: "vertrag";
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
      mein_mitglied_id:
        | {
          Args: {
            p_betrieb_id: string;
          };
          Returns: string;
        };
      paket_installieren:
        | {
          Args: {
            p_betrieb_id: string;
            p_paket: Json;
          };
          Returns: Json;
        };
      vertrag_dokument:
        | {
          Args: {
            p_token: string;
          };
          Returns: Json;
        };
      vertrag_freigabe_info:
        | {
          Args: {
            p_token: string;
          };
          Returns: {
            betrieb_name: string;
            vertragsnummer: number;
            titel: string;
            kunde_name: string;
            objekt_name: string;
            beginn: string;
            status: Database["public"]["Enums"]["vertragsstatus"];
            unterschrieben_am: string;
          }[];
        };
      vertrag_unterschreiben:
        | {
          Args: {
            p_token: string;
            p_name: string;
            p_bild: string;
          };
          Returns: undefined;
        };
      vertragsversion_anlegen:
        | {
          Args: {
            p_vertrag_id: string;
            p_gueltig_ab: string;
            p_abrechnungsart: Database["public"]["Enums"]["abrechnungsart"];
            p_pauschale_cent: number;
            p_grund: string;
            p_quelle?: string;
          };
          Returns: string;
        };
    };
    Enums: {
      abrechnungsart: "pauschale" | "aufwand" | "einzelauftrag";
      artikelart: "verbrauch" | "verschleiss" | "geraet";
      bedarfsbezug: "einsatz" | "m2" | "fenster" | "stunde";
      einsatzstatus: "geplant" | "zugewiesen" | "unterwegs" | "begonnen" | "erledigt" | "abgesagt";
      feiertagregel: "auslassen" | "naechster_werktag" | "ignorieren";
      frequenz: "taeglich" | "woechentlich" | "monatlich" | "einmalig";
      kundentyp: "firma" | "verwaltung" | "privat" | "oeffentlich";
      preiseinheit: "pauschal" | "stunde" | "m2" | "fenster" | "stueck" | "einsatz";
      rolle: "inhaber" | "disponent" | "mitarbeiter";
      vertragsstatus: "entwurf" | "aktiv" | "gekuendigt" | "beendet";
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
