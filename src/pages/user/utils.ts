export function passwordCheck(password: string) {
  const hasNumber = /\d/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const shortPassword = password.length >= 8;
  const hasConsecutiveLetters = /[a-zA-Z]{4,}/.test(password);
  const hasConsecutiveDigits = /\d{4,}/.test(password);

  const hasConsecutiveAlphaNumeric =
    !hasConsecutiveLetters && !hasConsecutiveDigits;

  if (!shortPassword) {
    return 'shortPassword';
  }
  if (!hasConsecutiveAlphaNumeric) {
    return 'hasConsecutiveAlphaNumeric';
  }
  if (!hasUppercase) {
    return 'hasUpperCase';
  }
  if (!hasNumber) {
    return 'hasNumber';
  }
  if (!hasSpecial) {
    return 'hasSpecial';
  }
  return '';
}

export function emailCheck(email: string): string {
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (email === '') {
    return 'errorEmailInput';
  }
  if (!valid) {
    return 'errorInvalidEmail';
  }
  return '';
}
