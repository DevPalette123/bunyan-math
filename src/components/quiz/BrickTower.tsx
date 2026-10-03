// برج الطوب — العنصر المميّز في «اختبر».
//
// عشر طوبات مرتبة بنيانًا هرميًا (٤ + ٣ + ٢ + ١) تعبّر عن اسم المنصة نفسه:
// «بنيان». كل إجابة صحيحة تضع طوبة جديدة تسقط في مكانها، والإجابة الخاطئة
// تترك مكانًا فارغًا بحدّ وردي متقطع (وعلامة ×، فلا يعتمد المعنى على اللون
// وحده). فوق البرج سارية علم تُرفع عند انتهاء الاختبار.

export type BrickState = "pending" | "correct" | "wrong";
export type FlagState = "hidden" | "dim" | "raised";

interface BrickTowerProps {
  /** حالة كل طوبة من العشر، من الأسفل إلى الأعلى (الصف الأسفل أولًا). */
  states: BrickState[];
  /** رقم الطوبة التي ينتظر البرج وضعها الآن (السؤال الحالي)، أو null. */
  currentIndex?: number | null;
  /** الطوبة التي وُضعت للتو — تحصل على حركة السقوط. */
  justPlacedIndex?: number | null;
  flag?: FlagState;
  /**
   * كيف تُعرض الإجابة الخاطئة: "mark" علامة × وردية (أثناء الاختبار، لتوضيح
   * ما حدث)، أو "empty" مكان فارغ محايد (في النتيجة، حتى لا يبدو البرج
   * كأنه مليء بالأخطاء — الطوبة الناقصة يمكن بناؤها في المحاولة القادمة).
   */
  wrongStyle?: "mark" | "empty";
  /** لون قماش العلم عند رفعه. */
  flagColor?: string;
  className?: string;
  /** وصف نصي للقارئات الصوتية. */
  label: string;
}

const ROWS = [4, 3, 2, 1] as const; // من الأسفل للأعلى
const BRICK_W = 54;
const BRICK_H = 26;
const GAP = 4;
const VIEW_W = 240;
const BOTTOM_ROW_Y = 118;

interface Slot {
  index: number;
  x: number;
  y: number;
}

function buildSlots(): Slot[] {
  const slots: Slot[] = [];
  let index = 0;
  ROWS.forEach((count, row) => {
    const rowWidth = count * BRICK_W + (count - 1) * GAP;
    const startX = (VIEW_W - rowWidth) / 2;
    const y = BOTTOM_ROW_Y - row * (BRICK_H + GAP);
    for (let c = 0; c < count; c++) {
      // البناء يبدأ من اليمين إلى اليسار، كاتجاه القراءة بالعربية.
      slots.push({ index: index++, x: startX + (count - 1 - c) * (BRICK_W + GAP), y });
    }
  });
  return slots;
}

const SLOTS = buildSlots();

export default function BrickTower({
  states,
  currentIndex = null,
  justPlacedIndex = null,
  flag = "dim",
  wrongStyle = "mark",
  flagColor = "#F0B94A",
  className = "w-full max-w-[280px] h-auto",
  label,
}: BrickTowerProps) {
  return (
    <svg viewBox={`0 0 ${VIEW_W} 176`} className={className} role="img" aria-label={label}>
      {/* الأرض */}
      <rect x="14" y="147" width="212" height="8" rx="4" fill="#F3DFC1" opacity="0.2" />

      {/* السارية والعلم */}
      {flag !== "hidden" && (
        <g>
          <rect x="118.6" y="2" width="2.8" height="27" rx="1.4" fill="#F3DFC1" opacity={flag === "raised" ? 0.95 : 0.4} />
          <g
            className={flag === "raised" ? "animate-flag-wave" : undefined}
            style={{ transformBox: "fill-box", transformOrigin: "right center" }}
          >
            <path
              d="M118.6 3.5 L90 11.5 L118.6 19.5 Z"
              fill={flag === "raised" ? flagColor : "none"}
              stroke={flag === "raised" ? flagColor : "#F3DFC1"}
              strokeOpacity={flag === "raised" ? 1 : 0.4}
              strokeWidth="1.4"
              strokeLinejoin="round"
              strokeDasharray={flag === "raised" ? undefined : "3 3"}
            />
          </g>
        </g>
      )}

      {SLOTS.map((slot) => {
        const state = states[slot.index] ?? "pending";
        const isCurrent = slot.index === currentIndex && state === "pending";
        const isJustPlaced = slot.index === justPlacedIndex && state === "correct";
        const cx = slot.x + BRICK_W / 2;
        const cy = slot.y + BRICK_H / 2;

        if (state === "correct") {
          return (
            <g key={slot.index} className={isJustPlaced ? "animate-brick-drop" : undefined}>
              <rect x={slot.x} y={slot.y} width={BRICK_W} height={BRICK_H} rx="5" fill="#C8643F" />
              {/* حافة مضيئة علوية وظل سفلي يعطيان الطوبة حجمًا */}
              <rect x={slot.x + 4} y={slot.y + 3} width={BRICK_W - 8} height="5" rx="2.5" fill="#FFFFFF" opacity="0.22" />
              <rect x={slot.x + 1.5} y={slot.y + BRICK_H - 6} width={BRICK_W - 3} height="5" rx="2.5" fill="#7E3A22" opacity="0.45" />
              {/* نقاط صغيرة تشبه حبيبات الطين */}
              <circle cx={slot.x + 14} cy={cy + 1} r="1.3" fill="#7E3A22" opacity="0.35" />
              <circle cx={slot.x + 36} cy={cy - 1} r="1.1" fill="#7E3A22" opacity="0.3" />
              <circle cx={slot.x + 44} cy={cy + 2.5} r="1.4" fill="#7E3A22" opacity="0.3" />
            </g>
          );
        }

        if (state === "wrong" && wrongStyle === "mark") {
          return (
            <g key={slot.index}>
              <rect
                x={slot.x + 1}
                y={slot.y + 1}
                width={BRICK_W - 2}
                height={BRICK_H - 2}
                rx="5"
                fill="#E4576F"
                fillOpacity="0.1"
                stroke="#F08AA0"
                strokeWidth="1.5"
                strokeDasharray="3 5"
              />
              <path
                d={`M${cx - 4} ${cy - 4} L${cx + 4} ${cy + 4} M${cx + 4} ${cy - 4} L${cx - 4} ${cy + 4}`}
                stroke="#F08AA0"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
          );
        }

        return (
          <rect
            key={slot.index}
            x={slot.x + 1}
            y={slot.y + 1}
            width={BRICK_W - 2}
            height={BRICK_H - 2}
            rx="5"
            fill={isCurrent ? "#F0B94A" : "#F3DFC1"}
            fillOpacity={isCurrent ? 0.16 : 0.06}
            stroke={isCurrent ? "#F0B94A" : "#F3DFC1"}
            strokeOpacity={isCurrent ? 1 : state === "wrong" ? 0.45 : 0.32}
            strokeWidth="1.5"
            strokeDasharray="4 4"
            className={isCurrent ? "animate-glow-pulse" : undefined}
          />
        );
      })}
    </svg>
  );
}
