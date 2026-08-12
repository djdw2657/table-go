// Shared between the client form (real-time validation) and the server
// action (defense-in-depth re-validation), so the two never drift apart.

const NAME_PATTERN = /^[가-힣a-zA-Z\s]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidName(name: string) {
  const trimmed = name.trim();
  return trimmed.length >= 2 && NAME_PATTERN.test(trimmed);
}

export function isValidPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 11;
}

// Email is optional, so only invalid if non-empty and malformed.
export function isValidEmail(email: string) {
  const trimmed = email.trim();
  return trimmed === "" || EMAIL_PATTERN.test(trimmed);
}

export function normalizePhoneDigits(phone: string) {
  return phone.replace(/\D/g, "");
}

export function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) {
    return digits;
  }
  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  if (digits.length <= 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export const NAME_ERROR = "이름은 한글 또는 영문으로 2자 이상 입력해주세요.";
export const PHONE_ERROR = "올바른 전화번호 형식이 아닙니다.";
export const EMAIL_ERROR = "올바른 이메일 형식이 아닙니다.";
