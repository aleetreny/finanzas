import type { LucideIcon } from "lucide-react";

export function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  tone?: "positive" | "negative";
}) {
  return (
    <article className="card metric-card">
      <span className="metric-label"><Icon size={14} />{label}</span>
      <strong className={`metric-value ${tone ?? ""}`}>{value}</strong>
      <small className="metric-note">{note}</small>
    </article>
  );
}
