// Short interactive sound effects for "اكتشف" — correct/wrong feedback only.
// No text-to-speech, no external audio files or services, no autoplay: every
// function here is only ever called from inside a real tap handler, right
// after the student's answer is confirmed saved.
//
// Implementation choice: the Web Audio API (native browser API) generates
// both tones on the fly. This was chosen over shipping local .mp3/.wav
// files because it needs zero extra assets, has no licensing/copyright
// question (nothing is reproduced from an existing game), never depends on
// network access, and adds no library at all — just a few lines using an
// API already built into every modern mobile and desktop browser.

let audioContext: AudioContext | null = null;

// ---------------------------------------------------------------------------
// كتم الصوت — تفضيل واحد للتطبيق كله، يُحفظ في المتصفح. عند الكتم لا يُنشأ
// AudioContext أصلًا، فكل دوال الصوت أدناه (اكتشف، لوحة النجوم، اختبر)
// تصبح صامتة تلقائيًا دون أي تعديل في أماكن استدعائها.
// ---------------------------------------------------------------------------
const MUTE_STORAGE_KEY = "bunyan-sound-muted";

function readStoredMute(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

let soundMuted = readStoredMute();

export function isSoundMuted(): boolean {
  return soundMuted;
}

export function setSoundMuted(value: boolean): void {
  soundMuted = value;
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // التخزين غير متاح (وضع خاص مثلًا) — يبقى الكتم ساريًا في هذه الجلسة فقط.
  }
}

/**
 * Lazily creates (or resumes) the shared AudioContext. Deliberately safe to
 * call from anywhere: returns null instead of throwing if the browser has
 * no Web Audio support at all, so a missing feature here never becomes a
 * visible error for the student.
 */
export function getAudioContext(): AudioContext | null {
  if (soundMuted) return null;
  try {
    if (!audioContext) {
      const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctx) return null;
      audioContext = new Ctx();
    }
    // Mobile browsers start a freshly-created context in "suspended" state
    // until it's resumed from within a real user-gesture call stack — this
    // is exactly why callers below are meant to run inside a click handler.
    if (audioContext.state === "suspended") {
      void audioContext.resume().catch(() => {});
    }
    return audioContext;
  } catch {
    return null;
  }
}

/**
 * Call this synchronously at the very start of the tap handler, before any
 * `await` — on some mobile browsers (notably iOS Safari) creating/resuming
 * the AudioContext only "counts" as tied to the user gesture if it happens
 * before the handler does any asynchronous work. The tone itself can still
 * be scheduled later, once the context this call already unlocked.
 */
export function primeAudioForInteraction(): void {
  getAudioContext();
}

export function playTone(
  ctx: AudioContext,
  frequency: number,
  startOffset: number,
  duration: number,
  type: OscillatorType,
  peakGain: number
) {
  const startTime = ctx.currentTime + startOffset;
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  // Quick fade in/out avoids the audible "click" a hard on/off would cause.
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(peakGain, startTime + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.03);
}

/** Short ascending two-note chime (~250ms total) — correct-answer feedback. */
export function playCorrectAnswerSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    playTone(ctx, 880, 0, 0.12, "sine", 0.18);
    playTone(ctx, 1318.5, 0.1, 0.16, "sine", 0.18);
  } catch {
    // Sound is a nice-to-have; it must never affect the answer flow itself.
  }
}

/** Short low buzz (~220ms) — wrong-answer feedback. */
export function playWrongAnswerSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    playTone(ctx, 180, 0, 0.22, "square", 0.1);
  } catch {
    // Same as above.
  }
}

/** Bright, quick "sparkle" (~180ms) — star board: adding a star. Distinct
 * from the correct-answer chime so the two contexts don't sound identical,
 * but built the same way (short layered sine tones, soft envelope) for a
 * consistent, professional feel across the app rather than a cheap beep. */
export function playStarAddedSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    playTone(ctx, 988, 0, 0.09, "sine", 0.16);
    playTone(ctx, 1568, 0.06, 0.14, "sine", 0.14);
  } catch {
    // Sound is a nice-to-have; it must never affect the board's own state.
  }
}

