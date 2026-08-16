import type { FmcsaCarrier } from "./types";
import { asNumber } from "./parse";

/**
 * Turning a carrier record into flags.
 *
 * Every rule below reads named FMCSA fields and says which ones it read. That
 * is deliberate: a risk score whose derivation is hidden is worth nothing to
 * someone deciding whether to hand over a $40,000 load, and it is the first
 * thing an experienced broker will distrust. There is no weighting, no
 * proprietary index and no machine learning here — just the checks a
 * compliance department runs by hand, applied consistently.
 */

export type FlagSeverity = "critical" | "warning" | "info";

export interface RiskFlag {
  id: string;
  severity: FlagSeverity;
  title: string;
  detail: string;
  /** The API field(s) the rule read, shown in the UI so the check is auditable. */
  source: string;
}

export type Verdict = "blocked" | "caution" | "clear";

export interface RiskAssessment {
  verdict: Verdict;
  flags: RiskFlag[];
  criticalCount: number;
  warningCount: number;
}

/* -------------------------------------------------------------------------- */
/* Code normalisation                                                         */
/* -------------------------------------------------------------------------- */

/**
 * QCMobile sends some enumerations as single letters and some as words,
 * depending on the field and, occasionally, on the record. Everything is
 * upper-cased and trimmed before comparison rather than matched literally.
 */
function code(value: string | null): string {
  return (value ?? "").trim().toUpperCase();
}

export type AuthorityState = "active" | "inactive" | "none" | "unknown";

/**
 * Read one of the three authority status fields.
 *
 * Only `A` / `ACTIVE` counts as authorised. Every other value — inactive,
 * none, pending, revoked, or something FMCSA adds later — is treated as *not*
 * authorised, because the cost of being wrong is asymmetric: a broker who
 * tenders a load to a carrier without authority has no insurance behind it.
 */
export function readAuthority(value: string | null): AuthorityState {
  const c = code(value);
  if (c === "") return "unknown";
  if (c === "A" || c === "ACTIVE") return "active";
  if (c === "I" || c === "INACTIVE") return "inactive";
  if (c === "N" || c === "NONE" || c === "NOT AUTHORIZED") return "none";
  return "unknown";
}

export type SafetyRating =
  | "satisfactory"
  | "conditional"
  | "unsatisfactory"
  | "not-rated";

export function readSafetyRating(value: string | null): SafetyRating {
  const c = code(value);
  if (c === "S" || c === "SATISFACTORY") return "satisfactory";
  if (c === "C" || c === "CONDITIONAL") return "conditional";
  if (c === "U" || c === "UNSATISFACTORY" || c === "UNFIT") {
    return "unsatisfactory";
  }
  return "not-rated";
}

/** `Y`/`N` fields, where absent means unknown rather than no. */
function isYes(value: string | null): boolean {
  const c = code(value);
  return c === "Y" || c === "YES" || c === "TRUE";
}

function isNo(value: string | null): boolean {
  const c = code(value);
  return c === "N" || c === "NO" || c === "FALSE";
}

export type OperatingPermission = "allowed" | "not-allowed" | "unknown";

/**
 * Read the "allowed to operate" flag — the single field here whose *name* is
 * in doubt.
 *
 * FMCSA's API elements page documents it as `allowToOperate`; live responses
 * and independent third-party clients of the same API use `allowedToOperate`.
 * `parse.ts` reads both, and this function turns the result into three states
 * rather than two. The third one matters: if neither spelling is present, the
 * prohibited-carrier check has not run, and reporting that as "no problems
 * found" would be the worst failure this tool could have.
 */
export function readOperatingPermission(
  value: string | null,
): OperatingPermission {
  if (isNo(value)) return "not-allowed";
  if (isYes(value)) return "allowed";
  return "unknown";
}

/** Insurance "on file" fields are counts of filings, sent as strings. */
function filingCount(value: string | null): number | null {
  return asNumber(value);
}

/* -------------------------------------------------------------------------- */
/* Rules                                                                      */
/* -------------------------------------------------------------------------- */

