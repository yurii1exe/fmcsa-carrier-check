import type { CarrierRecord } from "@/lib/fmcsa/types";
import type { RiskAssessment, RiskFlag, Verdict } from "@/lib/fmcsa/risk";
import { assessCarrier, readAuthority, readSafetyRating } from "@/lib/fmcsa/risk";
import {
  authorityLabel,
  carrierName,
  formatAddress,
  formatCount,
  formatDate,
  formatDollars,
  formatIdentifier,
  formatRate,
} from "@/lib/fmcsa/format";
import { Card, Field, FieldList, Pill, type PillTone } from "./ui";

export function CarrierReport({ record }: { record: CarrierRecord }) {
  const { carrier } = record;
  const assessment = assessCarrier(carrier);
  const address = formatAddress(carrier);

  return (
    <div className="flex flex-col gap-4">
      <VerdictBanner assessment={assessment} />

      <Card title="Carrier">
        <h3 className="text-xl font-semibold">{carrierName(carrier)}</h3>
        {carrier.dbaName && carrier.dbaName !== carrier.legalName ? (
          <p className="text-muted">Doing business as {carrier.dbaName}</p>
        ) : null}
        <FieldList>
          <Field
            label="USDOT number"
            value={formatIdentifier(carrier.dotNumber)}
          />
          <Field
            label="Operation"
            value={
              carrier.carrierOperation?.carrierOperationDesc ??
              carrier.carrierOperation?.carrierOperationCode ??
              "—"
            }
          />
          <Field label="Power units" value={formatCount(carrier.totalPowerUnits)} />
          <Field label="Drivers" value={formatCount(carrier.totalDrivers)} />
          {address ? <Field label="Physical address" value={address} /> : null}
          <Field
            label="Entity type"
            value={carrier.censusTypeId?.censusTypeDesc ?? "—"}
          />
        </FieldList>
      </Card>

      <Card
        title="Operating authority"
        footnote="Authority is the legal permission to haul for hire. A carrier with no active authority is not covered by the filings below, whatever those filings say."
      >
        <FieldList>
          <AuthorityField label="Common" value={carrier.commonAuthorityStatus} />
          <AuthorityField label="Contract" value={carrier.contractAuthorityStatus} />
          <AuthorityField label="Broker" value={carrier.brokerAuthorityStatus} />
          <Field
            label="Allowed to operate"
            value={
              <Pill tone={carrier.allowedToOperate === "N" ? "critical" : "ok"}>
                {carrier.allowedToOperate === "N" ? "No" : "Yes"}
              </Pill>
            }
          />
          <Field
            label="Registration status"
            value={carrier.statusCode === "I" ? "Inactive" : "Active"}
            hint={carrier.statusCode ? `statusCode ${carrier.statusCode}` : undefined}
          />
          {carrier.oosDate ? (
            <Field
              label="Out of service since"
              value={
                <Pill tone="critical">{formatDate(carrier.oosDate) ?? carrier.oosDate}</Pill>
              }
            />
          ) : null}
        </FieldList>
      </Card>

      <Card
        title="Insurance on file"
        footnote="These are filings FMCSA holds, not certificates of current coverage. A filing can remain on record after a policy has lapsed, and the cancellation reaches FMCSA on a delay. Always get a COI direct from the agent before dispatch."
      >
        <FieldList>
          <InsuranceField
            label="Liability (BIPD)"
            onFile={carrier.bipdInsuranceOnFile}
            required={carrier.bipdInsuranceRequired}
            amount={carrier.bipdRequiredAmount}
          />
          <InsuranceField
            label="Cargo"
            onFile={carrier.cargoInsuranceOnFile}
            required={carrier.cargoInsuranceRequired}
          />
          <InsuranceField
            label="Bond / trust fund"
            onFile={carrier.bondInsuranceOnFile}
            required={carrier.bondInsuranceRequired}
          />
        </FieldList>
      </Card>

      <Card
        title="Safety rating"
        footnote="A rating is only assigned after an on-site compliance review. Most carriers have never had one, so an unrated carrier is the norm rather than a red flag."
      >
        <FieldList>
          <Field
            label="Rating"
            value={<SafetyRatingPill value={carrier.safetyRating} />}
          />
          <Field
            label="Rating date"
            value={formatDate(carrier.safetyRatingDate) ?? "—"}
          />
          <Field label="Last review" value={formatDate(carrier.reviewDate) ?? "—"} />
          <Field label="Review type" value={carrier.reviewType ?? "—"} />
        </FieldList>
      </Card>

      <Card
        title="Inspections and crashes, last 24 months"
        footnote={
          carrier.oosRateNationalAverageYear
            ? `National averages are FMCSA's published figures for ${carrier.oosRateNationalAverageYear}. Crash counts are not fault-adjusted.`
            : "Crash counts are not fault-adjusted — a carrier that was rear-ended still shows a crash."
        }
      >
        <FieldList>
          <Field
            label="Driver inspections"
            value={formatCount(carrier.driverInsp)}
            hint={`${formatCount(carrier.driverOosInsp)} out of service — ${formatRate(carrier.driverOosRate)} vs ${formatRate(carrier.driverOosRateNationalAverage)} national`}
          />
          <Field
            label="Vehicle inspections"
            value={formatCount(carrier.vehicleInsp)}
            hint={`${formatCount(carrier.vehicleOosInsp)} out of service — ${formatRate(carrier.vehicleOosRate)} vs ${formatRate(carrier.vehicleOosRateNationalAverage)} national`}
          />
          <Field label="Total crashes" value={formatCount(carrier.crashTotal)} />
          <Field
            label="Crash breakdown"
            value={`${formatCount(carrier.fatalCrash)} fatal, ${formatCount(carrier.injCrash)} injury, ${formatCount(carrier.towawayCrash)} tow-away`}
          />
        </FieldList>
      </Card>

      <FlagList flags={assessment.flags} />

      <Provenance record={record} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const VERDICT_COPY: Record<
  Verdict,
  { tone: PillTone; heading: string; body: string }
> = {
  blocked: {
    tone: "critical",
    heading: "Do not dispatch",
    body: "At least one check failed in a way that stops this carrier operating legally.",
  },
  caution: {
    tone: "warning",
    heading: "Check before dispatch",
    body: "Nothing disqualifying, but there are items worth a phone call.",
  },
  clear: {
    tone: "ok",
    heading: "No flags raised",
    body: "Every automated check passed against the FMCSA record.",
  },
};

function VerdictBanner({ assessment }: { assessment: RiskAssessment }) {
  const copy = VERDICT_COPY[assessment.verdict];
  const toneClass =
    assessment.verdict === "blocked"
      ? "border-critical/40 bg-critical-surface"
      : assessment.verdict === "caution"
        ? "border-warning/40 bg-warning-surface"
        : "border-ok/40 bg-ok-surface";

  return (
    <section
      aria-label="Overall assessment"
      className={`rounded-lg border p-4 sm:p-5 ${toneClass}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Pill tone={copy.tone}>{copy.heading}</Pill>
        <span className="text-sm text-muted">
          {assessment.criticalCount} critical, {assessment.warningCount} warning
        </span>
      </div>
      <p className="mt-2">{copy.body}</p>
    </section>
  );
}

const SEVERITY_LABEL = {
  critical: "Critical",
  warning: "Warning",
  info: "Note",
} as const;

const SEVERITY_TONE: Record<RiskFlag["severity"], PillTone> = {
  critical: "critical",
  warning: "warning",
  info: "info",
};

function FlagList({ flags }: { flags: RiskFlag[] }) {
  if (flags.length === 0) return null;

  return (
    <Card
      title="Checks"
      footnote="Every check reads named FMCSA fields, listed against each item. There is no weighting and no proprietary score — the derivation is the whole point."
    >
      <ul className="flex flex-col gap-3">
        {flags.map((flag) => (
          <li key={flag.id} className="border-b border-border/60 pb-3 last:border-b-0 last:pb-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <Pill tone={SEVERITY_TONE[flag.severity]}>
                {SEVERITY_LABEL[flag.severity]}
              </Pill>
              <span className="font-medium">{flag.title}</span>
            </div>
            <p className="mt-1 text-sm">{flag.detail}</p>
            <p className="mt-1 font-mono text-xs text-muted">{flag.source}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AuthorityField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  const state = readAuthority(value);
  const tone: PillTone =
    state === "active" ? "ok" : state === "unknown" ? "neutral" : "warning";
  return (
    <Field
      label={`${label} authority`}
      value={<Pill tone={tone}>{authorityLabel(state)}</Pill>}
    />
  );
}

function InsuranceField({
  label,
  onFile,
  required,
  amount,
}: {
  label: string;
  onFile: string | null;
  required: string | null;
  amount?: string | null;
}) {
  const count = Number(onFile ?? "");
  const hasFiling = Number.isFinite(count) && count > 0;
  const isRequired = (required ?? "").toUpperCase() === "Y";

  const tone: PillTone = hasFiling ? "ok" : isRequired ? "critical" : "neutral";
  const text = hasFiling
    ? `${count} on file`
    : isRequired
      ? "Required, none on file"
      : "Not required";

  const requiredAmount = amount ? formatDollars(amount) : null;

  return (
    <Field
      label={label}
      value={<Pill tone={tone}>{text}</Pill>}
      hint={requiredAmount ? `Minimum required: ${requiredAmount}` : undefined}
    />
  );
}

function SafetyRatingPill({ value }: { value: string | null }) {
  const rating = readSafetyRating(value);
  switch (rating) {
    case "satisfactory":
      return <Pill tone="ok">Satisfactory</Pill>;
    case "conditional":
      return <Pill tone="warning">Conditional</Pill>;
    case "unsatisfactory":
      return <Pill tone="critical">Unsatisfactory</Pill>;
    case "not-rated":
      return <Pill tone="neutral">Not rated</Pill>;
  }
}

function Provenance({ record }: { record: CarrierRecord }) {
  const snapshot = formatDate(record.carrier.snapshotDate);
  return (
    <p className="text-xs text-muted">
      Source: FMCSA QCMobile API.
      {record.retrievalDate ? ` Retrieved ${record.retrievalDate}.` : ""}
      {snapshot ? ` Census snapshot dated ${snapshot}.` : ""} Responses are
      cached for one hour. This is a reference tool, not a substitute for a
      carrier packet, a certificate of insurance, or your own broker-carrier
      agreement.
    </p>
  );
}
