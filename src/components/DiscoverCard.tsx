interface DiscoverCardProps {
  busy: "teacher" | "student" | null;
  error: string | null;
  onStart: (role: "teacher" | "student") => void;
}

/** كتاب مفتوح تحيط به رموز الجمع والطرح والضرب والقسمة (رسم SVG بألوان الهوية). */
function BookArt() {
  return (
    <svg viewBox="0 0 96 64" className="h-14 w-20 shrink-0" aria-hidden="true">
      <g fontWeight="900" fontSize="15" textAnchor="middle" fill="#F4C54B">
        <text x="22" y="14">+</text>
        <text x="40" y="12">−</text>
        <text x="58" y="14">×</text>
        <text x="75" y="18">÷</text>
      </g>
      <path d="M8 52 L48 58 L88 52 L88 28 L48 34 L8 28 Z" fill="#0F4D31" />
      <path d="M10 26 Q30 22 48 30 L48 54 Q30 46 10 50 Z" fill="#FFFCF3" stroke="#E7DCC0" strokeWidth="1.2" />
      <path d="M86 26 Q66 22 48 30 L48 54 Q66 46 86 50 Z" fill="#FFFCF3" stroke="#E7DCC0" strokeWidth="1.2" />
      <g stroke="#D7C9A4" strokeWidth="1.2" strokeLinecap="round">
        <path d="M16 32 Q28 30 41 35" />
        <path d="M16 38 Q28 36 41 41" />
        <path d="M16 44 Q28 42 41 47" />
        <path d="M80 32 Q68 30 55 35" />
        <path d="M80 38 Q68 36 55 41" />
        <path d="M80 44 Q68 42 55 47" />
      </g>
    </svg>
  );
}

/** سبّورة صغيرة وطبشورة لزر المعلم. */
function BoardArt() {
  return (
    <svg viewBox="0 0 96 64" className="h-14 w-20 shrink-0" aria-hidden="true">
      <g fontWeight="900" fontSize="15" textAnchor="middle" fill="#F4C54B">
        <text x="22" y="14">+</text>
        <text x="40" y="12">−</text>
        <text x="58" y="14">×</text>
        <text x="75" y="18">÷</text>
      </g>
      <rect x="10" y="22" width="76" height="36" rx="5" fill="#FFFCF3" stroke="#E7DCC0" strokeWidth="1.2" />
      <rect x="15" y="27" width="66" height="26" rx="3" fill="#0F4D31" />
      <g stroke="#FFFCF3" strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M24 36 H40" />
        <path d="M24 44 H34" />
        <path d="M52 34 L60 46 M60 34 L52 46" />
        <path d="M68 40 H74" />
      </g>
    </svg>
  );
}

function Sparks({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={`h-8 w-8 shrink-0 text-sun-400 sm:h-9 sm:w-9 ${flip ? "-scale-x-100" : ""}`}
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="4" strokeLinecap="round">
        <path d="M7 24 L17 20" />
        <path d="M11 11 L18 17" />
        <path d="M24 5 L26 14" />
      </g>
    </svg>
  );
}

function PillButton({
  title,
  subtitle,
  busyText,
  busy,
  disabled,
  art,
  onClick,
}: {
  title: string;
  subtitle: string;
  busyText: string;
  busy: boolean;
  disabled: boolean;
  art: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group relative flex w-full items-center gap-3 rounded-full bg-gradient-to-b from-[#1F6B47] to-[#0F4D31] px-3 py-2 text-start shadow-[0_6px_16px_rgba(15,77,49,0.28)] ring-2 ring-[#E3BE62] ring-offset-2 ring-offset-white transition-all hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 disabled:opacity-60 disabled:hover:translate-y-0"
    >
      {/* الدائرة والسهم في بداية الزر (يمين الشاشة في الواجهة العربية) */}
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#FFFCF3] shadow-inner transition-transform group-hover:scale-105">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#0F4D31]" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 5 L16 12 L9 19" />
        </svg>
      </span>

      <span className="h-9 w-px shrink-0 bg-white/25" aria-hidden="true" />

      <span className="min-w-0 flex-1 text-center">
        <span className="block text-lg font-extrabold leading-tight text-white">
          {busy ? busyText : title}
        </span>
        <span className="block text-[11px] font-bold leading-snug text-white/80">{subtitle}</span>
      </span>

      {art}
    </button>
  );
}

export default function DiscoverCard({ busy, error, onStart }: DiscoverCardProps) {
  return (
    <div className="mt-5 rounded-[28px] bg-white px-4 pb-5 pt-4 text-center shadow-soft ring-1 ring-sand-200">
      <div className="flex items-center justify-center gap-1">
        <Sparks />
        <h2 className="relative px-3 text-3xl font-extrabold leading-tight text-palm-600 sm:text-[34px]">
          <span className="absolute inset-x-0 bottom-1 -z-0 h-4 rounded-full bg-sun-400/40" aria-hidden="true" />
          <span className="relative">ابدأ الآن</span>
        </h2>
        <Sparks flip />
      </div>

      <p className="mt-1 text-[15px] font-extrabold text-ink-900">
        جرّب وتعلّم مع <span className="text-palm-500">بنيان الرياضيات</span>
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
        بحساب وبيانات تجريبية — بدون بريد أو رمز.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <PillButton
          title="تجربة الطالب"
          subtitle="التعلّم واللعب والتحديات"
          busyText="جارٍ التجهيز..."
          busy={busy === "student"}
          disabled={busy !== null}
          art={<BookArt />}
          onClick={() => onStart("student")}
        />
        <PillButton
          title="تجربة المعلم"
          subtitle="الصفوف والطلاب والتقارير"
          busyText="جارٍ التجهيز..."
          busy={busy === "teacher"}
          disabled={busy !== null}
          art={<BoardArt />}
          onClick={() => onStart("teacher")}
        />
      </div>

      {busy && <p className="mt-3 text-[11px] text-ink-500">جارٍ تجهيز تجربتك… قد يستغرق ذلك بضع ثوانٍ.</p>}
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-500">
          {error}
        </p>
      )}
    </div>
  );
}
