import { toArabicDigits } from "./arabicNumerals";

/** "منذ ٥ دقائق" / "منذ ساعتين" / "أمس" / "منذ ٣ أيام" — from a real ISO timestamp. */
export function formatRelativeArabicTime(isoTimestamp: string): string {
  const then = new Date(isoTimestamp).getTime();
  const now = Date.now();
  const diffSeconds = Math.max(0, Math.floor((now - then) / 1000));

  const minute = 60;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffSeconds < minute) return "الآن";
  if (diffSeconds < hour) {
    const minutes = Math.floor(diffSeconds / minute);
    return minutes === 1 ? "منذ دقيقة" : minutes === 2 ? "منذ دقيقتين" : `منذ ${toArabicDigits(minutes)} دقائق`;
  }
  if (diffSeconds < day) {
    const hours = Math.floor(diffSeconds / hour);
    return hours === 1 ? "منذ ساعة" : hours === 2 ? "منذ ساعتين" : `منذ ${toArabicDigits(hours)} ساعات`;
  }
  const days = Math.floor(diffSeconds / day);
  if (days === 1) return "أمس";
  if (days === 2) return "منذ يومين";
  return `منذ ${toArabicDigits(days)} أيام`;
}
