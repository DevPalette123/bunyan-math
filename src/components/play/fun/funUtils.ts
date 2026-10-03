export function rnd(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** n أعداد مختلفة من المولّد (مع حماية من الحلقة اللانهائية). */
export function uniq(n: number, gen: () => number, avoid: number[] = []): number[] {
  const s = new Set<number>();
  let guard = 0;
  while (s.size < n && guard++ < 500) {
    const v = gen();
    if (!avoid.includes(v)) s.add(v);
  }
  return [...s];
}

/** 3 نجوم لمن أخطأت قليلًا، ونجمة واحدة على الأقل لمن أكملت اللعبة. */
export function starsFor(mistakes: number, threeMax: number, twoMax: number): 1 | 2 | 3 {
  if (mistakes <= threeMax) return 3;
  if (mistakes <= twoMax) return 2;
  return 1;
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
