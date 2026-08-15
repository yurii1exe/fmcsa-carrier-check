/**
 * Runtime narrowing of QCMobile responses.
 *
 * Nothing from the network is trusted here. The API answers with
 * `application/hal+json` and its own envelope, its counts are inconsistently
 * numbers or numeric strings, most optional fields are `null`, and — the case
 * that matters most — an authentication failure arrives as an HTTP 404 whose
 * `content` is a plain string rather than an object.
 *
 * These functions take `unknown` and return either a typed record or `null`.
 * They are the most heavily tested part of the codebase because they are the
 * only place a change at FMCSA can break the app silently.
 */

import type {
  CarrierOperation,
  CarrierRecord,
  CensusType,
  FmcsaCarrier,
  QcEnvelope,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Scalar coercion                                                            */
/* -------------------------------------------------------------------------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A string, or null. Empty and whitespace-only strings become null. */
export function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

/**
 * A finite number, or null. Accepts numeric strings because the API sends
 * counts both ways, and accepts a percent sign because the OOS national
 * average fields arrive as `"5.51"` in some responses and `"5.51%"` in others.
 */
export function asNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const cleaned = value.trim().replace(/%$/, "").replace(/,/g, "");
    if (cleaned.length === 0) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** An integer count, or null. Non-integers are floored rather than discarded. */
export function asInt(value: unknown): number | null {
  const n = asNumber(value);
  return n === null ? null : Math.trunc(n);
}

/* -------------------------------------------------------------------------- */
/* Envelope                                                                   */
/* -------------------------------------------------------------------------- */

export interface EnvelopeView {
  content: unknown;
  retrievalDate: string | null;
  /**
   * Set when the API put a bare string in `content` instead of data. That is
   * how it reports `"Webkey not found"`, and it does so under an HTTP 404, so
   * the status code alone cannot tell an auth failure from a missing carrier.
   */
  contentMessage: string | null;
}

export function readEnvelope(body: unknown): EnvelopeView | null {
  if (!isRecord(body)) return null;
  const envelope = body as QcEnvelope;
  const content = envelope.content ?? null;
  return {
    content,
    retrievalDate: asString(envelope.retrievalDate),
    contentMessage: typeof content === "string" ? content : null,
  };
}

/**
 * Does this envelope message mean "your credential is bad" rather than
 * "no such carrier"?
 *
 * Verified against the live API on 2026-08-15: a request with a junk webKey
 * returns HTTP 404 and `{"content":"Webkey not found", ...}`. Matching on the
 * word rather than the exact sentence, because the exact sentence is not part
 * of any contract.
 */
export function isAuthFailureMessage(message: string | null): boolean {
  if (!message) return false;
  return /webkey|web key|not authorized|unauthorized|api key/i.test(message);
}

/* -------------------------------------------------------------------------- */
/* Carrier                                                                    */
/* -------------------------------------------------------------------------- */

function parseCarrierOperation(value: unknown): CarrierOperation | null {
  if (!isRecord(value)) return null;
  const code = asString(value.carrierOperationCode);
  const desc = asString(value.carrierOperationDesc);
  if (code === null && desc === null) return null;
  return { carrierOperationCode: code, carrierOperationDesc: desc };
}

function parseCensusType(value: unknown): CensusType | null {
  if (!isRecord(value)) return null;
  const censusType = asString(value.censusType);
  const censusTypeDesc = asString(value.censusTypeDesc);
  const censusTypeId = asInt(value.censusTypeId);
  if (censusType === null && censusTypeDesc === null && censusTypeId === null) {
    return null;
  }
  return { censusType, censusTypeDesc, censusTypeId };
}

/**
 * Narrow an object to a carrier.
 *
 * A record with neither a DOT number nor a legal name is rejected: those are
 * the two fields that are always present on a real carrier, so their joint
 * absence means the shape is wrong rather than the data being sparse.
 */
export function parseCarrier(value: unknown): FmcsaCarrier | null {
  if (!isRecord(value)) return null;

  const dotNumber = asInt(value.dotNumber);
  const legalName = asString(value.legalName);
  if (dotNumber === null && legalName === null) return null;

  return {
    dotNumber,
    legalName,
    dbaName: asString(value.dbaName),

    allowedToOperate: asString(value.allowedToOperate),
    statusCode: asString(value.statusCode),
    oosDate: asString(value.oosDate),

    commonAuthorityStatus: asString(value.commonAuthorityStatus),
    contractAuthorityStatus: asString(value.contractAuthorityStatus),
    brokerAuthorityStatus: asString(value.brokerAuthorityStatus),

    bipdInsuranceOnFile: asString(value.bipdInsuranceOnFile),
    bipdInsuranceRequired: asString(value.bipdInsuranceRequired),
    bipdRequiredAmount: asString(value.bipdRequiredAmount),
    cargoInsuranceOnFile: asString(value.cargoInsuranceOnFile),
    cargoInsuranceRequired: asString(value.cargoInsuranceRequired),
    bondInsuranceOnFile: asString(value.bondInsuranceOnFile),
    bondInsuranceRequired: asString(value.bondInsuranceRequired),

    safetyRating: asString(value.safetyRating),
    safetyRatingDate: asString(value.safetyRatingDate),
    reviewDate: asString(value.reviewDate),
    reviewType: asString(value.reviewType),

    crashTotal: asInt(value.crashTotal),
    fatalCrash: asInt(value.fatalCrash),
    injCrash: asInt(value.injCrash),
    towawayCrash: asInt(value.towawayCrash),

    driverInsp: asInt(value.driverInsp),
    driverOosInsp: asInt(value.driverOosInsp),
    driverOosRate: asNumber(value.driverOosRate),
    driverOosRateNationalAverage: asNumber(value.driverOosRateNationalAverage),
    vehicleInsp: asInt(value.vehicleInsp),
    vehicleOosInsp: asInt(value.vehicleOosInsp),
    vehicleOosRate: asNumber(value.vehicleOosRate),
    vehicleOosRateNationalAverage: asNumber(value.vehicleOosRateNationalAverage),
    hazmatInsp: asInt(value.hazmatInsp),
    hazmatOosInsp: asInt(value.hazmatOosInsp),
    hazmatOosRate: asNumber(value.hazmatOosRate),
    hazmatOosRateNationalAverage: asNumber(value.hazmatOosRateNationalAverage),
    oosRateNationalAverageYear: asString(value.oosRateNationalAverageYear),

    totalPowerUnits: asInt(value.totalPowerUnits),
    totalDrivers: asInt(value.totalDrivers),
    carrierOperation: parseCarrierOperation(value.carrierOperation),
    censusTypeId: parseCensusType(value.censusTypeId),
    isPassengerCarrier: asString(value.isPassengerCarrier),
    mcs150Outdated: asString(value.mcs150Outdated),
    snapshotDate: asString(value.snapshotDate),

    phyStreet: asString(value.phyStreet),
    phyCity: asString(value.phyCity),
    phyState: asString(value.phyState),
    phyZipcode: asString(value.phyZipcode),
    phyCountry: asString(value.phyCountry),
  };
}

/**
 * Pull carriers out of a parsed envelope.
 *
 * `/carriers/{dot}` puts one `{ carrier: {...} }` in `content`.
 * `/carriers/docket-number/{n}` puts an array of them there, because one
 * docket number can be attached to more than one DOT number. Both shapes are
 * handled, and a bare carrier object without the `carrier` wrapper is accepted
 * too so that a shape change at FMCSA degrades instead of breaking.
 */
export function extractCarriers(content: unknown): FmcsaCarrier[] {
  if (content === null || content === undefined) return [];

  if (Array.isArray(content)) {
    return content.flatMap((item) => extractCarriers(item));
  }

  if (!isRecord(content)) return [];

  if ("carrier" in content) {
    const carrier = parseCarrier(content.carrier);
    return carrier ? [carrier] : [];
  }

  const carrier = parseCarrier(content);
  return carrier ? [carrier] : [];
}

/** Convenience: envelope in, first carrier record out. */
export function toCarrierRecord(envelope: EnvelopeView): CarrierRecord | null {
  const [carrier] = extractCarriers(envelope.content);
  if (!carrier) return null;
  return { carrier, retrievalDate: envelope.retrievalDate };
}
