// أصوات ألعاب «ألعب» — على نفس نظام الصوت الموجود في المشروع (lib/sound.ts):
// Web Audio بلا أي ملف صوت أو مكتبة خارجية، ونفس زر الكتم العام (isSoundMuted /
// setSoundMuted)، ونفس تهيئة المتصفح على الجوال (primeAudioForInteraction).
// نغماتها أدفأ وأخف من أصوات «اختبر» عمدًا ليختلف الإحساس: «ألعب» لعب وتشجيع.

import { getAudioContext, playSweep, playTone } from "./sound";

// سلّم خماسي صاعد: كلما طالت سلسلة الإجابات الصحيحة ارتفعت نغمة المكافأة.
const COMBO_NOTES = [1046.5, 1174.7, 1318.5, 1568, 1760];

/** ترحيب عند بداية اللعبة: قفزة صغيرة ثم أربع نغمات صاعدة. */
export function playGameWelcomeSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    playSweep(ctx, 220, 440, 0, 0.14, "triangle", 0.16);
    [392, 523.25, 659.25, 783.99].forEach((hz, i) => {
      playTone(ctx, hz, 0.16 + i * 0.09, i === 3 ? 0.32 : 0.13, "triangle", 0.15);
    });
    playTone(ctx, 1568, 0.52, 0.22, "sine", 0.07);
  } catch {
    // الصوت إضافة لطيفة فقط، ولا يجوز أن يؤثر على سير اللعبة.
  }
}

/** إجابة صحيحة: «تا-دا» مشرقة، وتُضاف نغمة أعلى عند تتابع ٣ إجابات صحيحة فأكثر. */
export function playGameCorrectSound(streak: number): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    playTone(ctx, 659.25, 0, 0.13, "triangle", 0.17);
    playTone(ctx, 880, 0.09, 0.14, "triangle", 0.17);
    playTone(ctx, 1174.7, 0.18, 0.26, "sine", 0.15);
    if (streak >= 3) {
      const note = COMBO_NOTES[Math.min(streak - 3, COMBO_NOTES.length - 1)];
      playTone(ctx, note, 0.32, 0.24, "sine", 0.1);
    }
  } catch {
    // Same as above.
  }
}

/** إجابة خاطئة: «بووينغ» هابطة ناعمة — ليست صفّارة ولا صوت رفض. */
export function playGameWrongSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    playSweep(ctx, 330, 196, 0, 0.26, "sine", 0.17);
    playSweep(ctx, 262, 174, 0.2, 0.22, "sine", 0.1);
  } catch {
    // Same as above.
  }
}

/** انتقال للسؤال التالي: «وووش» قصيرة صاعدة. */
export function playGameNextSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    playSweep(ctx, 320, 980, 0, 0.14, "triangle", 0.09);
  } catch {
    // Same as above.
  }
}

/**
 * إكمال اللعبة. celebrate = true (٧٠٪ فأكثر): فاصل احتفالي بست نغمات ولمعة عالية.
 * غير ذلك: أربع نغمات دافئة مشجّعة — لا شيء يُشعر الطالب بالفشل.
 */
export function playGameFinishSound(celebrate: boolean): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (celebrate) {
      [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((hz, i, all) => {
        playTone(ctx, hz, i * 0.1, i === all.length - 1 ? 0.6 : 0.16, "triangle", 0.16);
      });
      playTone(ctx, 2093, 0.62, 0.4, "sine", 0.07);
    } else {
      [349.23, 440, 523.25, 659.25].forEach((hz, i, all) => {
        playTone(ctx, hz, i * 0.14, i === all.length - 1 ? 0.42 : 0.2, "triangle", 0.14);
      });
    }
  } catch {
    // Same as above.
  }
}
