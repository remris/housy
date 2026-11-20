import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLLEN_TEXT, bueroKontext } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { SPRACHEN } from "@/lib/schemas/konto";
import {
  EinladungFormular,
  EinladungLoeschenKnopf,
  LinkKopieren,
  MitgliedAktionen,
} from "./team-teile";

export const metadata: Metadata = { title: "Team" };

const sprachText = (s: string) => SPRACHEN.find((x) => x.wert === s)?.text ?? s;

export default async function TeamSeite() {
  const k = await bueroKontext();
  const istInhaber = k.rolle === "inhaber";
  const [{ data: mitglieder }, { data: einladungen }] = await Promise.all([
    k.supabase
      .from("mitglied")
      .select("id, user_id, rolle, sprache, anzeigename, aktiv")
      .eq("betrieb_id", k.betriebId)
      .order("aktiv", { ascending: false })
      .order("erstellt_am"),
    istInhaber
      ? k.supabase
          .from("einladung")
          .select("id, email, rolle, token, laeuft_ab_am")
          .eq("betrieb_id", k.betriebId)
          .is("angenommen_am", null)
          .order("erstellt_am", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Mitglieder</h2>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Sprache</TableHead>
                <TableHead>Status</TableHead>
                {istInhaber && <TableHead className="text-right">Aktionen</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {mitglieder?.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    {m.anzeigename ?? "–"}
                    {m.user_id === k.user.id && (
                      <span className="text-muted-foreground"> (du)</span>
                    )}
                  </TableCell>
                  <TableCell>{ROLLEN_TEXT[m.rolle]}</TableCell>
                  <TableCell>{sprachText(m.sprache)}</TableCell>
                  <TableCell>
                    {m.aktiv ? (
                      <Badge variant="secondary">aktiv</Badge>
                    ) : (
                      <Badge variant="outline">deaktiviert</Badge>
                    )}
                  </TableCell>
                  {istInhaber && (
                    <TableCell className="text-right">
                      <MitgliedAktionen id={m.id} rolle={m.rolle} aktiv={m.aktiv} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {istInhaber && (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">Einladen</h2>
          <EinladungFormular />
          {einladungen && einladungen.length > 0 && (
            <div className="mt-2 overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-Mail</TableHead>
                    <TableHead>Rolle</TableHead>
                    <TableHead>Gültig bis</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {einladungen.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.email}</TableCell>
                      <TableCell>{ROLLEN_TEXT[e.rolle]}</TableCell>
                      <TableCell>{new Date(e.laeuft_ab_am).toLocaleDateString("de-DE")}</TableCell>
                      <TableCell className="space-x-1 text-right">
                        <LinkKopieren link={`${siteUrl()}/einladung/${e.token}`} />
                        <EinladungLoeschenKnopf id={e.id} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
