import type { ReactNode } from "react";

interface BrandHeroProps {
  /** صورة الغلاف. تُعرض كاملة بنسبتها الأصلية بلا قص ولا طبقات فوقها. */
  image: string;
  alt: string;
  /** التحية الرئيسية، وتظهر تحت الصورة مباشرة. */
  title: string;
  /** سطر داعم تحت التحية. */
  subtitle?: string;
  /** صف الإجراءات (أزرار وشرائح) على الجهة المقابلة للتحية. */
  actions?: ReactNode;
  /**
   * للصور غير العريضة (مثل بانر الطالب 1361×784): على الجوال والتابلت تُعرض الصورة كاملة بعرض الصفحة،
   * ومن الشاشات الكبيرة (lg) تُعرض بارتفاع مريح في وسط إطار كريمي بزخرفة هندسية خفيفة،
   * وتذوب حوافها الجانبية في لون الإطار بدل التمدد الضبابي.
   * الصور العريضة أصلًا (بانر المعلم) تبقى بعرض الصفحة كما هي.
   */
  framed?: boolean;
}

/** زخرفة نجمة ثمانية (مربعان متداخلان) كبلاط SVG خفيف — بلا ملفات إضافية. */
const STAR_PATTERN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Cg fill='none' stroke='%23B8893A' stroke-width='1'%3E%3Crect x='19' y='19' width='26' height='26'/%3E%3Crect x='19' y='19' width='26' height='26' transform='rotate(45 32 32)'/%3E%3C/g%3E%3C/svg%3E\")";

/**
 * غلاف الصفحة (للطالب وللمعلم): الصورة وحدها بزوايا مستديرة وظل ناعم،
 * بلا بطاقة ولا أزرار فوقها ولا تدرّج يغطيها (الشعار واسم المنصة داخل الصورة نفسها).
 * التحية والإجراءات في صف نظيف تحتها على خلفية الصفحة.
 */
export default function BrandHero({ image, alt, title, subtitle, actions, framed = false }: BrandHeroProps) {
  return (
    <section className="animate-rise-in">
      <div
        className={`relative overflow-hidden rounded-3xl bg-[#FBF4E6] shadow-card ring-1 ring-sand-200 ${
          framed ? "lg:flex lg:justify-center lg:bg-gradient-to-b lg:from-[#FDF9F0] lg:to-[#F7ECD6]" : ""
        }`}
      >
        {framed && (
          <>
            {/* زخرفة جانبية خفيفة، تتلاشى نحو الوسط حيث الصورة */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 hidden opacity-[0.16] lg:block"
              style={{
                backgroundImage: STAR_PATTERN,
                backgroundSize: "64px 64px",
                WebkitMaskImage: "linear-gradient(to right, #000 0%, transparent 28%, transparent 72%, #000 100%)",
                maskImage: "linear-gradient(to right, #000 0%, transparent 28%, transparent 72%, #000 100%)",
              }}
            />
            {/* شريط ألوان العلم الرفيع أسفل الإطار */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-1 bg-gradient-to-l from-[#2F7D4F] via-white to-[#B3261E] lg:block"
            />
          </>
        )}

        <img
          src={image}
          alt={alt}
          className={`block select-none ${
            framed
              ? "h-auto w-full lg:relative lg:h-[400px] lg:w-auto lg:max-w-full xl:h-[440px] lg:[mask-image:linear-gradient(to_right,transparent,#000_9%,#000_91%,transparent)] lg:[-webkit-mask-image:linear-gradient(to_right,transparent,#000_9%,#000_91%,transparent)]"
              : "h-auto w-full"
          }`}
          draggable={false}
          fetchPriority="high"
        />
      </div>

      <div className="mt-4 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold leading-snug text-ink-900 sm:text-2xl">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm font-bold text-ink-500">{subtitle}</p>}
        </div>

        {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
    </section>
  );
}
