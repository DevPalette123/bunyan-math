export interface FunGameProps {
  accent: string;
  accentDark: string;
  /** تُستدعى عند إنهاء اللعبة بعدد النجوم (١–٣) وعدد الأخطاء. */
  onDone: (stars: 1 | 2 | 3, mistakes: number) => void;
}
