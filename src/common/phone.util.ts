/** Persian (۰-۹) and Arabic-Indic (٠-٩) digits → ASCII 0-9. */
export function toEnglishDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (code >= 0x06f0 && code <= 0x06f9) {
      return String(code - 0x06f0);
    }
    if (code >= 0x0660 && code <= 0x0669) {
      return String(code - 0x0660);
    }
    return ch;
  });
}

/** Normalize Iranian mobile numbers to 09xxxxxxxxx. */
export function normalizeIranPhone(phone: string): string {
  const digits = toEnglishDigits(phone).replace(/[\s\-()]/g, '');
  let normalized = digits;

  if (normalized.startsWith('+98')) {
    normalized = '0' + normalized.slice(3);
  } else if (normalized.startsWith('98') && normalized.length === 12) {
    normalized = '0' + normalized.slice(2);
  } else if (normalized.startsWith('9') && normalized.length === 10) {
    normalized = '0' + normalized;
  }

  return normalized;
}

export function generateOtpCode(length: number): string {
  const max = 10 ** length;
  const num = Math.floor(Math.random() * max);
  return num.toString().padStart(length, '0');
}
