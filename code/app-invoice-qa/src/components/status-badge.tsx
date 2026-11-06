import { AlertTriangle, CheckCircle2, CircleDashed, PencilLine, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Flag } from "@/lib/types";

const STYLE: Record<string, { cls: string; Icon: typeof CheckCircle2 }> = {
  Pending: { cls: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200", Icon: CircleDashed },
  Approved: { cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200", Icon: CheckCircle2 },
  Corrected: { cls: "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200", Icon: PencilLine },
  Rejected: { cls: "bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200", Icon: XCircle },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STYLE[status] ?? STYLE.Pending;
  return (
    <Badge data-testid="status-badge" className={cn("gap-1 border-0", s.cls)}>
      <s.Icon /> {status}
    </Badge>
  );
}

export function FlagBadges({ flags, compact = false }: { flags: Flag[]; compact?: boolean }) {
  if (!flags.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <Badge
          key={f.key}
          title={f.detail}
          data-flag={f.key}
          variant="outline"
          className="gap-1 border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200"
        >
          <AlertTriangle />
          {compact ? f.label.replace("Unusual consumption", "Consumption").replace("Unmatched property", "Property") : f.label}
        </Badge>
      ))}
    </div>
  );
}
