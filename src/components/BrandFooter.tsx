import logoMark from "../assets/logo/logo-mark.png";

const credits = [
  { role: "إعداد", name: "أ. رحمة الخروصية" },
  { role: "مديرة المدرسة", name: "أ. ليلى الكيومية" },
  { role: "المشرفة", name: "أ. فاطمة الغافرية" },
];

/**
 * تذييل المنصة: بطاقة هادئة بخط علوي بألوان الهوية، شعار المنصة وشعارها اللفظي،
 * ثم ثلاث بطاقات صغيرة للأسماء (الدور فوق الاسم).
 */
export default function BrandFooter({ className = "mt-8 mb-24 lg:mb-6 px-4" }: { className?: string }) {
  return (
    <footer dir="rtl" className={className}>
      <div className="mx-auto max-w-[1400px] overflow-hidden rounded-3xl border border-sand-200 bg-white/80 shadow-soft">
        <div className="h-1 w-full bg-gradient-to-l from-[#1F7A4D] via-[#D9A93B] to-[#C8202F]" aria-hidden="true" />

        <div className="flex flex-col items-center gap-5 px-5 py-6 sm:px-8">
          <div className="flex items-center gap-3">
            <img src={logoMark} alt="" className="h-10 w-10 select-none object-contain" draggable={false} />
            <div className="flex flex-col text-start">
              <span className="text-base font-extrabold leading-tight text-ink-900">بُنيان الرياضيات</span>
              <span className="text-[12px] font-bold text-palm-600">نبني مهاراتنا .. ونعتز بهويتنا</span>
            </div>
          </div>

          <div className="h-px w-24 bg-gradient-to-r from-transparent via-sand-200 to-transparent" aria-hidden="true" />

          <ul className="grid w-full max-w-3xl grid-cols-1 gap-2.5 sm:grid-cols-3">
            {credits.map((c) => (
              <li
                key={c.role}
                className="flex flex-col items-center gap-0.5 rounded-2xl bg-sand-50 px-4 py-3 text-center ring-1 ring-sand-200"
              >
                <span className="text-[11px] font-bold text-ink-500">{c.role}</span>
                <span className="text-sm font-extrabold text-ink-900">{c.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
