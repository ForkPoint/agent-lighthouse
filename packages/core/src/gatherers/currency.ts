/**
 * Active ISO 4217 currency codes.
 *
 * A list rather than `/^[A-Z]{3}$/` because the regular expression accepts XYZ,
 * BTC and every other three-letter string a CMS might emit. Four audits check a
 * currency — the commerce feed, the checkout mapping, the RSL licence and the
 * 402 price — so the list lives here rather than in whichever one grew it
 * first.
 */
export const ISO_4217: ReadonlySet<string> = new Set(
  ('AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD ' +
    'CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD ' +
    'GNF GTQ GYD HKD HNL HRK HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD ' +
    'KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK ' +
    'NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD ' +
    'SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD ' +
    'XOF XPF YER ZAR ZMW ZWG').split(' '),
);

/** Is this an active ISO 4217 code, compared case-sensitively as the standard writes them? */
export function isIso4217(code: string): boolean {
  return ISO_4217.has(code.trim());
}
