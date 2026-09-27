import {
  detectPhoneCountry,
  getPhoneCountry,
  isValidLocalNumber,
  normalizePhone,
  toLocalDigits,
} from '@/pages/lib/phone';
import { describe, expect, it } from 'vitest';

const TM = getPhoneCountry('TM');
const TR = getPhoneCountry('TR');

describe('toLocalDigits', () => {
  it('strips the country code and formatting', () => {
    expect(toLocalDigits('+993 61 23-45-67', TM)).toBe('61234567');
    expect(toLocalDigits('+90 (532) 123 45 67', TR)).toBe('5321234567');
  });

  it('strips the domestic trunk prefix', () => {
    expect(toLocalDigits('8 (61) 234567', TM)).toBe('61234567');
    expect(toLocalDigits('0532 123 45 67', TR)).toBe('5321234567');
  });

  it('keeps bare local digits and drops letters', () => {
    expect(toLocalDigits('61234567', TM)).toBe('61234567');
    expect(toLocalDigits('Test', TM)).toBe('');
  });
});

describe('isValidLocalNumber', () => {
  it('accepts a full-length number with a valid leading digit', () => {
    expect(isValidLocalNumber('61234567', TM)).toBe(true);
    expect(isValidLocalNumber('12345678', TM)).toBe(true);
    expect(isValidLocalNumber('5321234567', TR)).toBe(true);
    expect(isValidLocalNumber('2121234567', TR)).toBe(true);
  });

  it('rejects wrong length or leading digit', () => {
    expect(isValidLocalNumber('6123456', TM)).toBe(false);
    expect(isValidLocalNumber('81234567', TM)).toBe(false);
    expect(isValidLocalNumber('532123456', TR)).toBe(false);
    expect(isValidLocalNumber('9321234567', TR)).toBe(false);
  });
});

describe('detectPhoneCountry', () => {
  it('picks the country the number belongs to', () => {
    expect(detectPhoneCountry('+99361234567')?.code).toBe('TM');
    expect(detectPhoneCountry('+905321234567')?.code).toBe('TR');
    expect(detectPhoneCountry('+7 916 123 45 67')).toBeNull();
  });
});

describe('normalizePhone', () => {
  it('returns the international form for valid input', () => {
    expect(normalizePhone('8 61 234567')).toBe('+99361234567');
    expect(normalizePhone('+993 71 21 17 17')).toBe('+99371211717');
    expect(normalizePhone('0532 123 45 67')).toBe('+905321234567');
  });

  it('returns null for junk', () => {
    expect(normalizePhone('Test')).toBeNull();
    expect(normalizePhone('+123')).toBeNull();
  });
});
