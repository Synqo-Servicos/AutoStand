import { STATUS_BADGE_COLORS, STATUS_DOT_COLORS, STATUS_LABELS, type VehicleStatus } from "@/lib/constants";

export function StatusBadge({ status }: { status: string }) {
  const key = status as VehicleStatus;
  const badge = STATUS_BADGE_COLORS[key] ?? "bg-n100 text-n600 ring-1 ring-n200";
  const dot   = STATUS_DOT_COLORS[key]   ?? "bg-n400";
  const label = STATUS_LABELS[key]       ?? status;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      {label}
    </span>
  );
}
