import type { GameTheme } from "../../data/playGameThemes";

export type MascotMood = "idle" | "happy" | "sad" | "cheer";
export type MascotShape = "circle" | "star" | "cloud";
export type MascotAccessory = "crown" | "cap" | "antenna" | "bow";

interface MascotProps {
  theme: Pick<GameTheme, "mascot">;
  mood: MascotMood;
  className?: string;
}

const MOOD_ANIMATION: Record<MascotMood, string> = {
  idle: "animate-mascot-float",
  happy: "animate-mascot-hop",
  cheer: "animate-mascot-hop",
  sad: "animate-mascot-wobble",
};

/**
 * شخصية بسيطة (دائرة بعينين وخدّين) بدل رسم معقّد — تتحرك وتغيّر تعبيرها،
 * وهذا وحده يكفي ليشعر الطفل أن هناك «صديقًا» يلعب معه، دون رسم مزدحم.
 */
export default function Mascot({ theme, mood, className = "w-28 h-28" }: MascotProps) {
  const { body, dark, accessory, shape = "circle" } = theme.mascot;
  const eyesClosed = mood === "sad";
  const bigSmile = mood === "happy" || mood === "cheer";

  return (
    <div className={`${className} ${MOOD_ANIMATION[mood]}`} style={{ transformOrigin: "50% 85%" }}>
      <svg viewBox="0 0 120 120" className="w-full h-full" role="img" aria-hidden="true">
        {/* ظل أرضي */}
        <ellipse cx="60" cy="108" rx="30" ry="6" fill={dark} opacity="0.18" />

        {/* الجسم — شكل مختلف لكل مجموعة ألعاب حتى لا تبدو الشخصيات متكررة */}
        {shape === "star" ? (
          <path
            d="M60 16 L71 46 L103 48 L78 68 L87 100 L60 82 L33 100 L42 68 L17 48 L49 46 Z"
            fill={body}
          />
        ) : shape === "cloud" ? (
          <path
            d="M32 78 a20 20 0 0 1 6-39 a24 24 0 0 1 46-6 a18 18 0 0 1 2 45 Z"
            fill={body}
          />
        ) : (
          <circle cx="60" cy="62" r="42" fill={body} />
        )}
        <circle cx="60" cy="62" r="42" fill="url(#mascotShine)" />

        {/* الإكسسوار */}
        {accessory === "crown" && (
          <path d="M38 30 L46 44 L60 24 L74 44 L82 30 L82 40 L38 40 Z" fill="#FFF3C4" stroke={dark} strokeWidth="2" strokeLinejoin="round" />
        )}
        {accessory === "cap" && (
          <path d="M30 38 Q60 10 90 38 L90 46 Q60 34 30 46 Z" fill={dark} />
        )}
        {accessory === "antenna" && (
          <>
            <line x1="60" y1="14" x2="60" y2="30" stroke={dark} strokeWidth="3" strokeLinecap="round" />
            <circle cx="60" cy="10" r="6" fill="#FFF3C4" stroke={dark} strokeWidth="2" />
          </>
        )}
        {accessory === "bow" && (
          <path
            d="M60 40 L44 30 Q40 40 44 48 L60 40 L76 48 Q80 40 76 30 Z"
            fill="#F08AA0"
            stroke={dark}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )}

        {/* الخدود */}
        <circle cx="38" cy="70" r="7" fill="#fff" opacity="0.35" />
        <circle cx="82" cy="70" r="7" fill="#fff" opacity="0.35" />

        {/* العينان */}
        {eyesClosed ? (
          <>
            <path d="M42 58 Q48 64 54 58" stroke={dark} strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M66 58 Q72 64 78 58" stroke={dark} strokeWidth="3" strokeLinecap="round" fill="none" />
          </>
        ) : (
          <>
            <circle cx="48" cy="58" r="5.5" fill={dark} />
            <circle cx="72" cy="58" r="5.5" fill={dark} />
            <circle cx="49.5" cy="56" r="1.6" fill="#fff" />
            <circle cx="73.5" cy="56" r="1.6" fill="#fff" />
          </>
        )}

        {/* الفم */}
        {bigSmile ? (
          <path d="M46 76 Q60 92 74 76" stroke={dark} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        ) : mood === "sad" ? (
          <path d="M48 80 Q60 72 72 80" stroke={dark} strokeWidth="3" strokeLinecap="round" fill="none" />
        ) : (
          <path d="M50 78 Q60 84 70 78" stroke={dark} strokeWidth="3" strokeLinecap="round" fill="none" />
        )}

        <defs>
          <radialGradient id="mascotShine" cx="38%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}
