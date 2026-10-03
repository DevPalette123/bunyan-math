import type { ReactNode } from "react";

export type Mood = "idle" | "happy" | "sad";
export type CritterKind = "frog" | "monkey" | "owl" | "penguin" | "croc" | "bunny" | "ball";

const INK = "#2B2B2B";

function Eyes({ x1, x2, y, r = 7, mood }: { x1: number; x2: number; y: number; r?: number; mood: Mood }) {
  if (mood === "happy") {
    const d = (x: number) => `M${x - r * 0.85} ${y + 2} q${r * 0.85} ${-r * 1.4} ${r * 1.7} 0`;
    return (
      <g stroke={INK} strokeWidth="3.4" fill="none" strokeLinecap="round">
        <path d={d(x1)} />
        <path d={d(x2)} />
      </g>
    );
  }
  return (
    <g>
      <g className="fun-blink">
        <circle cx={x1} cy={y} r={r} fill="#fff" />
        <circle cx={x2} cy={y} r={r} fill="#fff" />
        <circle cx={x1} cy={y + 1} r={r * 0.58} fill={INK} />
        <circle cx={x2} cy={y + 1} r={r * 0.58} fill={INK} />
        <circle cx={x1 + r * 0.22} cy={y - r * 0.15} r={r * 0.22} fill="#fff" />
        <circle cx={x2 + r * 0.22} cy={y - r * 0.15} r={r * 0.22} fill="#fff" />
      </g>
      {mood === "sad" && (
        <g stroke={INK} strokeWidth="3" strokeLinecap="round">
          <path d={`M${x1 - r} ${y - r - 3} L${x1 + r * 0.7} ${y - r - 7}`} />
          <path d={`M${x2 + r} ${y - r - 3} L${x2 - r * 0.7} ${y - r - 7}`} />
        </g>
      )}
    </g>
  );
}

function Mouth({ x, y, w = 12, mood }: { x: number; y: number; w?: number; mood: Mood }) {
  if (mood === "happy") {
    return (
      <g>
        <path d={`M${x - w} ${y} Q${x} ${y + w * 1.7} ${x + w} ${y} Z`} fill="#7A2E3A" />
        <path d={`M${x - w * 0.5} ${y + w * 0.78} Q${x} ${y + w * 0.35} ${x + w * 0.5} ${y + w * 0.78} Q${x} ${y + w * 1.1} ${x - w * 0.5} ${y + w * 0.78}Z`} fill="#FF8FA3" />
      </g>
    );
  }
  if (mood === "sad") {
    return <path d={`M${x - w * 0.7} ${y + 5} Q${x} ${y - w * 0.5} ${x + w * 0.7} ${y + 5}`} stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />;
  }
  return <path d={`M${x - w * 0.7} ${y} Q${x} ${y + w * 0.75} ${x + w * 0.7} ${y}`} stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />;
}

const Cheeks = ({ x1, x2, y, r = 6 }: { x1: number; x2: number; y: number; r?: number }) => (
  <g fill="#FF9FB0" opacity=".55">
    <circle cx={x1} cy={y} r={r} />
    <circle cx={x2} cy={y} r={r} />
  </g>
);

const Shadow = () => <ellipse cx="60" cy="113" rx="32" ry="5" fill="#000" opacity=".1" />;

