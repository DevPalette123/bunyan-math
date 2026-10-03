const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/**
 * Converts any Latin digits found in a number or string to Arabic-Indic
 * numerals (٠-٩), leaving all other characters untouched.
 */
export function toArabicDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (digit) => ARABIC_DIGITS[Number(digit)]);
}
