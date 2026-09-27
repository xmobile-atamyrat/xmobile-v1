export type PhoneCountry = {
  code: 'TM' | 'TR';
  dial: string;
  localLength: number;
  trunkPrefix: string;
  pattern: RegExp;
  example: string;
  flag: string;
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  {
    code: 'TM',
    dial: '+993',
    localLength: 8,
    trunkPrefix: '8',
    pattern: /^[1-7]\d{7}$/,
    example: '61234567',
    flag: '/flags/Turkmenistan.png',
  },
  {
    code: 'TR',
    dial: '+90',
    localLength: 10,
    trunkPrefix: '0',
    pattern: /^[2-5]\d{9}$/,
    example: '5321234567',
    flag: '/flags/Turkey.png',
  },
];

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0];

export const MAX_INTERNATIONAL_DIGITS = Math.max(
  ...PHONE_COUNTRIES.map((c) => c.dial.length - 1 + c.localLength),
);

export const getPhoneCountry = (code: string): PhoneCountry =>
  PHONE_COUNTRIES.find((c) => c.code === code) ?? DEFAULT_PHONE_COUNTRY;

// Accepts the international form ("+993 6X XXXXXX"), the domestic trunk form
// ("8 6X XXXXXX", "0 5XX…") or bare local digits, and returns just the local
// part (unvalidated).
export const toLocalDigits = (raw: string, country: PhoneCountry): string => {
  const digits = raw.replace(/\D/g, '');
  const dialDigits = country.dial.slice(1);
  if (
    digits.length === dialDigits.length + country.localLength &&
    digits.startsWith(dialDigits)
  ) {
    return digits.slice(dialDigits.length);
  }
  if (
    digits.length === country.trunkPrefix.length + country.localLength &&
    digits.startsWith(country.trunkPrefix)
  ) {
    return digits.slice(country.trunkPrefix.length);
  }
  return digits;
};

export const isValidLocalNumber = (
  local: string,
  country: PhoneCountry,
): boolean => country.pattern.test(local);

export const detectPhoneCountry = (raw: string): PhoneCountry | null =>
  PHONE_COUNTRIES.find((c) => isValidLocalNumber(toLocalDigits(raw, c), c)) ??
  null;

export const normalizePhone = (raw: string): string | null => {
  const country = detectPhoneCountry(raw);
  return country ? `${country.dial}${toLocalDigits(raw, country)}` : null;
};