function Body({ kind, mood, open }: { kind: CritterKind; mood: Mood; open: boolean }): ReactNode {
  switch (kind) {
    case "frog":
      return (
        <>
          <Shadow />
          <ellipse cx="24" cy="96" rx="16" ry="10" fill="#3FA55A" />
          <ellipse cx="96" cy="96" rx="16" ry="10" fill="#3FA55A" />
          <ellipse cx="60" cy="74" rx="38" ry="32" fill="#5BC56F" />
          <ellipse cx="60" cy="87" rx="24" ry="18" fill="#D5F3CF" />
          <circle cx="40" cy="42" r="15" fill="#5BC56F" />
          <circle cx="80" cy="42" r="15" fill="#5BC56F" />
          <Eyes x1={40} x2={80} y={42} r={9} mood={mood} />
          <Cheeks x1={28} x2={92} y={68} />
          <Mouth x={60} y={66} w={16} mood={mood} />
          <ellipse cx="42" cy="105" rx="11" ry="6" fill="#3FA55A" />
          <ellipse cx="78" cy="105" rx="11" ry="6" fill="#3FA55A" />
        </>
      );
    case "monkey":
      return (
        <>
          <Shadow />
          <path d="M88 104 Q116 100 112 78 Q110 66 100 70" stroke="#7A4E2D" strokeWidth="7" fill="none" strokeLinecap="round" />
          <ellipse cx="60" cy="102" rx="26" ry="16" fill="#8B5E3C" />
          <ellipse cx="60" cy="104" rx="14" ry="9" fill="#F3D2A8" />
          <circle cx="24" cy="54" r="14" fill="#8B5E3C" />
          <circle cx="24" cy="54" r="8" fill="#F3D2A8" />
          <circle cx="96" cy="54" r="14" fill="#8B5E3C" />
          <circle cx="96" cy="54" r="8" fill="#F3D2A8" />
          <circle cx="60" cy="54" r="34" fill="#8B5E3C" />
          <circle cx="48" cy="52" r="13" fill="#F3D2A8" />
          <circle cx="72" cy="52" r="13" fill="#F3D2A8" />
          <ellipse cx="60" cy="66" rx="24" ry="19" fill="#F3D2A8" />
          <Eyes x1={49} x2={71} y={52} r={6.5} mood={mood} />
          <ellipse cx="60" cy="64" rx="3.2" ry="2.2" fill="#7A4E2D" />
          <Mouth x={60} y={70} w={11} mood={mood} />
          <Cheeks x1={38} x2={82} y={66} r={5} />
        </>
      );
    case "owl":
      return (
        <>
          <Shadow />
          <ellipse cx="22" cy="76" rx="11" ry="24" fill="#7458A8" transform="rotate(12 22 76)" />
          <ellipse cx="98" cy="76" rx="11" ry="24" fill="#7458A8" transform="rotate(-12 98 76)" />
          <ellipse cx="60" cy="68" rx="36" ry="42" fill="#8A6BBE" />
          <ellipse cx="60" cy="86" rx="23" ry="22" fill="#EADFF8" />
          <path d="M48 80 q4 4 8 0 M60 80 q4 4 8 0 M54 90 q4 4 8 0" stroke="#C9B6E8" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M30 36 L34 14 L52 30Z" fill="#8A6BBE" />
          <path d="M90 36 L86 14 L68 30Z" fill="#8A6BBE" />
          <circle cx="44" cy="54" r="15" fill="#fff" stroke="#6A4E9A" strokeWidth="2.5" />
          <circle cx="76" cy="54" r="15" fill="#fff" stroke="#6A4E9A" strokeWidth="2.5" />
          <Eyes x1={44} x2={76} y={54} r={9} mood={mood} />
          <path d="M54 64 L66 64 L60 77Z" fill="#F5A623" />
          <ellipse cx="46" cy="110" rx="9" ry="4" fill="#F5A623" />
          <ellipse cx="74" cy="110" rx="9" ry="4" fill="#F5A623" />
          {/* قبعة التخرّج */}
          <polygon points="26,28 60,12 94,28 60,42" fill="#2B2B3A" />
          <rect x="46" y="38" width="28" height="9" rx="3" fill="#2B2B3A" />
          <path d="M94 28 L99 46" stroke="#F5C242" strokeWidth="3" />
          <circle cx="99" cy="48" r="3.6" fill="#F5C242" />
        </>
      );
    case "penguin":
      return (
        <>
          <Shadow />
          <ellipse cx="22" cy="74" rx="9" ry="22" fill="#27415A" transform="rotate(14 22 74)" />
          <ellipse cx="98" cy="74" rx="9" ry="22" fill="#27415A" transform="rotate(-14 98 74)" />
          <ellipse cx="60" cy="68" rx="34" ry="42" fill="#2E4A62" />
          <ellipse cx="60" cy="80" rx="22" ry="30" fill="#fff" />
          <ellipse cx="60" cy="50" rx="24" ry="19" fill="#fff" />
          <Eyes x1={50} x2={70} y={47} r={6} mood={mood} />
          <Cheeks x1={42} x2={78} y={57} r={4.5} />
          <path d="M53 55 Q60 51 67 55 Q60 68 53 55Z" fill="#F5A623" />
          <path d="M30 78 Q60 92 90 78 L90 88 Q60 102 30 88Z" fill="#E4526F" />
          <rect x="78" y="84" width="9" height="22" rx="4" fill="#E4526F" />
          <ellipse cx="46" cy="110" rx="12" ry="5" fill="#F5A623" />
          <ellipse cx="74" cy="110" rx="12" ry="5" fill="#F5A623" />
        </>
      );
    case "croc":
      return (
        <>
          <Shadow />
          <ellipse cx="60" cy="72" rx="40" ry="17" fill="#5C2230" />
          <g style={{ transform: `translateY(${open ? 14 : 0}px)`, transition: "transform .28s ease-out" }}>
            <path d="M18 70 Q18 108 60 108 Q102 108 102 70 Z" fill="#4FB36B" />
            <path d="M26 72 Q60 96 94 72 Z" fill="#7A2E3A" />
            <ellipse cx="60" cy="86" rx="14" ry="6" fill="#FF8FA3" />
            <path d="M34 72 l5 -9 l5 9Z M76 72 l5 -9 l5 9Z" fill="#fff" />
          </g>
          <path d="M16 72 Q12 28 60 26 Q108 28 104 72 Q60 62 16 72Z" fill="#4FB36B" />
          <path d="M28 68 l6 10 l6 -8Z M52 66 l6 10 l6 -10Z M80 68 l-6 10 l-6 -8Z" fill="#fff" />
          <circle cx="38" cy="30" r="14" fill="#4FB36B" />
          <circle cx="82" cy="30" r="14" fill="#4FB36B" />
          <Eyes x1={38} x2={82} y={30} r={8.5} mood={mood} />
          <circle cx="50" cy="48" r="2.6" fill="#2F7F49" />
          <circle cx="70" cy="48" r="2.6" fill="#2F7F49" />
          <path d="M40 14 q6 -8 10 0 M70 14 q6 -8 10 0" stroke="#2F7F49" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      );
    case "bunny":
      return (
        <>
          <Shadow />
          <g transform="rotate(-6 44 52)">
            <ellipse cx="44" cy="26" rx="9" ry="26" fill="#fff" stroke="#E6D9CC" strokeWidth="2" />
            <ellipse cx="44" cy="28" rx="4.5" ry="18" fill="#FFC1CF" />
          </g>
          <g transform="rotate(6 76 52)">
            <ellipse cx="76" cy="26" rx="9" ry="26" fill="#fff" stroke="#E6D9CC" strokeWidth="2" />
            <ellipse cx="76" cy="28" rx="4.5" ry="18" fill="#FFC1CF" />
          </g>
          <ellipse cx="60" cy="102" rx="25" ry="16" fill="#fff" stroke="#E6D9CC" strokeWidth="2" />
          <circle cx="60" cy="68" r="30" fill="#fff" stroke="#E6D9CC" strokeWidth="2" />
          <Eyes x1={48} x2={72} y={64} r={6} mood={mood} />
          <Cheeks x1={39} x2={81} y={75} r={5} />
          <ellipse cx="60" cy="73" rx="4" ry="3" fill="#FF8FA3" />
          <Mouth x={60} y={77} w={9} mood={mood} />
        </>
      );
    case "ball":
      return (
        <>
          <Shadow />
          <defs>
            <radialGradient id="critterBall" cx="35%" cy="30%" r="80%">
              <stop offset="0%" stopColor="#FFC768" />
              <stop offset="100%" stopColor="#F08A24" />
            </radialGradient>
          </defs>
          <circle cx="60" cy="64" r="44" fill="url(#critterBall)" />
          <path d="M22 54 Q60 30 98 54" stroke="#fff" opacity=".35" strokeWidth="6" fill="none" strokeLinecap="round" />
          <Eyes x1={45} x2={75} y={58} r={7.5} mood={mood} />
          <Cheeks x1={34} x2={86} y={74} r={6} />
          <Mouth x={60} y={74} w={13} mood={mood} />
        </>
      );
  }
}