export function assessCarrier(carrier: FmcsaCarrier): RiskAssessment {
  const flags: RiskFlag[] = [];

  /* --- Can it legally move freight at all? ------------------------------- */

  const permission = readOperatingPermission(carrier.allowedToOperate);

  if (permission === "not-allowed") {
    flags.push({
      id: "not-allowed-to-operate",
      severity: "critical",
      title: "Not allowed to operate",
      detail:
        "FMCSA records this carrier as not permitted to operate. Do not tender a load against this record.",
      source: "allowedToOperate",
    });
  } else if (permission === "unknown") {
    // Silence here is not a pass. If the field is absent under both spellings
    // the prohibited-carrier check never ran, and the reader has to be told
    // that rather than shown a report with one fewer flag on it.
    flags.push({
      id: "operating-status-unknown",
      severity: "warning",
      title: "Operating authority unknown",
      detail:
        "This record carries no allowed-to-operate value under either spelling FMCSA uses for the field, so the check for a prohibited carrier could not run. Absence of the flag is not evidence the carrier may operate — confirm it in SAFER before tendering a load.",
      source: "allowedToOperate, allowToOperate",
    });
  }

  if (carrier.oosDate) {
    flags.push({
      id: "out-of-service",
      severity: "critical",
      title: `Out of service since ${carrier.oosDate}`,
      detail:
        "An out-of-service order is in effect. The carrier may not operate until it is lifted.",
      source: "oosDate",
    });
  }

  if (code(carrier.statusCode) === "I") {
    flags.push({
      id: "inactive-registration",
      severity: "critical",
      title: "Registration inactive",
      detail:
        "The USDOT registration is inactive. This usually follows a failure to file the biennial MCS-150 update, but it can also mean the carrier has ceased operations.",
      source: "statusCode",
    });
  }

  /* --- Operating authority ------------------------------------------------ */

  const authorities = [
    readAuthority(carrier.commonAuthorityStatus),
    readAuthority(carrier.contractAuthorityStatus),
    readAuthority(carrier.brokerAuthorityStatus),
  ];
  const known = authorities.filter((state) => state !== "unknown");
  const anyActive = authorities.some((state) => state === "active");

  if (known.length > 0 && !anyActive) {
    flags.push({
      id: "no-active-authority",
      severity: "warning",
      title: "No active operating authority",
      detail:
        "Neither common, contract nor broker authority is active. An intrastate-only carrier can legitimately show this; an interstate for-hire carrier cannot.",
      source: "commonAuthorityStatus, contractAuthorityStatus, brokerAuthorityStatus",
    });
  }

  /* --- Insurance ---------------------------------------------------------- */

  const bipdOnFile = filingCount(carrier.bipdInsuranceOnFile);
  if (isYes(carrier.bipdInsuranceRequired) && bipdOnFile === 0) {
    flags.push({
      id: "no-bipd-insurance",
      severity: "critical",
      title: "No liability insurance on file",
      detail:
        "BIPD (bodily injury and property damage) insurance is required for this carrier and FMCSA holds no filing. Without it there is no authority to operate for hire.",
      source: "bipdInsuranceRequired, bipdInsuranceOnFile",
    });
  }

  const cargoOnFile = filingCount(carrier.cargoInsuranceOnFile);
  if (isYes(carrier.cargoInsuranceRequired) && cargoOnFile === 0) {
    flags.push({
      id: "no-cargo-insurance",
      severity: "warning",
      title: "No cargo insurance on file",
      detail:
        "Cargo insurance is required for this carrier and FMCSA holds no filing.",
      source: "cargoInsuranceRequired, cargoInsuranceOnFile",
    });
  }

  /* --- Safety rating ------------------------------------------------------ */

  const rating = readSafetyRating(carrier.safetyRating);
  if (rating === "unsatisfactory") {
    flags.push({
      id: "unsatisfactory-rating",
      severity: "critical",
      title: "Unsatisfactory safety rating",
      detail:
        "An unsatisfactory rating bars a carrier from transporting property in interstate commerce once it becomes final.",
      source: "safetyRating",
    });
  } else if (rating === "conditional") {
    flags.push({
      id: "conditional-rating",
      severity: "warning",
      title: "Conditional safety rating",
      detail:
        "A conditional rating means FMCSA found deficiencies at a compliance review. The carrier may still operate, but many shippers' insurance policies exclude conditional carriers.",
      source: "safetyRating",
    });
  } else if (rating === "not-rated") {
    flags.push({
      id: "not-rated",
      severity: "info",
      title: "No safety rating assigned",
      detail:
        "This is the normal state, not a warning. A rating is only issued after an on-site compliance review, and most carriers have never had one. Judge these carriers on inspection and crash history instead.",
      source: "safetyRating",
    });
  }

  /* --- Out-of-service rates versus the national average -------------------- */

  pushOosRateFlag(flags, {
    id: "driver-oos-above-average",
    label: "Driver",
    rate: carrier.driverOosRate,
    average: carrier.driverOosRateNationalAverage,
    inspections: carrier.driverInsp,
    source: "driverOosRate, driverOosRateNationalAverage",
  });

  pushOosRateFlag(flags, {
    id: "vehicle-oos-above-average",
    label: "Vehicle",
    rate: carrier.vehicleOosRate,
    average: carrier.vehicleOosRateNationalAverage,
    inspections: carrier.vehicleInsp,
    source: "vehicleOosRate, vehicleOosRateNationalAverage",
  });

  /* --- Crash history ------------------------------------------------------- */

  if ((carrier.fatalCrash ?? 0) > 0) {
    const n = carrier.fatalCrash ?? 0;
    flags.push({
      id: "fatal-crash",
      severity: "warning",
      title: `${n} fatal ${n === 1 ? "crash" : "crashes"} in the last 24 months`,
      detail:
        "Crash counts are not fault-adjusted — FMCSA records reportable crashes regardless of who caused them. Treat this as a prompt to ask, not a conclusion.",
      source: "fatalCrash",
    });
  }

  /* --- Data freshness ------------------------------------------------------ */

  if (isYes(carrier.mcs150Outdated)) {
    flags.push({
      id: "mcs150-outdated",
      severity: "warning",
      title: "MCS-150 census data is out of date",
      detail:
        "The carrier has not filed its biennial update. Fleet size, driver count and address on this record may be years old, and continued failure to file leads to deactivation.",
      source: "mcs150Outdated",
    });
  }

  const totalInspections =
    (carrier.driverInsp ?? 0) + (carrier.vehicleInsp ?? 0);
  if (totalInspections === 0) {
    flags.push({
      id: "no-inspection-history",
      severity: "info",
      title: "No inspections on record in the last 24 months",
      detail:
        "There is no on-road history to judge this carrier on. Common for a genuinely new carrier, and also what a reincarnated carrier looks like.",
      source: "driverInsp, vehicleInsp",
    });
  }

  const criticalCount = flags.filter((f) => f.severity === "critical").length;
  const warningCount = flags.filter((f) => f.severity === "warning").length;

  return {
    verdict:
      criticalCount > 0 ? "blocked" : warningCount > 0 ? "caution" : "clear",
    flags,
    criticalCount,
    warningCount,
  };
}

interface OosRateInput {
  id: string;
  label: string;
  rate: number | null;
  average: number | null;
  inspections: number | null;
  source: string;
}

/**
 * Compare an out-of-service rate against the national average.
 *
 * Guarded by a minimum inspection count. A carrier with two inspections and
 * one out-of-service order has a 50% rate, which is arithmetically true and
 * analytically meaningless; flagging it trains the reader to ignore the flags.
 */
function pushOosRateFlag(flags: RiskFlag[], input: OosRateInput): void {
  const MIN_INSPECTIONS = 5;
  const { rate, average, inspections } = input;

  if (rate === null || average === null) return;
  if ((inspections ?? 0) < MIN_INSPECTIONS) return;
  if (rate <= average) return;

  flags.push({
    id: input.id,
    severity: "warning",
    title: `${input.label} out-of-service rate ${formatPercent(rate)} vs ${formatPercent(average)} national average`,
    detail: `${input.inspections} ${input.label.toLowerCase()} inspections in the last 24 months. A rate above the national average is what triggers FMCSA's own intervention thresholds.`,
    source: input.source,
  });
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
