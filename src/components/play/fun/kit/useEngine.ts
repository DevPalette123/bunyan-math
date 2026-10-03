import { useEffect, useRef, useState } from "react";
import { playGameCorrectSound, playGameWrongSound } from "../../../../lib/playSounds";
import { starsFor, wait } from "../funUtils";
import type { Mood } from "./Critters";

type Key = string | number;

/**
 * محرّك الجولات المشترك لألعاب الاختيار: يدير الجولة الحالية والأخطاء والأصوات
 * والانتقال للجولة التالية، فتركّز كل لعبة على رسمها وحركتها فقط.
 */
export function useEngine({
  total,
  threeMax = 1,
  twoMax = 4,
  advanceMs = 1500,
  onDone,
}: {
  total: number;
  threeMax?: number;
  twoMax?: number;
  advanceMs?: number;
  onDone: (stars: 1 | 2 | 3, mistakes: number) => void;
}) {
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<"ask" | "right">("ask");
  const [picked, setPicked] = useState<Key | null>(null);
  const [wrongKey, setWrongKey] = useState<Key | null>(null);
  const [eliminated, setEliminated] = useState<Key[]>([]);
  const [burst, setBurst] = useState(0);
  const mistakes = useRef(0);
  const streak = useRef(0);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function answer(key: Key, ok: boolean) {
    if (lock.current) return;
    lock.current = true;
    if (!ok) {
      mistakes.current += 1;
      streak.current = 0;
      setWrongKey(key);
      playGameWrongSound();
      await wait(800);
      if (!alive.current) return;
      setEliminated((e) => [...e, key]);
      setWrongKey(null);
      lock.current = false;
      return;
    }
    streak.current += 1;
    setPicked(key);
    setPhase("right");
    setBurst((b) => b + 1);
    playGameCorrectSound(streak.current);
    await wait(advanceMs);
    if (!alive.current) return;
    if (i === total - 1) {
      onDone(starsFor(mistakes.current, threeMax, twoMax), mistakes.current);
      return;
    }
    setI(i + 1);
    setPhase("ask");
    setPicked(null);
    setEliminated([]);
    lock.current = false;
  }

  const mood: Mood = phase === "right" ? "happy" : wrongKey !== null ? "sad" : "idle";
  const stateOf = (key: Key): "idle" | "right" | "wrong" | "dim" =>
    picked === key ? "right" : wrongKey === key ? "wrong" : eliminated.includes(key) || phase === "right" ? "dim" : "idle";

  return { i, phase, picked, wrongKey, eliminated, burst, mood, answer, stateOf, mistakes };
}
