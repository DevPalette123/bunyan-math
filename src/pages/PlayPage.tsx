import { useEffect, useState } from "react";
import StudentShell from "../components/StudentShell";
import GameCard from "../components/practice/GameCard";
import { playGames } from "../data/playGames";
import type { FunGameId } from "../data/funGames";
import { fetchMyBestStars } from "../lib/funGames";
import { useAuth } from "../context/AuthContext";
import iconPlay from "../assets/icons/icon-play.png";

type BestMap = Partial<Record<FunGameId, number>>;

export default function PlayPage() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  // أفضل نجوم الطالب الحالية من fun_game_results. نحفظ معها معرّف صاحبتها حتى
  // لا تُعرض أبدًا نتيجة حساب آخر، وأثناء التحميل أو عند الخطأ تبقى النجوم غير مضيئة.
  const [loaded, setLoaded] = useState<{ userId: string; best: BestMap } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void fetchMyBestStars(userId).then((best) => {
      if (!cancelled) setLoaded({ userId, best: best ?? {} });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const bestByGame: BestMap = loaded && loaded.userId === userId ? loaded.best : {};

  return (
    <StudentShell activeId="play">
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 flex flex-col gap-6 sm:gap-7 pb-24 lg:pb-10">
        <section className="flex flex-col items-center text-center gap-2 animate-rise-in">
          <span className="w-16 h-16 rounded-3xl bg-berry-50 flex items-center justify-center">
            <img src={iconPlay} alt="" className="w-11 h-11 object-contain" />
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-900">العب</h1>
          <p className="text-sm sm:text-base font-bold text-ink-500">اختر مهارة والعب وتعلّم</p>
        </section>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
          {playGames.map((game) => (
            <GameCard key={game.id} game={game} best={bestByGame[game.id as FunGameId] ?? 0} />
          ))}
        </div>
      </main>
    </StudentShell>
  );
}
