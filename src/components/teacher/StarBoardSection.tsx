import { useEffect, useMemo, useRef, useState } from "react";
import { toArabicDigits } from "../../utils/arabicNumerals";
import {
  addStarBoardEntries,
  addStarBoardEntry,
  adjustStarBoardStars,
  deleteAllStarBoardEntries,
  deleteStarBoardEntry,
  fetchStarBoard,
  type StarBoardEntry,
} from "../../lib/starBoard";
import { playStarAddedSound, playStarRemovedSound, primeAudioForInteraction } from "../../lib/sound";
import { MinusIcon, PlusIcon, StarIcon, TrashIcon } from "../icons/Glyphs";
import ConfirmDialog from "./ConfirmDialog";
import iconStarBoost from "../../assets/icons/icon-star-boost.png";

interface RosterStudent {
  id: string;
  full_name: string;
}

interface StarBoardSectionProps {
  classId: string;
  students: RosterStudent[];
}

// أنغام هادئة من لوحة المعلمة تتكرر على البطاقات، وتبقى لمسة الذهب (النجمة وزر
// الإضافة) هي الشيء الوحيد الدافئ فيها — فتقرأ اللوحة منظّمة ولطيفة لا صاخبة.
const CARD_THEMES = [
  { bg: "bg-teach-50", text: "text-teach-600", avatar: "bg-teach-100 text-teach-700" },
  { bg: "bg-mint-50", text: "text-mint-600", avatar: "bg-mint-100 text-mint-600" },
  { bg: "bg-lilac-50", text: "text-lilac-500", avatar: "bg-lilac-100 text-lilac-500" },
  { bg: "bg-slate-100", text: "text-slate-600", avatar: "bg-white text-slate-600" },
];

// شارات المراكز الثلاثة الأولى (لمن لديها نجمة واحدة على الأقل).
const RANK_STYLE = ["bg-sun-400 text-slate-900", "bg-slate-300 text-slate-800", "bg-clay-400 text-white"];

