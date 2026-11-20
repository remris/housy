import {
  BuildingIcon,
  ClipboardListIcon,
  ClockIcon,
  InboxIcon,
  EuroIcon,
  FileSignatureIcon,
  FileCheckIcon,
  ReceiptIcon,
  MailQuestionIcon,
  FileTextIcon,
  CalendarRangeIcon,
  LayoutDashboardIcon,
  PackageIcon,
  WarehouseIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

export type NavEintrag = { href: string; text: string; icon: LucideIcon; nurInhaber?: boolean };

/** Hauptnavigation des Büros. Neue Bereiche je Meilenstein hier ergänzen. */
export const NAVIGATION: NavEintrag[] = [
  { href: "/dashboard", text: "Übersicht", icon: LayoutDashboardIcon },
  { href: "/anfragen", text: "Anfragen", icon: MailQuestionIcon },
  { href: "/angebote", text: "Angebote", icon: FileTextIcon },
  { href: "/kunden", text: "Kunden", icon: UsersIcon },
  { href: "/objekte", text: "Objekte", icon: BuildingIcon },
  { href: "/planung", text: "Planung", icon: CalendarRangeIcon },
  { href: "/rueckmeldungen", text: "Rückmeldungen", icon: InboxIcon },
  { href: "/zeiten", text: "Zeiten", icon: ClockIcon },
  { href: "/nachweise", text: "Nachweise", icon: FileCheckIcon },
  { href: "/rechnungen", text: "Rechnungen", icon: ReceiptIcon },
  { href: "/vertraege", text: "Verträge", icon: FileSignatureIcon },
  { href: "/vorlagen", text: "Vorlagen", icon: ClipboardListIcon },
  { href: "/inventar", text: "Inventar", icon: WarehouseIcon },
  { href: "/artikel", text: "Artikel", icon: PackageIcon },
  { href: "/preisliste", text: "Preisliste", icon: EuroIcon },
  { href: "/einstellungen", text: "Einstellungen", icon: SettingsIcon },
];
