// شخصيات المسابقات — SVG مرسومة بالكود، لطيفة وبسيطة وغير مبالغة في الطفولية.
// هي جزء من هوية القالب فقط، وليست مرتبطة بنوع السؤال أو الموضوع.
import type { ThemeId } from "../../lib/competitions";
import { THEMES } from "./themes";

export type BuddyMood = "idle" | "happy";

function Face({ cx, cy, mood, ink, cheek, gap = 15 }: { cx: number; cy: number; mood: BuddyMood; ink: string; cheek: string; gap?: number }) {
  return (
    <g>
      <g className="cb-blink" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        {mood === "happy" ? (
          <>
            <path d={`M${cx - gap - 6} ${cy + 2} q6 -9 12 0`} stroke={ink} strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <path d={`M${cx + gap - 6} ${cy + 2} q6 -9 12 0`} stroke={ink} strokeWidth="3.2" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse cx={cx - gap} cy={cy} rx="4.6" ry="5.6" fill={ink} />
            <ellipse cx={cx + gap} cy={cy} rx="4.6" ry="5.6" fill={ink} />
            <circle cx={cx - gap + 1.6} cy={cy - 1.8} r="1.5" fill="#fff" />
            <circle cx={cx + gap + 1.6} cy={cy - 1.8} r="1.5" fill="#fff" />
          </>
        )}
      </g>
      <ellipse cx={cx - gap - 9} cy={cy + 10} rx="6" ry="3.8" fill={cheek} opacity=".75" />
      <ellipse cx={cx + gap + 9} cy={cy + 10} rx="6" ry="3.8" fill={cheek} opacity=".75" />
      <path
        d={mood === "happy" ? `M${cx - 8} ${cy + 9} q8 11 16 0 z` : `M${cx - 6} ${cy + 10} q6 6 12 0`}
        stroke={ink} strokeWidth="3" fill={mood === "happy" ? "#E88B8B" : "none"} strokeLinecap="round" strokeLinejoin="round"
      />
    </g>
  );
}

const INK = "#3B3A4A";
const CHEEK = "#F4A7A7";

