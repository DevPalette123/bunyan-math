import type { ReactNode } from "react";
import teacherHeroIllustration from "../../assets/hero/teacher-hero-illustration.png";

interface TeacherHeroProps {
  teacherName: string;
  /** شريحة الصف (الاسم + التعديل) تظهر أسفل التحية. */
  classSlot?: ReactNode;
  /** أزرار الإجراءات السريعة. */
  actions?: ReactNode;
}

export default function TeacherHero({ teacherName, classSlot, actions }: TeacherHeroProps) {
  // «معلمة تجريبية» (حساب التجربة) لا تُسبق بـ«أستاذة» مرة ثانية.
  const name = teacherName.trim();
  const greetingName = /^(أستاذة|الأستاذة|معلمة|المعلمة)/.test(name) ? name : `أستاذة ${name}`.trim();
  return (
    <section
      className="relative overflow-hidden rounded-4xl shadow-card animate-rise-in"
      style={{ background: "linear-gradient(135deg, #233D4A 0%, #3E6478 55%, #5B7C8D 100%)" }}
    >
      {/* زخارف ناعمة */}
      <span className="pointer-events-none absolute -top-16 -start-16 w-56 h-56 rounded-full bg-white/10" />
      <span className="pointer-events-none absolute -bottom-20 start-1/3 w-64 h-64 rounded-full bg-white/5" />

      <div className="relative flex flex-col sm:flex-row-reverse items-stretch">
        {/* الصورة مفرَّغة بخلفية شفافة حقيقية؛ المعلمة تقف على الحافة السفلية للبطاقة (وسطها مقصوص عمدًا). */}
        <div className="relative h-56 sm:h-auto sm:min-h-[280px] lg:min-h-[320px] sm:w-[46%] lg:w-[44%] shrink-0 mt-3 sm:mt-0">
          <img
            src={teacherHeroIllustration}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-contain object-bottom sm:object-right-bottom drop-shadow-lg"
          />
        </div>

        <div className="flex-1 flex flex-col justify-center gap-3 px-6 py-6 sm:py-10 sm:px-10 lg:px-14 text-center sm:text-start">
          <div>
            <p className="text-xs sm:text-sm font-bold text-teach-100 mb-1">لوحة المعلمة</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-snug">
              مرحبًا بكِ، {greetingName}
            </h2>
            <p className="text-sm sm:text-base font-bold text-mint-100 mt-1.5">هنا يبدأ أثركِ التعليمي ✨</p>
          </div>
          {classSlot && <div className="flex justify-center sm:justify-start">{classSlot}</div>}
          {actions && <div className="flex flex-wrap justify-center sm:justify-start gap-2.5 mt-1">{actions}</div>}
        </div>
      </div>
    </section>
  );
}
