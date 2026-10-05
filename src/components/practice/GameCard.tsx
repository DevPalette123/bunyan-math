import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PlayGame } from "../../data/playGames";
import { findFunGame, hasLevels } from "../../data/funGames";
import { ChevronIcon, PlayGameIcon } from "../icons/Glyphs";

interface GameCardProps {
  game: PlayGame;
  /** أفضل نتيجة (٠–٣) للطالب الحالية في هذه اللعبة، تأتي من قاعدة البيانات عبر PlayPage. */
  best?: number;
}

type OpenState = "idle" | "checking" | "missing";

export default function GameCard({ game, best = 0 }: GameCardProps) {
  const [state, setState] = useState<OpenState>("idle");
  const navigate = useNavigate();

  // الألعاب المبنية داخل المنصة (مغامرة الجمع/الطرح الآن، وأي لعبة تُضاف
  // لاحقًا بنفس محرّك GamePage) تُفتح كصفحة داخلية، لا كملف HTML خارجي.
  // لكل مهارة الآن لعبة بفكرة مختلفة (data/funGames.ts). لإعادة اللعبة القديمة
  // (سؤال فأربع خيارات المرتبطة بقاعدة البيانات) استبدل المسار بـ `/play/${game.id}`.
  const fun = findFunGame(game.id);

  async function handleOpen() {
    if (fun) {
      navigate(`/play/fun/${fun.id}`);
      return;
    }
    if (state === "checking") return;
    setState("checking");
    try {
      const response = await fetch(game.gameUrl);
      if (!response.ok) {
        setState("missing");
        return;
      }
      // Unlike the PDF worksheets, a game may be more than one file (its
      // own script/style/image assets loaded by *relative* path) — so we
      // open the real URL directly rather than a blob copy, which would
      // break those relative references. That means we can't tell a real
      // game apart from a missing one purely by content-type the way we
      // did for PDFs; instead we check the fetched text doesn't look like
      // our own app's shell — which is what a static host serves for any
      // unmatched path instead of a real 404.
      const text = await response.text();
      if (text.includes('id="root"') || text.includes("/src/main.tsx")) {
        setState("missing");
        return;
      }
      window.open(game.gameUrl, "_blank", "noopener,noreferrer");
      setState("idle");
    } catch {
      setState("missing");
    }
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={state === "checking"}
      className="group flex flex-col items-center text-center gap-3 rounded-3xl bg-white p-5 sm:p-6 shadow-soft hover:shadow-lift hover:-translate-y-1 transition-all duration-300 disabled:cursor-wait animate-pop-in"
    >
      <span className="relative w-full flex items-center justify-center">
        <img
          src={game.icon}
          alt={game.title}
          className="w-full h-auto object-contain rounded-2xl group-hover:scale-105 transition-transform duration-300"
        />
        {state === "checking" && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-2xl">
            <span className="w-6 h-6 rounded-full border-2 border-berry-300 border-t-berry-600 animate-spin" />
          </span>
        )}
      </span>

      <h3 className="text-sm sm:text-base font-extrabold text-ink-900">{game.title}</h3>
      {fun && (
        <>
          <span className="text-[11px] sm:text-xs font-bold text-ink-500 -mt-1.5">
            <span aria-hidden="true">{fun.emoji} </span>
            {fun.title}
          </span>
          {hasLevels(game.id) && (
            <span className="text-[10px] sm:text-[11px] font-extrabold text-palm-600 bg-palm-50 rounded-full px-2.5 py-0.5">
              ٣ مستويات
            </span>
          )}
          <span className="text-xs tracking-widest -mt-1" aria-label={`أفضل نتيجة ${best} من ٣ نجوم`}>
            {[1, 2, 3].map((n) => (
              <span key={n} className={n <= best ? "" : "opacity-20 grayscale"}>
                ⭐
              </span>
            ))}
          </span>
        </>
      )}

      {state === "missing" ? (
        <span className="text-xs font-bold text-rose-500 leading-relaxed animate-rise-in">
          هذه اللعبة غير متوفرة حاليًا، سيتم إضافتها قريبًا.
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-xs font-bold text-ink-500">
          <PlayGameIcon className="w-3.5 h-3.5" />
          العب الآن
          <ChevronIcon className="w-3 h-3 rotate-180" />
        </span>
      )}
    </button>
  );
}
