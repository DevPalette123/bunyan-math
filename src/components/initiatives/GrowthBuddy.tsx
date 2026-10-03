// «نُمو» — كائن صغير لطيف بعينين كبيرتين وخدّين ورديّين، تنبت فوق رأسه نبتة
// تكبر مع كل محطة تُكمِلها الطالبة، وفي النهاية تُزهر نجمة ذهبية.
// المرحلة 0..5 (٥ = مزهرة). يرمش، يتنفس، يلوّح بيده، ويقفز فرحًا.

export type BuddyMood = "idle" | "happy" | "sad" | "cheer" | "calm";

interface GrowthBuddyProps {
  /** 0 = برعم صغير … 5 = نبتة مزهرة بنجمة. */
  stage: number;
  mood?: BuddyMood;
  className?: string;
}

export const BUDDY_STAGE_NAMES = ["بذرة صغيرة", "برعم صغير", "نبتة صغيرة", "نبتة قوية", "نبتة مورقة", "نبتة مزهرة"];

const BASE_Y = 100; // مكان خروج النبتة من رأس نُمو
const STEM = [12, 28, 44, 58, 70, 80];

interface LeafDef {
  t: number;
  side: 1 | -1;
  minStage: number;
  size: number;
}

const LEAVES: LeafDef[] = [
  { t: 1, side: 1, minStage: 0, size: 0.75 },
  { t: 1, side: -1, minStage: 0, size: 0.75 },
  { t: 0.55, side: 1, minStage: 1, size: 0.95 },
  { t: 0.5, side: -1, minStage: 1, size: 0.95 },
  { t: 0.3, side: 1, minStage: 2, size: 1.1 },
  { t: 0.28, side: -1, minStage: 2, size: 1.1 },
  { t: 0.78, side: -1, minStage: 3, size: 1 },
  { t: 0.74, side: 1, minStage: 3, size: 1 },
  { t: 0.12, side: 1, minStage: 4, size: 1.2 },
  { t: 0.12, side: -1, minStage: 4, size: 1.2 },
];

const MOOD_CLASS: Record<BuddyMood, string> = {
  idle: "gb-float",
  calm: "gb-breathe",
  happy: "gb-hop",
  cheer: "gb-hop",
  sad: "gb-wobble",
};

const STAR_PATH = "M0 -22 L6.5 -7 L22 -6 L10 4 L14 20 L0 11 L-14 20 L-10 4 L-22 -6 L-6.5 -7 Z";
const SPARKLE = "M0 -8 L2.4 -2.4 L8 0 L2.4 2.4 L0 8 L-2.4 2.4 L-8 0 L-2.4 -2.4 Z";
const BODY = "M100 100 C152 100 162 142 158 178 C154 210 132 224 100 224 C68 224 46 210 42 178 C38 142 48 100 100 100 Z";

