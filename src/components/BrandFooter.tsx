/**
 * Credits line — text only (the platform logo already lives in the sidebar/header,
 * the school logo sits at the top of each page).
 */
export default function BrandFooter({ className = "mt-8 mb-24 lg:mb-6 px-4" }: { className?: string }) {
  return (
    <footer dir="rtl" className={`${className} text-center`}>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-x-6 gap-y-1 text-[12px] text-ink-500/80">
        <p>
          إعداد: <span className="font-extrabold text-ink-700">أ. رحمة الخروصية</span>
        </p>
        <span className="hidden sm:block w-1 h-1 rounded-full bg-sand-200" aria-hidden="true" />
        <p>
          مديرة المدرسة: <span className="font-extrabold text-ink-700">أ. ليلى الكيومية</span>
        </p>
      </div>
    </footer>
  );
}