export default function StarBoardSection({ classId, students }: StarBoardSectionProps) {
  const [entries, setEntries] = useState<StarBoardEntry[] | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [adding, setAdding] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<StarBoardEntry | null>(null);
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // مفتاح يتغيّر مع كل نجمة مضافة لإعادة تشغيل حركة «+١» فوق تلك البطاقة فقط.
  const [bursts, setBursts] = useState<Record<string, number>>({});
  // عدد الطلبات المعلّقة لكل بطاقة: لا نستبدل الرقم المعروض بردّ الخادم إلا
  // حين لا يبقى طلب معلّق، فلا يرتدّ الرقم للخلف أثناء النقر السريع.
  const pending = useRef(new Map<string, number>());

  async function load() {
    const data = await fetchStarBoard(classId);
    setEntries(data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const availableStudents = useMemo(() => {
    const onBoard = new Set((entries ?? []).map((e) => e.studentId).filter(Boolean));
    return students.filter((s) => !onBoard.has(s.id));
  }, [students, entries]);

  const totalStars = useMemo(() => (entries ?? []).reduce((sum, e) => sum + e.stars, 0), [entries]);

  // مراكز أول ثلاث قيم مختلفة للنجوم (بالتساوي تتشارك الطالبات المركز نفسه).
  const rankOf = useMemo(() => {
    const distinct = [...new Set((entries ?? []).map((e) => e.stars).filter((n) => n > 0))]
      .sort((a, b) => b - a)
      .slice(0, 3);
    return new Map<number, number>(distinct.map((value, i): [number, number] => [value, i]));
  }, [entries]);

  const isSortedByStars = useMemo(
    () => (entries ?? []).every((e, i, all) => i === 0 || all[i - 1].stars >= e.stars),
    [entries]
  );

  async function handleAdd() {
    const student = availableStudents.find((s) => s.id === selectedStudentId);
    if (!student || adding) return;
    setAdding(true);
    setError(null);
    const { error: addError } = await addStarBoardEntry(classId, student.id, student.full_name);
    setAdding(false);
    if (addError) {
      setError("تعذّرت إضافة الطالبة. حاولي مرة أخرى.");
      return;
    }
    setSelectedStudentId("");
    await load();
  }

  async function handleAddAll() {
    if (availableStudents.length === 0 || adding) return;
    setAdding(true);
    setError(null);
    const { error: addError } = await addStarBoardEntries(classId, availableStudents);
    setAdding(false);
    if (addError) {
      setError("تعذّرت إضافة الطالبات. حدّثي الصفحة ثم حاولي مرة أخرى.");
      await load();
      return;
    }
    setSelectedStudentId("");
    await load();
  }

  async function handleChangeStars(entry: StarBoardEntry, delta: number) {
    primeAudioForInteraction();
    setError(null);

    // عرض فوري (متفائل)، والرقم الحقيقي يأتي من قاعدة البيانات بعد لحظة.
    setEntries((prev) =>
      prev?.map((e) => (e.id === entry.id ? { ...e, stars: Math.max(0, e.stars + delta) } : e)) ?? prev
    );
    if (delta > 0) {
      playStarAddedSound();
      setBursts((prev) => ({ ...prev, [entry.id]: (prev[entry.id] ?? 0) + 1 }));
    } else {
      playStarRemovedSound();
    }

    pending.current.set(entry.id, (pending.current.get(entry.id) ?? 0) + 1);
    const result = await adjustStarBoardStars(entry.id, delta);
    const left = (pending.current.get(entry.id) ?? 1) - 1;
    pending.current.set(entry.id, left);

    if ("error" in result) {
      setError("تعذّر حفظ التغيير. جارٍ إعادة التحميل...");
      await load();
      return;
    }
    if (left === 0) {
      setEntries((prev) => prev?.map((e) => (e.id === entry.id ? { ...e, stars: result.stars } : e)) ?? prev);
    }
  }

  function handleSortByStars() {
    setEntries((prev) => (prev ? [...prev].sort((a, b) => b.stars - a.stars) : prev));
  }

  async function handleDeleteEntry() {
    if (!entryToDelete) return;
    const target = entryToDelete;
    setDeleting(true);
    const { error: deleteError } = await deleteStarBoardEntry(target.id);
    setDeleting(false);
    setEntryToDelete(null);
    if (deleteError) {
      setError("تعذّر الحذف. حاولي مرة أخرى.");
      return;
    }
    setEntries((prev) => prev?.filter((e) => e.id !== target.id) ?? prev);
  }

  async function handleDeleteAll() {
    setDeleting(true);
    const { error: deleteError } = await deleteAllStarBoardEntries(classId);
    setDeleting(false);
    setConfirmingDeleteAll(false);
    if (deleteError) {
      setError("تعذّر حذف اللوحة. حاولي مرة أخرى.");
      return;
    }
    setEntries([]);
  }

  return (
    <section className="bg-white rounded-3xl shadow-soft p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0 flex-1 basis-56">
          <span className="w-12 h-12 rounded-2xl bg-sun-50 flex items-center justify-center shrink-0">
            <img src={iconStarBoost} alt="" className="w-9 h-9 object-contain" />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight">لوحة النجوم المرحة</h3>
            <p className="text-xs font-bold text-slate-400 mt-0.5">لوحة تحفيزية بيدكِ وحدكِ</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {entries && entries.length > 0 && (
            <span className="flex items-center gap-1.5 bg-sun-50 text-sun-600 font-extrabold text-sm rounded-full px-3.5 py-2">
              <StarIcon className="w-4 h-4" />
              {toArabicDigits(totalStars)}
            </span>
          )}
          {entries && entries.length > 0 && (
            <button
              onClick={() => setConfirmingDeleteAll(true)}
              className="text-xs font-extrabold text-rose-500 bg-rose-50/60 hover:bg-rose-50 px-3.5 py-2 rounded-full transition-colors"
            >
              حذف الكل
            </button>
          )}
        </div>
      </div>

      <p className="text-xs font-bold text-slate-500 leading-relaxed bg-slate-50 rounded-2xl px-4 py-3 mb-5">
        هذه اللوحة منفصلة عن نجوم الإنجاز الحقيقية لكل طالبة — لا تتأثر بأي درس أو اختبار أو لعبة، وأنتِ من يتحكّم بها بالكامل هنا.
      </p>

      {availableStudents.length > 0 && (
        <div className="flex flex-col gap-2.5 mb-5 bg-teach-50/60 rounded-2xl p-3.5">
          <div className="flex items-center gap-2">
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              aria-label="اختيار طالبة لإضافتها إلى اللوحة"
              className="flex-1 min-w-0 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teach-300 bg-white"
            >
              <option value="">اختاري طالبة لإضافتها...</option>
              {availableStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={!selectedStudentId || adding}
              className="flex items-center gap-1.5 bg-teach-500 hover:bg-teach-600 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl px-4 py-2.5 transition-colors shrink-0"
            >
              <PlusIcon className="w-4 h-4" />
              إضافة
            </button>
          </div>
          <button
            onClick={handleAddAll}
            disabled={adding}
            className="self-start text-xs font-extrabold text-teach-600 hover:bg-white disabled:opacity-50 rounded-lg px-3 py-1.5 transition-colors"
          >
            {adding ? "جارٍ الإضافة..." : `إضافة كل الطالبات إلى اللوحة (${toArabicDigits(availableStudents.length)})`}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs font-bold text-rose-500 bg-rose-50 rounded-xl px-3 py-2.5 mb-4">
          {error}
        </p>
      )}

      {entries === null ? (
        <p className="text-sm text-slate-500">جارٍ التحميل...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">
          {students.length === 0
            ? "أضيفي طالبات إلى صفك أولًا، ثم تظهر أسماؤهن هنا لتوزيع النجوم."
            : "لا توجد طالبات على اللوحة بعد — أضيفي الكل بضغطة واحدة أو اختاري طالبة من القائمة."}
        </p>
      ) : (
        <>
          {!isSortedByStars && (
            <button
              onClick={handleSortByStars}
              className="mb-4 text-xs font-extrabold text-teach-600 bg-teach-50 hover:bg-teach-100 rounded-full px-4 py-2 transition-colors"
            >
              رتّبي حسب النجوم
            </button>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {entries.map((entry, i) => {
              const theme = CARD_THEMES[i % CARD_THEMES.length];
              const rank = rankOf.get(entry.stars);
              return (
                <div
                  key={entry.id}
                  className={`relative flex flex-col gap-3 rounded-3xl p-4 border border-white shadow-soft ${theme.bg}`}
                >
                  {rank !== undefined && (
                    <span
                      className={`absolute -top-2 start-3 h-6 min-w-6 px-1.5 rounded-full text-[11px] font-extrabold flex items-center justify-center shadow-soft ${RANK_STYLE[rank]}`}
                      title={`المركز ${toArabicDigits(rank + 1)}`}
                    >
                      {toArabicDigits(rank + 1)}
                    </span>
                  )}

                  <div className="flex items-start gap-2 min-w-0">
                    <span
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base font-extrabold shrink-0 ${theme.avatar}`}
                      aria-hidden="true"
                    >
                      {entry.displayName.trim().charAt(0) || "؟"}
                    </span>
                    <p className={`flex-1 min-w-0 text-sm font-extrabold leading-snug break-words line-clamp-2 pt-0.5 ${theme.text}`}>
                      {entry.displayName}
                    </p>
                    <button
                      onClick={() => setEntryToDelete(entry)}
                      aria-label={`حذف ${entry.displayName} من اللوحة`}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white/80 hover:text-rose-500 transition-colors shrink-0"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="relative flex items-center justify-center gap-2 py-2 bg-white/70 rounded-2xl">
                    <StarIcon className="w-7 h-7 text-sun-400" />
                    <span
                      key={`stars-${entry.stars}`}
                      className="text-4xl font-extrabold text-slate-900 leading-none tabular-nums animate-streak-pop"
                      aria-label={`${entry.stars} نجوم`}
                    >
                      {toArabicDigits(entry.stars)}
                    </span>
                    {bursts[entry.id] ? (
                      <span
                        key={`burst-${bursts[entry.id]}`}
                        className="pointer-events-none absolute top-0 inset-x-0 mx-auto w-fit text-sm font-extrabold text-sun-600 animate-float-up"
                        aria-hidden="true"
                      >
                        +١
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleChangeStars(entry, -1)}
                      disabled={entry.stars === 0}
                      aria-label={`إنقاص نجمة من ${entry.displayName}`}
                      className="w-11 h-11 rounded-xl flex items-center justify-center bg-white text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-colors shrink-0"
                    >
                      <MinusIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleChangeStars(entry, 1)}
                      aria-label={`إضافة نجمة إلى ${entry.displayName}`}
                      className="flex-1 h-11 rounded-xl flex items-center justify-center gap-1.5 bg-sun-400 hover:bg-sun-500 active:scale-[0.97] text-slate-900 font-extrabold text-sm shadow-soft transition-[transform,background-color]"
                    >
                      <PlusIcon className="w-4 h-4" />
                      نجمة
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {entryToDelete && (
        <ConfirmDialog
          title={`حذف ${entryToDelete.displayName} من اللوحة؟`}
          description="ستُحذف نجومها في هذه اللوحة نهائيًا، ويمكنك إضافتها مجددًا لاحقًا من القائمة."
          confirmLabel="حذف"
          loading={deleting}
          onConfirm={handleDeleteEntry}
          onCancel={() => setEntryToDelete(null)}
        />
      )}

      {confirmingDeleteAll && (
        <ConfirmDialog
          title="حذف لوحة النجوم بالكامل؟"
          description="سيُحذف كل الطالبات والنجوم في هذه اللوحة نهائيًا. لا يمكن التراجع عن هذا الإجراء."
          confirmLabel="حذف الكل"
          loading={deleting}
          onConfirm={handleDeleteAll}
          onCancel={() => setConfirmingDeleteAll(false)}
        />
      )}
    </section>
  );
}