export default function GrowthBuddy({ stage, mood = "idle", className = "w-32 h-40" }: GrowthBuddyProps) {
  const s = Math.max(0, Math.min(5, stage));
  const topY = BASE_Y - STEM[s];
  const happy = mood === "happy" || mood === "cheer";
  const sad = mood === "sad";
  const calm = mood === "calm";
  const cheer = mood === "cheer";

  return (
    <div
      className={`${className} ${MOOD_CLASS[mood]}`}
      style={{ transformOrigin: "50% 95%" }}
      role="img"
      aria-label={`نُمو — ${BUDDY_STAGE_NAMES[s]}`}
    >
      <style>{`
        @keyframes gb-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes gb-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
        @keyframes gb-hop{0%,100%{transform:translateY(0) scale(1,1)}25%{transform:translateY(-18px) scale(.95,1.07)}50%{transform:translateY(0) scale(1.07,.92)}70%{transform:translateY(-7px) scale(1,1)}}
        @keyframes gb-wobble{0%,100%{transform:rotate(0)}25%{transform:rotate(-5deg)}75%{transform:rotate(5deg)}}
        @keyframes gb-sway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
        @keyframes gb-blink{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.08)}}
        @keyframes gb-wave{0%,100%{transform:rotate(0)}25%{transform:rotate(-38deg)}55%{transform:rotate(-8deg)}80%{transform:rotate(-32deg)}}
        @keyframes gb-twinkle{0%,100%{opacity:.25;transform:scale(.6)}50%{opacity:1;transform:scale(1.15)}}
        @keyframes gb-glow{0%,100%{opacity:.2}50%{opacity:.5}}
        .gb-float{animation:gb-float 3.2s ease-in-out infinite}
        .gb-breathe{animation:gb-breathe 4s ease-in-out infinite}
        .gb-hop{animation:gb-hop .8s ease-out 2}
        .gb-wobble{animation:gb-wobble .5s ease-in-out 2}
        .gb-sway{animation:gb-sway 3.6s ease-in-out infinite;transform-box:view-box;transform-origin:100px ${BASE_Y}px}
        .gb-sag{transform:rotate(14deg);transform-box:view-box;transform-origin:100px ${BASE_Y}px;transition:transform .4s}
        .gb-blink{animation:gb-blink 4.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
        .gb-wave{animation:gb-wave 1s ease-in-out infinite;transform-box:view-box;transform-origin:156px 160px}
        .gb-wave-idle{animation:gb-wave 2.2s ease-in-out 2 1s;transform-box:view-box;transform-origin:156px 160px}
        .gb-twinkle{animation:gb-twinkle 1.8s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
        .gb-glow{animation:gb-glow 2s ease-in-out infinite}
      `}</style>

      <svg viewBox="0 -28 200 268" className="w-full h-full overflow-visible">
        <defs>
          <clipPath id="gb-body-clip">
            <path d={BODY} />
          </clipPath>
          <radialGradient id="gb-body-grad" cx="38%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#F5A07F" />
            <stop offset="100%" stopColor="#D9694A" />
          </radialGradient>
        </defs>

        {/* ظل أرضي */}
        <ellipse cx="100" cy="230" rx="50" ry="7" fill="#1F2A24" opacity="0.13" />

        {/* القدمان */}
        <ellipse cx="76" cy="226" rx="17" ry="8" fill="#B8552F" />
        <ellipse cx="124" cy="226" rx="17" ry="8" fill="#B8552F" />

        {/* الذراع اليسرى */}
        <ellipse cx="44" cy="172" rx="9" ry="15" fill="#D9694A" transform="rotate(18 44 172)" />

        {/* النبتة */}
        <g className={sad ? "gb-sag" : "gb-sway"} key={s}>
          <path
            d={`M100 ${BASE_Y + 4} C 96 ${BASE_Y - STEM[s] * 0.35}, 104 ${BASE_Y - STEM[s] * 0.7}, 100 ${topY}`}
            stroke="#3E9C6B"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
          />
          {LEAVES.filter((l) => l.minStage <= s).map((l, i) => {
            const y = BASE_Y - STEM[s] * l.t;
            const k = l.size * 1.25;
            return (
              <g key={i} transform={`translate(100 ${y}) scale(${l.side * k} ${k}) rotate(-30)`}>
                <path d="M0 0 C 6 -10, 22 -14, 34 -6 C 24 6, 8 8, 0 0 Z" fill={i % 2 ? "#57B282" : "#3E9C6B"} />
                <path d="M3 -1 C 12 -3, 20 -4, 28 -5" stroke="#146239" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.5" />
              </g>
            );
          })}

          {s >= 3 && s < 5 && (
            <ellipse cx="100" cy={topY - 7} rx={s === 3 ? 6 : 9} ry={s === 3 ? 9 : 13} fill="#F0B94A" opacity="0.95" />
          )}
          {s === 5 && (
            <g transform={`translate(100 ${topY - 18})`}>
              <circle className="gb-glow" r="34" fill="#F0B94A" />
              <path d={STAR_PATH} fill="#F0B94A" stroke="#E3A422" strokeWidth="4" strokeLinejoin="round" transform="scale(1.1)" />
              <path d="M-9 -12 L-3 -18" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" opacity="0.7" />
            </g>
          )}
        </g>

        {/* الجسم */}
        <path d={BODY} fill="url(#gb-body-grad)" />

        {/* شريط زخرفة مثلثات مستوحى من الزخرفة العُمانية */}
        <g clipPath="url(#gb-body-clip)">
          <rect x="30" y="204" width="140" height="24" fill="#B8552F" opacity="0.55" />
          {Array.from({ length: 9 }).map((_, i) => (
            <path key={i} d={`M${34 + i * 16} 228 L${42 + i * 16} 208 L${50 + i * 16} 228 Z`} fill="#FFE9C7" opacity="0.9" />
          ))}
          <ellipse cx="66" cy="132" rx="9" ry="16" fill="#fff" opacity="0.22" transform="rotate(20 66 132)" />
        </g>

        {/* الخدّان */}
        <ellipse cx="66" cy="172" rx="10" ry="6.5" fill="#FF8FAE" opacity="0.65" />
        <ellipse cx="134" cy="172" rx="10" ry="6.5" fill="#FF8FAE" opacity="0.65" />

        {/* العينان */}
        {sad ? (
          <g>
            <g className="gb-blink">
              <ellipse cx="78" cy="152" rx="13" ry="15" fill="#fff" />
              <ellipse cx="80" cy="157" rx="8.5" ry="10" fill="#1F2A24" />
              <circle cx="83" cy="152" r="3.2" fill="#fff" />
            </g>
            <g className="gb-blink">
              <ellipse cx="122" cy="152" rx="13" ry="15" fill="#fff" />
              <ellipse cx="120" cy="157" rx="8.5" ry="10" fill="#1F2A24" />
              <circle cx="123" cy="152" r="3.2" fill="#fff" />
            </g>
            <path d="M62 134 L90 142" stroke="#5A2E1C" strokeWidth="4" strokeLinecap="round" />
            <path d="M138 134 L110 142" stroke="#5A2E1C" strokeWidth="4" strokeLinecap="round" />
          </g>
        ) : calm ? (
          <g stroke="#1F2A24" strokeWidth="4.5" strokeLinecap="round" fill="none">
            <path d="M66 154 Q78 164 90 154" />
            <path d="M110 154 Q122 164 134 154" />
          </g>
        ) : happy ? (
          <g stroke="#1F2A24" strokeWidth="4.5" strokeLinecap="round" fill="none">
            <path d="M66 158 Q78 142 90 158" />
            <path d="M110 158 Q122 142 134 158" />
          </g>
        ) : (
          <g>
            <g className="gb-blink">
              <ellipse cx="78" cy="152" rx="13" ry="15" fill="#fff" />
              <ellipse cx="79" cy="154" rx="8.5" ry="10.5" fill="#1F2A24" />
              <circle cx="82.5" cy="149" r="3.4" fill="#fff" />
              <circle cx="76" cy="158" r="1.6" fill="#fff" />
            </g>
            <g className="gb-blink">
              <ellipse cx="122" cy="152" rx="13" ry="15" fill="#fff" />
              <ellipse cx="121" cy="154" rx="8.5" ry="10.5" fill="#1F2A24" />
              <circle cx="124.5" cy="149" r="3.4" fill="#fff" />
              <circle cx="118" cy="158" r="1.6" fill="#fff" />
            </g>
          </g>
        )}

        {/* الفم */}
        {sad ? (
          <path d="M90 190 Q100 181 110 190" stroke="#5A2E1C" strokeWidth="4" strokeLinecap="round" fill="none" />
        ) : cheer ? (
          <g>
            <path d="M84 180 Q100 206 116 180 Z" fill="#5A2E1C" />
            <path d="M92 192 Q100 200 108 192 Q100 188 92 192 Z" fill="#FF8FAE" />
          </g>
        ) : happy ? (
          <path d="M88 182 Q100 200 112 182 Z" fill="#5A2E1C" />
        ) : calm ? (
          <path d="M92 186 Q100 192 108 186" stroke="#5A2E1C" strokeWidth="3.6" strokeLinecap="round" fill="none" />
        ) : (
          <path d="M90 184 Q100 194 110 184" stroke="#5A2E1C" strokeWidth="4" strokeLinecap="round" fill="none" />
        )}

        {/* الذراع اليمنى — تلوّح عند الفرح، وتلوّح مرتين ترحيبًا في الوضع الهادئ */}
        <g className={cheer ? "gb-wave" : mood === "idle" ? "gb-wave-idle" : undefined}>
          <ellipse cx="156" cy="172" rx="9" ry="15" fill="#D9694A" transform="rotate(-18 156 172)" />
        </g>

        {/* بريق حول النبتة المزهرة */}
        {s === 5 && (
          <g fill="#F0B94A">
            {[
              { t: "translate(40 40)", d: "0s" },
              { t: "translate(162 26) scale(1.2)", d: ".6s" },
              { t: "translate(168 96) scale(.8)", d: "1.1s" },
              { t: "translate(30 104) scale(.8)", d: "1.5s" },
            ].map((sp, i) => (
              <g key={i} transform={sp.t}>
                <path className="gb-twinkle" style={{ animationDelay: sp.d }} d={SPARKLE} />
              </g>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
