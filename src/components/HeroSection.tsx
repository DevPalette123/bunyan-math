import { Link } from "react-router-dom";
import studentBanner from "../assets/hero/student-banner.jpg";
import { BookIcon, SparkleIcon } from "./icons/Glyphs";

interface HeroSectionProps {
  studentName: string;
  motivationalLine: string;
}

/**
 * غلاف الطالب: بطاقة عريضة واحدة متكاملة.
 * الصورة كاملة بنسبتها الأصلية في الأعلى، وأسفلها يذوب تدريجيًا (Gradient Fade) في لون البطاقة،
 * ثم تصعد لوحة الترحيب فوق هذا الذوبان قليلًا فلا يظهر أي خط فاصل بين الصورة والنص.
 * التحية على اليمين والأزرار على اليسار (RTL) في الشاشات الكبيرة، وتتكدس على الجوال.
 */
export default function HeroSection({ studentName, motivationalLine }: HeroSectionProps) {
  const firstName = studentName.split(" ")[0];

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-sand-200 bg-[#FFFCF6] shadow-card animate-rise-in [animation-delay:60ms]">
      {/* الصورة كاملة بلا قص */}
      <div className="relative">
        <img
          src={studentBanner}
          alt="منصة بنيان الرياضيات — نبني مهاراتنا ونعتز بهويتنا"
          className="block h-auto w-full select-none"
          draggable={false}
        />
        {/* ذوبان أسفل الصورة في لون البطاقة */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#FFFCF6] via-[#FFFCF6]/70 to-transparent"
          aria-hidden="true"
        />
      </div>

      {/* لوحة الترحيب: تصعد فوق الصورة لتندمج معها */}
      <div className="relative z-10 -mt-10 px-5 pb-6 sm:-mt-14 sm:px-8 sm:pb-7 lg:-mt-20 lg:px-10">
        <div className="flex flex-col items-center gap-5 text-center lg:flex-row lg:items-end lg:justify-between lg:text-start">
          <div className="flex min-w-0 flex-col items-center gap-2 lg:items-start">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-palm-50/90 px-3 py-1 text-[11px] font-extrabold text-palm-600 ring-1 ring-palm-100">
              <span className="h-1.5 w-1.5 rounded-full bg-palm-500" aria-hidden="true" />
              لوحة الطالب
            </span>

            <h2 className="flex items-center gap-2 text-2xl font-extrabold leading-snug text-ink-900 sm:text-3xl lg:text-[34px]">
              مرحبًا بك يا {firstName}
              <SparkleIcon className="h-5 w-5 shrink-0 text-sun-500 sm:h-6 sm:w-6" />
            </h2>

            <p className="text-sm font-bold text-ink-700 sm:text-base">معًا نكتشف عالم الرياضيات</p>

            <p className="flex items-center gap-1.5 text-xs font-bold text-rose-500 sm:text-sm">
              <SparkleIcon className="h-3.5 w-3.5 shrink-0" />
              {motivationalLine}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center">
            <Link
              to="/learn"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-palm-500 px-7 py-3.5 text-sm font-extrabold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:bg-palm-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-palm-100"
            >
              <BookIcon className="h-5 w-5" />
              ابدأ التعلّم
            </Link>
            <Link
              to="/play"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-3.5 text-sm font-extrabold text-ink-900 ring-1 ring-sand-200 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-sand-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-sand-200"
            >
              🎮 العب
            </Link>
          </div>
        </div>
      </div>

      {/* خط ذهبي رفيع بألوان الهوية أسفل البطاقة */}
      <div className="h-1 w-full bg-gradient-to-l from-[#1F7A4D] via-[#D9A93B] to-[#C8202F]" aria-hidden="true" />
    </section>
  );
}
