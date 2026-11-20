import {
  BuildingIcon,
  ClipboardListIcon,
  EuroIcon,
  FileSignatureIcon,
  LayoutDashboardIcon,
  PackageIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

export type NavEintrag = { href: string; text: string; icon: LucideIcon; nurInhaber?: boolean };

/** Hauptnavigation des Büros. Neue Bereiche je Meilenstein hier ergänzen. */
export const NAVIGATION: NavEintrag[] = [
  { href: "/dashboard", text: "Übersicht", icon: LayoutDashboardIcon },
  { href: "/kunden", text: "Kunden", icon: UsersIcon },
  { href: "/objekte", text: "Objekte", icon: BuildingIcon },
  { href: "/vertraege", text: "Verträge", icon: FileSignatureIcon },
  { href: "/vorlagen", text: "Vorlagen", icon: ClipboardListIcon },
  { href: "/artikel", text: "Artikel", icon: PackageIcon },
  { href: "/preisliste", text: "Preisliste", icon: EuroIcon },
  { href: "/einstellungen", text: "Einstellungen", icon: SettingsIcon },
];
