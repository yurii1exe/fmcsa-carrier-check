import type { ReactNode } from "react";

export function Card({
  title,
  children,
  footnote,
}: {
  title: string;
  children: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      {children}
      {footnote ? (
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
          {footnote}
        </p>
      ) : null}
    </section>
  );
}

/**
 * A label/value pair.
 *
 * `<dt>`/`<dd>` rather than divs so a screen reader announces the pairing.
 * The value is `tabular-nums` because most of them are numbers that get
 * compared down a column.
 */
export function Field({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="border-b border-border/60 py-2 last:border-b-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
      {hint ? <dd className="mt-0.5 text-xs text-muted">{hint}</dd> : null}
    </div>
  );
}

export function FieldList({ children }: { children: ReactNode }) {
  return <dl className="grid gap-x-6 sm:grid-cols-2">{children}</dl>;
}

export type PillTone = "ok" | "warning" | "critical" | "info" | "neutral";

const PILL_TONES: Record<PillTone, string> = {
  ok: "bg-ok-surface text-ok border-ok/30",
  warning: "bg-warning-surface text-warning border-warning/30",
  critical: "bg-critical-surface text-critical border-critical/30",
  info: "bg-info-surface text-info border-info/30",
  neutral: "bg-surface-muted text-muted border-border",
};

/**
 * A status chip. The tone is always accompanied by its own text, so the
 * meaning survives colour blindness, a greyscale screenshot, and the
 * sunlight-on-a-phone case this tool is actually used in.
 */
export function Pill({
  tone,
  children,
}: {
  tone: PillTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-medium ${PILL_TONES[tone]}`}
    >
      {children}
    </span>
  );
}
