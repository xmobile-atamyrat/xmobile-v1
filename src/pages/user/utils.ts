export function passwordCheck(password: string): string {
  const hasNumber = /\d/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const shortPassword = password.length >= 8;

  let error;
  if (!hasSpecial) {
    error = 'hasSpecial';
  }
  if (!hasNumber) {
    error = 'hasDigit';
  }
  if (!hasUppercase) {
    error = 'hasUpperCase';
  }
  if (!shortPassword) {
    error = 'shortPassword';
  }

  return error;
}

export function emailCheck(email: string): string {
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  let error;
  if (!valid) {
    error = 'errorInvalidEmail';
  }
  if (!email) {
    error = 'errorEmailInput';
  }
  return error;
}
