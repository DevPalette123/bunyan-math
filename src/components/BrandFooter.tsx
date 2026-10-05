const credits = [
  { role: "إعداد", name: "أ. رحمة الخروصية" },
  { role: "مديرة المدرسة", name: "أ. ليلى الكيومية" },
  { role: "المشرفة", name: "أ. فاطمة الغافرية" },
];

/** تذييل المنصة: أسماء فقط كنص بسيط، بلا شعار ولا صناديق ولا زخارف. */
export default function BrandFooter({ className = "mt-8 mb-24 lg:mb-6 px-4" }: { className?: string }) {
  return (
    <footer dir="rtl" className={className}>
      <ul className="mx-auto flex max-w-[1400px] flex-col items-center justify-center gap-1 text-center text-[13px] text-ink-500 sm:flex-row sm:flex-wrap sm:gap-x-8">
        {credits.map((c) => (
          <li key={c.role}>
            {c.role}: <span className="font-extrabold text-ink-700">{c.name}</span>
          </li>
        ))}
      </ul>
    </footer>
  );
}
