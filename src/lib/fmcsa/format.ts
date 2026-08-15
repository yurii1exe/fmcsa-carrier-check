import type { FmcsaCarrier } from "./types";
import type { AuthorityState } from "./risk";

/** Display helpers. Pure, so they are safe in both server and client components. */

/**
 * FMCSA dates arrive in more than one shape depending on the field —
 * `2019-05-14`, `05/14/2019`, and full ISO timestamps all occur. Anything that
 * does not parse is passed through unchanged rather than replaced with
 * "Invalid Date", because the raw value is still information.
 */
export function formatDate(value: string | null): string | null {
  if (!value) return null;

  const isoDayOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (isoDayOnly) {
    const [, year, month, day] = isoDayOnly;
    return `${month}/${day}/${year}`;
  }

  const usDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (usDate) {
    const [, m, d, y] = usDate;
    return `${m.padStart(2, "0")}/${d.padStart(2, "0")}/${y}`;
  }

  return value;
}

export function carrierName(carrier: FmcsaCarrier): string {
  return carrier.legalName ?? carrier.dbaName ?? "Unnamed carrier";
}

export function formatAddress(carrier: FmcsaCarrier): string | null {
  const cityLine = [carrier.phyCity, carrier.phyState].filter(Boolean).join(", ");
  const parts = [
    carrier.phyStreet,
    [cityLine, carrier.phyZipcode].filter(Boolean).join(" "),
    carrier.phyCountry && carrier.phyCountry !== "US" ? carrier.phyCountry : null,
  ].filter((part): part is string => Boolean(part && part.trim().length > 0));

  return parts.length > 0 ? parts.join(", ") : null;
}

export function authorityLabel(state: AuthorityState): string {
  switch (state) {
    case "active":
      return "Active";
    case "inactive":
      return "Inactive";
    case "none":
      return "None on file";
    case "unknown":
      return "Not reported";
  }
}

/** `1,234` rather than `1234`, and an em dash for absent counts. */
export function formatCount(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("en-US");
}

export function formatRate(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

/**
 * `bipdRequiredAmount` arrives as a bare number of dollars in a string, e.g.
 * `"750000"`. Rendered as currency it is immediately readable as the familiar
 * $750,000 minimum; left raw it is a wall of digits.
 */
export function formatDollars(value: string | null): string | null {
  if (!value) return null;
  const amount = Number(value.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return value;
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
