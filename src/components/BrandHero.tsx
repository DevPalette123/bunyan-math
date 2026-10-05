import type { ReactNode } from "react";

interface BrandHeroProps {
  /** صورة الغلاف العريضة. تُعرض بنسبتها الأصلية وبعرض البطاقة كاملًا بلا قص. */
  image: string;
  alt: string;
  /** شارة صغيرة فوق التحية (مثل «لوحة المعلم»). */
  badge: string;
  /** التحية الرئيسية. */
  title: string;
  /** سطر داعم تحت التحية. */
  subtitle?: string;
  /** صف الإجراءات (أزرار وشرائح) على الجهة المقابلة للتحية. */
  actions?: ReactNode;
}

/**
 * غلاف عريض متكامل: بطاقة واحدة بزوايا مستديرة وحدّ خفيف وظل ناعم.
 * الصورة في الأعلى كاملة، ثم خط ذهبي رفيع، ثم شريط معلومات فيه التحية على اليمين
 * والإجراءات في صف واحد على اليسار (RTL)، ويتكدّسان فوق بعضهما على الجوال.
 */
export default function BrandHero({ image, alt, badge, title, subtitle, actions }: BrandHeroProps) {
  return (
    <section className="overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-card animate-rise-in">
      <img
        src={image}
        alt={alt}
        className="block h-auto w-full max-h-[380px] select-none object-cover object-[50%_40%]"
        draggable={false}
      />

      <div className="h-1 w-full bg-gradient-to-l from-[#1F7A4D] via-[#D9A93B] to-[#C8202F]" aria-hidden="true" />

      <div className="flex flex-col gap-5 bg-gradient-to-b from-[#FFFCF6] to-white px-5 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-palm-50 px-3 py-1 text-[11px] font-extrabold text-palm-600">
            <span className="h-1.5 w-1.5 rounded-full bg-palm-500" aria-hidden="true" />
            {badge}
          </span>
          <h2 className="text-2xl font-extrabold leading-snug text-ink-900 sm:text-[28px]">{title}</h2>
          {subtitle && <p className="text-sm font-bold text-ink-500 sm:text-base">{subtitle}</p>}
        </div>

        {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
    </section>
  );
}
