/**
 * Synthetic QCMobile responses.
 *
 * These are hand-built to the field names and shapes documented at
 * mobile.fmcsa.dot.gov/QCDevsite, not captured from live traffic, and the
 * carrier details in them are invented. They exist to pin down how the parser
 * behaves against the *shapes* the API uses — the envelope, the string-encoded
 * counts, the nulls — and no number in this file should be read as a fact
 * about any real carrier.
 *
 * The one exception is `webkeyNotFound`, which is a verbatim copy of a real
 * response body observed on 2026-08-15 by sending a junk webKey. It is
 * reproduced because its exact shape is the whole point: an authentication
 * failure arrives as an HTTP 404 with a string where the data should be.
 */

export const webkeyNotFound = {
  content: "Webkey not found",
  retrievalDate: "2026-08-15T21:50:59.319+0000",
  _links: {
    self: { href: "https://mobile.fmcsa.dot.gov/qc" },
  },
};

/** A carrier with active authority, insurance on file and clean history. */
export const healthyCarrier = {
  content: {
    carrier: {
      allowedToOperate: "Y",
      statusCode: "A",
      oosDate: null,
      dotNumber: 1000001,
      legalName: "EXAMPLE FREIGHT LLC",
      dbaName: null,
      commonAuthorityStatus: "A",
      contractAuthorityStatus: "A",
      brokerAuthorityStatus: "N",
      bipdInsuranceOnFile: "1",
      bipdInsuranceRequired: "Y",
      bipdRequiredAmount: "750",
      cargoInsuranceOnFile: "1",
      cargoInsuranceRequired: "Y",
      bondInsuranceOnFile: "0",
      bondInsuranceRequired: "N",
      safetyRating: "S",
      safetyRatingDate: "2023-04-12",
      reviewDate: "2023-04-12",
      reviewType: "C",
      crashTotal: 0,
      fatalCrash: 0,
      injCrash: 0,
      towawayCrash: 0,
      driverInsp: 24,
      driverOosInsp: 1,
      driverOosRate: 4.16,
      driverOosRateNationalAverage: "6.72",
      vehicleInsp: 18,
      vehicleOosInsp: 2,
      vehicleOosRate: 11.11,
      vehicleOosRateNationalAverage: "22.05",
      hazmatInsp: 0,
      hazmatOosInsp: 0,
      hazmatOosRate: 0,
      hazmatOosRateNationalAverage: "4.5",
      oosRateNationalAverageYear: "2009-2010",
      totalPowerUnits: 12,
      totalDrivers: 14,
      carrierOperation: {
        carrierOperationCode: "A",
        carrierOperationDesc: "Interstate",
      },
      censusTypeId: {
        censusType: "C",
        censusTypeDesc: "CARRIER",
        censusTypeId: 1,
      },
      isPassengerCarrier: "N",
      mcs150Outdated: "N",
      snapshotDate: "2026-07-01",
      phyStreet: "1 EXAMPLE WAY",
      phyCity: "CHICAGO",
      phyState: "IL",
      phyZipcode: "60601",
      phyCountry: "US",
      issScore: null,
      ein: 123456789,
    },
  },
  retrievalDate: "2026-08-15T12:00:00.000+0000",
};

/** Everything that should trip a critical flag, in one record. */
export const troubledCarrier = {
  content: {
    carrier: {
      allowedToOperate: "N",
      statusCode: "I",
      oosDate: "2026-02-11",
      dotNumber: 1000002,
      legalName: "EXAMPLE SUSPENDED CARRIER INC",
      commonAuthorityStatus: "I",
      contractAuthorityStatus: "N",
      brokerAuthorityStatus: "N",
      bipdInsuranceOnFile: "0",
      bipdInsuranceRequired: "Y",
      cargoInsuranceOnFile: "0",
      cargoInsuranceRequired: "Y",
      safetyRating: "U",
      crashTotal: 4,
      fatalCrash: 1,
      injCrash: 2,
      towawayCrash: 1,
      driverInsp: 30,
      driverOosInsp: 9,
      driverOosRate: 30,
      driverOosRateNationalAverage: "6.72",
      vehicleInsp: 40,
      vehicleOosInsp: 20,
      vehicleOosRate: 50,
      vehicleOosRateNationalAverage: "22.05",
      mcs150Outdated: "Y",
      totalPowerUnits: 3,
      totalDrivers: 3,
    },
  },
  retrievalDate: "2026-08-15T12:00:00.000+0000",
};

/**
 * The sparse record most small carriers actually produce: no rating, no
 * inspections, most optional fields null or absent entirely.
 */
export const sparseCarrier = {
  content: {
    carrier: {
      dotNumber: 1000003,
      legalName: "EXAMPLE NEW ENTRANT LLC",
      allowedToOperate: "Y",
      statusCode: "A",
      commonAuthorityStatus: "A",
      contractAuthorityStatus: "N",
      brokerAuthorityStatus: "N",
      bipdInsuranceOnFile: "1",
      bipdInsuranceRequired: "Y",
      cargoInsuranceOnFile: null,
      cargoInsuranceRequired: "N",
      safetyRating: null,
      crashTotal: null,
      driverInsp: 0,
      vehicleInsp: 0,
      carrierOperation: null,
    },
  },
};

/** `/carriers/docket-number/{n}` answers with an array under `content`. */
export const docketLookup = {
  content: [
    { carrier: healthyCarrier.content.carrier },
    { carrier: sparseCarrier.content.carrier },
  ],
  retrievalDate: "2026-08-15T12:00:00.000+0000",
};

/** A well-formed number that belongs to nobody. */
export const emptyContent = {
  content: null,
  retrievalDate: "2026-08-15T12:00:00.000+0000",
};
