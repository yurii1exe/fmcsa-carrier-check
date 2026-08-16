/**
 * Typed view of the QCMobile API.
 *
 * Field names below are the API's own (`bipdInsuranceOnFile`, `driverOosInsp`,
 * `towawayCrash`), not renamed, so that anything in this file can be checked
 * against a live response without a translation step.
 *
 * The API is loosely typed on the wire: counts arrive sometimes as numbers and
 * sometimes as numeric strings, and several fields are `null` for most
 * carriers. Everything here is therefore parsed defensively in `parse.ts`
 * rather than trusted — see the tests for the shapes that have to survive.
 */

/**
 * Every QCMobile response is wrapped in this envelope.
 *
 * `content` is deliberately `unknown`: on an authentication failure the API
 * puts a **string** here (`"Webkey not found"`) rather than an object, and it
 * does so under an HTTP 404. Typing it as the success shape would make that
 * case a runtime crash instead of an error message.
 */
export interface QcEnvelope {
  content?: unknown;
  retrievalDate?: unknown;
  _links?: unknown;
}

/** Codes describe the geography of a carrier's operation; the API ships the prose with it. */
export interface CarrierOperation {
  carrierOperationCode: string | null;
  carrierOperationDesc: string | null;
}

export interface CensusType {
  censusType: string | null;
  censusTypeDesc: string | null;
  censusTypeId: number | null;
}

/** The carrier record, as returned by `/carriers/{dot}` and friends. */
export interface FmcsaCarrier {
  dotNumber: number | null;
  legalName: string | null;
  dbaName: string | null;

  // Operating status. `allowedToOperate` is the spelling live responses and
  // third-party clients use; FMCSA's API elements page spells the same field
  // `allowToOperate`. Both are read in `parse.ts` and land here, and neither
  // being present is a state `risk.ts` reports rather than swallows.
  allowedToOperate: string | null;
  statusCode: string | null;
  oosDate: string | null;

  // Authority
  commonAuthorityStatus: string | null;
  contractAuthorityStatus: string | null;
  brokerAuthorityStatus: string | null;

  // Insurance filings. These are counts of filings on record, not proof of
  // current coverage, and they are counts expressed as strings on the wire.
  bipdInsuranceOnFile: string | null;
  bipdInsuranceRequired: string | null;
  bipdRequiredAmount: string | null;
  cargoInsuranceOnFile: string | null;
  cargoInsuranceRequired: string | null;
  bondInsuranceOnFile: string | null;
  bondInsuranceRequired: string | null;

  // Safety rating. Null for the large majority of carriers — see risk.ts.
  safetyRating: string | null;
  safetyRatingDate: string | null;
  reviewDate: string | null;
  reviewType: string | null;

  // Crash history, 24 months, US only
  crashTotal: number | null;
  fatalCrash: number | null;
  injCrash: number | null;
  towawayCrash: number | null;

  // Inspection and out-of-service history, 24 months
  driverInsp: number | null;
  driverOosInsp: number | null;
  driverOosRate: number | null;
  driverOosRateNationalAverage: number | null;
  vehicleInsp: number | null;
  vehicleOosInsp: number | null;
  vehicleOosRate: number | null;
  vehicleOosRateNationalAverage: number | null;
  hazmatInsp: number | null;
  hazmatOosInsp: number | null;
  hazmatOosRate: number | null;
  hazmatOosRateNationalAverage: number | null;
  oosRateNationalAverageYear: string | null;

  // Size and profile
  totalPowerUnits: number | null;
  totalDrivers: number | null;
  carrierOperation: CarrierOperation | null;
  censusTypeId: CensusType | null;
  isPassengerCarrier: string | null;
  mcs150Outdated: string | null;
  snapshotDate: string | null;

  // Address
  phyStreet: string | null;
  phyCity: string | null;
  phyState: string | null;
  /** `phyZip` on FMCSA's API elements page; both spellings are read. */
  phyZipcode: string | null;
  phyCountry: string | null;
}

/** A carrier plus the metadata about when FMCSA served it. */
export interface CarrierRecord {
  carrier: FmcsaCarrier;
  /** ISO timestamp the API reported for the response, when it sent one. */
  retrievalDate: string | null;
}
