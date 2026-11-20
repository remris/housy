import { Badge } from "@/components/ui/badge";
import { VERTRAGSSTATUS } from "@/lib/schemas/vertrag";

export function StatusBadge({
  status,
  unterschrieben,
}: {
  status: keyof typeof VERTRAGSSTATUS;
  unterschrieben?: boolean;
}) {
  const variante =
    status === "aktiv"
      ? "default"
      : status === "entwurf"
        ? "outline"
        : status === "gekuendigt"
          ? "secondary"
          : "ghost";
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Badge variant={variante as "default" | "outline" | "secondary" | "ghost"}>
        {VERTRAGSSTATUS[status]}
      </Badge>
      {status === "entwurf" && unterschrieben && <Badge variant="secondary">unterschrieben</Badge>}
    </span>
  );
}