const MOOD_CLASS: Record<Mood, string> = { idle: "fun-bob", happy: "fun-hop", sad: "fun-wobble" };

/** شخصية متحركة: تتنفّس وتتحرك في الانتظار، وتقفز فرحًا أو تهتزّ عند الخطأ. */
export default function Critter({
  kind,
  mood = "idle",
  open = false,
  className = "w-24 h-24",
}: {
  kind: CritterKind;
  mood?: Mood;
  /** فم التمساح مفتوح. */
  open?: boolean;
  className?: string;
}) {
  return (
    <div className={className} aria-hidden="true">
      <div key={mood} className={`w-full h-full ${MOOD_CLASS[mood]}`}>
        <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible">
          <Body kind={kind} mood={mood} open={open} />
        </svg>
      </div>
    </div>
  );
}

/** قاطرة القطار (تواجه اليسار) بوجه مبتسم ودخان متحرك. */
export function TrainEngine({ mood = "idle", className = "w-28" }: { mood?: Mood; className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <div key={mood} className={`${MOOD_CLASS[mood]}`}>
        <svg viewBox="0 0 150 112" className="w-full overflow-visible">
          <circle className="fun-steam" cx="40" cy="8" r="7" fill="#fff" />
          <circle className="fun-steam" style={{ animationDelay: ".6s" }} cx="40" cy="8" r="6" fill="#fff" />
          <circle className="fun-steam" style={{ animationDelay: "1.2s" }} cx="40" cy="8" r="5" fill="#fff" />
          <rect x="30" y="16" width="18" height="26" rx="3" fill="#2E4A62" />
          <rect x="26" y="12" width="26" height="8" rx="3" fill="#2E4A62" />
          <rect x="14" y="38" width="88" height="44" rx="20" fill="#E85D75" />
          <rect x="92" y="24" width="44" height="58" rx="6" fill="#C9455E" />
          <rect x="88" y="18" width="52" height="9" rx="4" fill="#2E4A62" />
          <rect x="104" y="34" width="20" height="18" rx="4" fill="#CFE9FA" />
          <Eyes x1={38} x2={66} y={57} r={7.5} mood={mood} />
          <Cheeks x1={28} x2={76} y={69} r={4.5} />
          <Mouth x={52} y={68} w={10} mood={mood} />
          <rect x="10" y="80" width="130" height="10" rx="4" fill="#2E4A62" />
          <circle cx="36" cy="96" r="13" fill="#2E4A62" />
          <circle cx="36" cy="96" r="5" fill="#F5C242" />
          <circle cx="72" cy="96" r="13" fill="#2E4A62" />
          <circle cx="72" cy="96" r="5" fill="#F5C242" />
          <circle cx="118" cy="96" r="13" fill="#2E4A62" />
          <circle cx="118" cy="96" r="5" fill="#F5C242" />
          <circle cx="12" cy="60" r="6" fill="#FFE27A" />
          <rect x="136" y="84" width="14" height="5" rx="2" fill="#2E4A62" />
        </svg>
      </div>
    </div>
  );
}