function Cloud({ c, mood }: { c: string; mood: BuddyMood }) {
  return (
    <g>
      <ellipse cx="100" cy="196" rx="50" ry="7" fill="#000" opacity=".06" />
      <circle cx="62" cy="130" r="34" fill={c} />
      <circle cx="140" cy="132" r="32" fill={c} />
      <circle cx="100" cy="106" r="46" fill={c} />
      <rect x="44" y="124" width="112" height="56" rx="28" fill={c} />
      <ellipse cx="86" cy="86" rx="14" ry="7" fill="#fff" opacity=".45" transform="rotate(-20 86 86)" />
      <Face cx={100} cy={136} mood={mood} ink={INK} cheek={CHEEK} />
    </g>
  );
}
function Owl({ c, mood }: { c: string; mood: BuddyMood }) {
  return (
    <g>
      <ellipse cx="100" cy="196" rx="46" ry="7" fill="#000" opacity=".06" />
      <path d="M62 62 L74 88 L50 88 Z" fill={c} />
      <path d="M138 62 L126 88 L150 88 Z" fill={c} />
      <ellipse cx="100" cy="132" rx="56" ry="62" fill={c} />
      <ellipse cx="100" cy="152" rx="34" ry="36" fill="#fff" opacity=".55" />
      <circle cx="78" cy="112" r="20" fill="#fff" opacity=".85" />
      <circle cx="122" cy="112" r="20" fill="#fff" opacity=".85" />
      <g className="cb-blink" style={{ transformOrigin: "100px 112px" }}>
        {mood === "happy" ? (
          <>
            <path d="M70 114 q8 -10 16 0" stroke={INK} strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <path d="M114 114 q8 -10 16 0" stroke={INK} strokeWidth="3.2" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="78" cy="112" r="8" fill={INK} /><circle cx="122" cy="112" r="8" fill={INK} />
            <circle cx="80.5" cy="109" r="2.4" fill="#fff" /><circle cx="124.5" cy="109" r="2.4" fill="#fff" />
          </>
        )}
      </g>
      <path d="M94 124 L106 124 L100 136 Z" fill="#F2B25C" />
      <ellipse cx="62" cy="136" rx="6" ry="4" fill={CHEEK} opacity=".7" /><ellipse cx="138" cy="136" rx="6" ry="4" fill={CHEEK} opacity=".7" />
      <path d="M70 160 q6 6 12 0 M94 164 q6 6 12 0 M118 160 q6 6 12 0" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".8" />
      <path d="M76 190 h12 M112 190 h12" stroke="#F2B25C" strokeWidth="5" strokeLinecap="round" />
    </g>
  );
}
function Cat({ c, mood }: { c: string; mood: BuddyMood }) {
  return (
    <g>
      <ellipse cx="100" cy="196" rx="50" ry="7" fill="#000" opacity=".06" />
      <path d="M150 168 q36 -4 28 -40" stroke={c} strokeWidth="14" fill="none" strokeLinecap="round" />
      <ellipse cx="100" cy="162" rx="46" ry="34" fill={c} />
      <path d="M50 74 L60 38 L88 62 Z" fill={c} /><path d="M150 74 L140 38 L112 62 Z" fill={c} />
      <path d="M58 66 L63 50 L76 62 Z" fill="#fff" opacity=".6" /><path d="M142 66 L137 50 L124 62 Z" fill="#fff" opacity=".6" />
      <ellipse cx="100" cy="104" rx="56" ry="48" fill={c} />
      <Face cx={100} cy={104} mood={mood} ink={INK} cheek={CHEEK} gap={20} />
      <path d="M44 108 h-16 M44 118 l-14 5 M156 108 h16 M156 118 l14 5" stroke={INK} strokeWidth="2" strokeLinecap="round" opacity=".45" />
    </g>
  );
}
function Bear({ c, mood }: { c: string; mood: BuddyMood }) {
  return (
    <g>
      <ellipse cx="100" cy="196" rx="50" ry="7" fill="#000" opacity=".06" />
      <ellipse cx="100" cy="164" rx="46" ry="34" fill={c} />
      <ellipse cx="100" cy="170" rx="26" ry="22" fill="#fff" opacity=".5" />
      <circle cx="56" cy="64" r="20" fill={c} /><circle cx="144" cy="64" r="20" fill={c} />
      <circle cx="56" cy="64" r="10" fill="#fff" opacity=".55" /><circle cx="144" cy="64" r="10" fill="#fff" opacity=".55" />
      <ellipse cx="100" cy="104" rx="56" ry="50" fill={c} />
      <ellipse cx="100" cy="124" rx="22" ry="16" fill="#fff" opacity=".6" />
      <ellipse cx="100" cy="117" rx="6" ry="4.4" fill={INK} />
      <Face cx={100} cy={100} mood={mood} ink={INK} cheek={CHEEK} gap={22} />
    </g>
  );
}
function Bee({ c, mood }: { c: string; mood: BuddyMood }) {
  return (
    <g>
      <ellipse cx="100" cy="196" rx="46" ry="7" fill="#000" opacity=".06" />
      <ellipse cx="68" cy="84" rx="26" ry="36" fill="#fff" opacity=".8" transform="rotate(-25 68 84)" />
      <ellipse cx="132" cy="84" rx="26" ry="36" fill="#fff" opacity=".8" transform="rotate(25 132 84)" />
      <path d="M86 52 q-8 -16 -20 -18 M114 52 q8 -16 20 -18" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="66" cy="34" r="4" fill={INK} /><circle cx="134" cy="34" r="4" fill={INK} />
      <ellipse cx="100" cy="128" rx="58" ry="62" fill={c} />
      <path d="M46 150 q54 22 108 0 M52 172 q48 18 96 0" stroke={INK} strokeWidth="11" fill="none" strokeLinecap="round" opacity=".78" />
      <ellipse cx="82" cy="84" rx="14" ry="6" fill="#fff" opacity=".4" transform="rotate(-20 82 84)" />
      <Face cx={100} cy={114} mood={mood} ink={INK} cheek={CHEEK} />
    </g>
  );
}

const DRAW: Record<ThemeId, (p: { c: string; mood: BuddyMood }) => JSX.Element> = {
  sky: Cloud, mint: Owl, lilac: Cat, peach: Bear, sun: Bee,
};

export default function Buddy({
  theme, mood = "idle", className = "w-32 h-36", float = true,
}: { theme: ThemeId; mood?: BuddyMood; className?: string; float?: boolean }) {
  const Draw = DRAW[theme] ?? Cloud;
  return (
    <svg viewBox="0 0 200 204" className={`${className} ${float ? "cb-float" : ""}`} role="img" aria-label={`شخصية القالب: ${THEMES[theme]?.buddyName ?? ""}`}>
      <style>{`
        @keyframes cb-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes cb-blink{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.12)}}
        .cb-float{animation:cb-float 3.2s ease-in-out infinite}
        .cb-blink{animation:cb-blink 4.5s ease-in-out infinite}
        @media (prefers-reduced-motion: reduce){.cb-float,.cb-blink{animation:none}}
      `}</style>
      <Draw c={THEMES[theme]?.accent ?? "#9CC3E6"} mood={mood} />
    </svg>
  );
}