/** Soft, gentle descending tone (~180ms) — star board: removing a star.
 * Deliberately calm rather than negative-sounding, since decreasing a
 * count here isn't a "wrong answer", just an adjustment. */
export function playStarRemovedSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    playTone(ctx, 660, 0, 0.16, "sine", 0.13);
  } catch {
    // Same as above.
  }
}

// ---------------------------------------------------------------------------
// أصوات «اختبر» — نفس أسلوب الدوال أعلاه (Web Audio، بلا ملفات صوت)
// ---------------------------------------------------------------------------

/** نغمة تنزلق من تردد إلى آخر — تُستخدم لصوت «وقوع الطوبة» والنغمات الهابطة. */
export function playSweep(
  ctx: AudioContext,
  fromHz: number,
  toHz: number,
  startOffset: number,
  duration: number,
  type: OscillatorType,
  peakGain: number
) {
  const startTime = ctx.currentTime + startOffset;
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(fromHz, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(toHz, startTime + duration);
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(peakGain, startTime + 0.012);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.03);
}

// سلم خماسي صاعد: كلما طالت سلسلة الإجابات الصحيحة ارتفعت نغمة التشجيع.
const STREAK_NOTES = [1318.5, 1568, 1760, 2093, 2349.3];

/**
 * إجابة صحيحة: «طَقّ» طوبة تستقر في مكانها + رنّة الإجابة الصحيحة، وإذا كانت
 * الإجابة الثالثة (أو أكثر) على التوالي تُضاف نغمة تشجيع أعلى مع كل سلسلة.
 */
export function playBrickLaidSound(streak: number): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    playSweep(ctx, 260, 95, 0, 0.16, "triangle", 0.3); // ثِقَل الطوبة
    playTone(ctx, 1500, 0.004, 0.035, "triangle", 0.05); // نقرة الاصطدام
    playTone(ctx, 880, 0.09, 0.12, "sine", 0.16);
    playTone(ctx, 1318.5, 0.19, 0.18, "sine", 0.16);
    if (streak >= 3) {
      const note = STREAK_NOTES[Math.min(streak - 3, STREAK_NOTES.length - 1)];
      playTone(ctx, note, 0.33, 0.2, "sine", 0.13);
    }
  } catch {
    // الصوت إضافة لطيفة فقط، ولا يجوز أن يؤثر على سير الاختبار.
  }
}

/** إجابة خاطئة: نغمتان هابطتان ناعمتان («أوه») — ليست صفّارة مزعجة. */
export function playQuizWrongSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    playSweep(ctx, 392, 311, 0, 0.16, "triangle", 0.16);
    playSweep(ctx, 311, 233, 0.15, 0.24, "triangle", 0.14);
  } catch {
    // Same as above.
  }
}

/** بداية الاختبار: أربع نغمات صاعدة قصيرة. */
export function playQuizStartSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    [523.25, 659.25, 783.99, 1046.5].forEach((hz, i) => {
      playTone(ctx, hz, i * 0.09, i === 3 ? 0.3 : 0.14, "sine", 0.16);
    });
  } catch {
    // Same as above.
  }
}

/** نقرة خفيفة عند الانتقال للسؤال التالي. */
export function playNextTickSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    playTone(ctx, 720, 0, 0.06, "sine", 0.09);
  } catch {
    // Same as above.
  }
}

/**
 * نهاية الاختبار. celebrate = true (٧٠٪ فأكثر): فاصل احتفالي بخمس نغمات.
 * غير ذلك: ثلاث نغمات دافئة مشجّعة — لا شيء يُشعر الطالبة بالفشل.
 */
export function playQuizFinishSound(celebrate: boolean): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (celebrate) {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((hz, i, all) => {
        playTone(ctx, hz, i * 0.11, i === all.length - 1 ? 0.55 : 0.16, "sine", 0.17);
      });
      playTone(ctx, 2093, 0.55, 0.35, "sine", 0.08);
    } else {
      [392, 493.88, 587.33].forEach((hz, i, all) => {
        playTone(ctx, hz, i * 0.15, i === all.length - 1 ? 0.4 : 0.2, "sine", 0.15);
      });
    }
  } catch {
    // Same as above.
  }
}
