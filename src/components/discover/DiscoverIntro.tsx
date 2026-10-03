import iconDiscover from "../../assets/icons/icon-discover.png";
import { toArabicDigits } from "../../utils/arabicNumerals";
import { ClipboardCheckIcon, TimerIcon, TrophyIcon } from "../icons/Glyphs";

interface DiscoverIntroProps {
  totalQuestions: number;
  minutes: number;
  skillCount: number;
  onStart: () => void;
  starting: boolean;
  errorMessage: string | null;
}

export default function DiscoverIntro({
  totalQuestions,
  minutes,
  skillCount,
  onStart,
  starting,
  errorMessage,
}: DiscoverIntroProps) {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-14 flex flex-col items-center text-center gap-6">
      <span className="w-20 h-20 rounded-4xl bg-sky-50 flex items-center justify-center animate-pop-in">
        <img src={iconDiscover} alt="" className="w-12 h-12 object-contain" />
      </span>

      <div className="flex flex-col gap-2 animate-rise-in [animation-delay:60ms]">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-900">اكتشف مستواك في الرياضيات</h1>
        <p className="text-sm sm:text-base font-bold text-ink-500 leading-relaxed">
          اختبر مهاراتك واكتشف نقاط قوتك والمهارات التي تحتاج إلى مزيد من التدريب.
        </p>
      </div>

      <div className="w-full bg-white rounded-3xl shadow-soft p-6 sm:p-7 grid grid-cols-3 gap-3 animate-rise-in [animation-delay:120ms]">
        <div className="flex flex-col items-center gap-1.5">
          <span className="w-11 h-11 rounded-2xl bg-berry-50 text-berry-500 flex items-center justify-center">
            <ClipboardCheckIcon className="w-5 h-5" />
          </span>
          <p className="text-lg font-extrabold text-ink-900">{toArabicDigits(totalQuestions)}</p>
          <p className="text-[11px] font-bold text-ink-500">أسئلة</p>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <span className="w-11 h-11 rounded-2xl bg-sun-50 text-sun-500 flex items-center justify-center">
            <TimerIcon className="w-5 h-5" />
          </span>
          <p className="text-lg font-extrabold text-ink-900">{toArabicDigits(minutes)}</p>
          <p className="text-[11px] font-bold text-ink-500">دقائق</p>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <span className="w-11 h-11 rounded-2xl bg-palm-50 text-palm-600 flex items-center justify-center">
            <TrophyIcon className="w-5 h-5" />
          </span>
          <p className="text-lg font-extrabold text-ink-900">{toArabicDigits(skillCount)}</p>
          <p className="text-[11px] font-bold text-ink-500">مهارات</p>
        </div>
      </div>

      {errorMessage && (
        <p className="text-xs font-bold text-rose-500 bg-rose-50 rounded-xl px-3 py-2">{errorMessage}</p>
      )}

      <button
        onClick={onStart}
        disabled={starting}
        className="w-full sm:w-auto bg-berry-500 hover:bg-berry-600 disabled:opacity-60 text-white font-extrabold text-base rounded-2xl px-10 py-4 transition-colors animate-rise-in [animation-delay:180ms]"
      >
        {starting ? "جارٍ التجهيز..." : "ابدأ التحديد"}
      </button>
    </main>
  );
}
