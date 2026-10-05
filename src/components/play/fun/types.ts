/** مستوى اللعبة: ١ مبتدئ (رقم واحد) · ٢ متوسط (رقمان) · ٣ متقدم (ثلاثة أرقام). */
export type FunLevel = 1 | 2 | 3;

export interface FunGameProps {
  accent: string;
  accentDark: string;
  /** المستوى المختار؛ تستعمله كل الألعاب الثماني لتحديد حجم الأعداد. */
  level: FunLevel;
  /** تُستدعى عند إنهاء اللعبة بعدد النجوم (١–٣) وعدد الأخطاء. */
  onDone: (stars: 1 | 2 | 3, mistakes: number) => void;
}
