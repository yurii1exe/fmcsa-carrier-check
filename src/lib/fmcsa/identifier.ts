/**
 * Parsing of the thing a broker actually types into the box.
 *
 * In practice that is one of: `4581509`, `USDOT 4581509`, `DOT-4581509`,
 * `MC-1515020`, `MC 1515020`, `mx123456`. The FMCSA API wants bare digits and a
 * different endpoint depending on which kind of number it is, so the input has
 * to be classified before anything is fetched.
 */

/** Which FMCSA endpoint a parsed identifier should be sent to. */
export type CarrierIdKind = "dot" | "docket";

export interface CarrierId {
  kind: CarrierIdKind;
  /** Bare digits, leading zeros removed — what the API path wants. */
  value: string;
  /** The docket prefix the user typed (MC/MX/FF), preserved for display. */
  docketPrefix?: "MC" | "MX" | "FF";
  /** Canonical form for display and for the shareable URL, e.g. `MC-1515020`. */
  display: string;
}

export type IdentifierProblem =
  | "empty"
  | "no-digits"
  | "too-long"
  | "not-a-number";

export type ParseIdentifierResult =
  | { ok: true; id: CarrierId }
  | { ok: false; problem: IdentifierProblem; message: string };

/**
 * USDOT numbers are currently 7 digits and climbing; docket numbers are up to
 * 7. Eight is a generous ceiling that still rejects a pasted phone number or
 * tracking number, which is the realistic bad input.
 */
const MAX_DIGITS = 8;

const DOCKET_PREFIXES = ["MC", "MX", "FF"] as const;

/**
 * Classify and normalise a raw search string.
 *
 * A bare number is treated as a USDOT number. That is the convention every
 * carrier packet and load board follows, and it means the common case needs no
 * prefix. An MC/MX/FF prefix is required to look a carrier up by docket.
 */
export function parseCarrierIdentifier(raw: string): ParseIdentifierResult {
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return {
      ok: false,
      problem: "empty",
      message: "Enter a USDOT number, or an MC number with the MC prefix.",
    };
  }

  const upper = trimmed.toUpperCase();

  const docketPrefix = DOCKET_PREFIXES.find((prefix) =>
    // `MC-1515020`, `MC 1515020` and `MC1515020` all count; `MCLANE` does not,
    // because what follows the prefix has to start with a digit.
    new RegExp(`^${prefix}[\\s\\-#]*\\d`).test(upper),
  );

  const body = docketPrefix
    ? upper.slice(docketPrefix.length)
    : stripDotPrefix(upper);

  const digits = body.replace(/[\s\-#.,]/g, "");

  if (digits.length === 0) {
    return {
      ok: false,
      problem: "no-digits",
      message: "That does not contain a number. Try a USDOT number like 4581509.",
    };
  }

  if (!/^\d+$/.test(digits)) {
    return {
      ok: false,
      problem: "not-a-number",
      message:
        "Only digits are allowed, optionally after a USDOT or MC prefix. Carrier name search is not supported yet.",
    };
  }

  const normalised = stripLeadingZeros(digits);

  if (normalised.length > MAX_DIGITS) {
    return {
      ok: false,
      problem: "too-long",
      message: `A USDOT or MC number is at most ${MAX_DIGITS} digits. That looks like something else.`,
    };
  }

  if (docketPrefix) {
    return {
      ok: true,
      id: {
        kind: "docket",
        value: normalised,
        docketPrefix,
        display: `${docketPrefix}-${normalised}`,
      },
    };
  }

  return {
    ok: true,
    id: { kind: "dot", value: normalised, display: `USDOT ${normalised}` },
  };
}

/** `USDOT 123`, `US DOT 123`, `DOT-123` and `#123` all mean the same thing. */
function stripDotPrefix(upper: string): string {
  return upper.replace(/^(US\s*DOT|USDOT|DOT)[\s\-#:]*/, "");
}

function stripLeadingZeros(digits: string): string {
  const stripped = digits.replace(/^0+/, "");
  // `0` and `0000` both normalise to empty; keep a single zero so the caller
  // gets a `not found` from the API rather than a malformed request URL.
  return stripped.length > 0 ? stripped : "0";
}
