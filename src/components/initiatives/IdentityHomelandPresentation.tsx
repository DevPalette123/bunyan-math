import { useRef, useState } from "react";

const BASE = "/initiatives/identity-homeland";

type Wilaya = "nizwa" | "hamra" | "jabal" | "bahla";
type View = "cover" | "map" | Wilaya;

interface WilayaInfo {
  id: Wilaya;
  title: string;
  video: string;
  poster: string;
  portrait?: boolean;
  /** Full video on Drive — the "اضغط هنا" link from the original slide. */
  moreUrl: string;
}

const WILAYAS: WilayaInfo[] = [
  { id: "nizwa", title: "ولاية نزوى", video: `${BASE}/nizwa.mp4`, poster: `${BASE}/nizwa-poster.jpg`,
    moreUrl: "https://drive.google.com/file/d/1XZ43LODUrf9CFG7v4rCurGp5vaO2RS6W/view?usp=drivesdk" },
  { id: "hamra", title: "ولاية الحمراء", video: `${BASE}/hamra.mp4`, poster: `${BASE}/hamra-poster.jpg`, portrait: true,
    moreUrl: "https://drive.google.com/file/d/1zkuxdAQcWvEiGU4gyDQapOpYDl60fGvS/view?usp=drivesdk" },
  { id: "jabal", title: "الجبل الأخضر", video: `${BASE}/jabal.mp4`, poster: `${BASE}/jabal-poster.jpg`,
    moreUrl: "https://drive.google.com/file/d/1eACTUV11UMbzCE-YkcoI4Fzi15nCiAfg/view?usp=drive_link" },
  { id: "bahla", title: "ولاية بهلاء", video: `${BASE}/bahla.mp4`, poster: `${BASE}/bahla-poster.jpg`,
    moreUrl: "https://drive.google.com/file/d/1kIK0hw__lGM89NnmitY66I7l0IIGVO2Z/view?usp=drive_link" },
];

const STEPS: { id: View; label: string }[] = [
  { id: "cover", label: "الغلاف" },
  { id: "map", label: "الخريطة" },
  ...WILAYAS.map((w) => ({ id: w.id as View, label: w.title.replace("ولاية ", "") })),
];

interface IdentityHomelandPresentationProps {
  /** Fires once per wilaya video when it really reaches its end. */
  onVideoEnded?: (id: string) => void;
}

export default function IdentityHomelandPresentation({ onVideoEnded }: IdentityHomelandPresentationProps) {
  const [view, setView] = useState<View>("cover");
  const stageRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [speaking, setSpeaking] = useState(false);

  function go(next: View) {
    audioRef.current?.pause();
    setSpeaking(false);
    setView(next);
  }

  function toggleAudio() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play();
      setSpeaking(true);
    } else {
      a.pause();
      setSpeaking(false);
    }
  }

  function fullscreen() {
    stageRef.current?.requestFullscreen?.();
  }

  const wilaya = WILAYAS.find((w) => w.id === view);

  return (
    <section dir="rtl" className="w-full">
      {/* Step chips — jump to any part of the presentation */}
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1">
        {STEPS.map((s) => {
          const active = s.id === view;
          return (
            <button
              key={s.id}
              onClick={() => go(s.id)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-[13px] font-bold border transition ${
                active
                  ? "bg-ink-900 text-white border-ink-900"
                  : "bg-white text-ink-700 border-sand-200 hover:bg-sand-50"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div
        ref={stageRef}
        className="relative w-full rounded-3xl overflow-hidden shadow-soft bg-[#e9b27e] p-3 sm:p-6 flex flex-col"
        style={{ minHeight: 420 }}
      >
        {view === "cover" && (
          <div className="flex-1 grid md:grid-cols-2 gap-4 items-center">
            <div className="rounded-3xl bg-[#fff3dc] p-4 flex flex-col items-center text-center gap-3 order-2 md:order-1">
              <div className="flex items-center justify-center gap-4 w-full">
                <img src={`${BASE}/ministry-emblem.png`} alt="وزارة التعليم" className="h-14 object-contain" />
                <img src={`${BASE}/school-logo.png`} alt="مدرسة الزلفى" className="h-16 object-contain" />
                <img src={`${BASE}/oman-vision-2040.png`} alt="رؤية عمان 2040" className="h-12 object-contain" />
              </div>
              <h2 className="text-4xl sm:text-5xl font-extrabold text-ink-900 leading-tight">محافظة الداخلية</h2>
              <p className="text-sm text-ink-700 leading-loose">
                إعداد: أ. رحمة الخروصية
                <br />
                مديرة المدرسة: أ. ليلى الكيومية
              </p>
              <button
                onClick={() => go("map")}
                className="mt-1 px-8 py-2.5 rounded-2xl bg-ink-900 text-white font-extrabold text-sm shadow-soft"
              >
                ابدأ الرحلة
              </button>
            </div>
            <div className="rounded-3xl overflow-hidden bg-[#fff3dc] order-1 md:order-2">
              <video
                src={`${BASE}/intro.mp4`}
                className="w-full aspect-video object-contain"
                controls
                playsInline
                preload="metadata"
                aria-label="مقدمة العرض"
              />
            </div>
          </div>
        )}

        {view === "map" && (
          <div className="flex-1 flex flex-col items-center gap-4">
            <div className="flex items-center gap-3 w-full justify-between">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-ink-900">محافظة الداخلية</h2>
              <button
                onClick={toggleAudio}
                className="px-4 py-2 rounded-2xl bg-white text-ink-900 text-sm font-bold border border-sand-200"
              >
                {speaking ? "إيقاف الصوت" : "استمع للتعريف"}
              </button>
              <audio ref={audioRef} src={`${BASE}/map-narration.m4a`} onEnded={() => setSpeaking(false)} />
            </div>
            <p className="text-sm text-ink-700 self-start">اختر ولاية لتشاهد فيديو عنها:</p>
            <div className="w-full grid md:grid-cols-2 gap-4 items-center">
              <div className="rounded-3xl bg-[#fff3dc] p-4 flex justify-center">
                <img src={`${BASE}/dakhiliyah-map.png`} alt="خريطة محافظة الداخلية" className="max-h-72 object-contain" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {WILAYAS.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => go(w.id)}
                    className="group rounded-2xl overflow-hidden bg-white border border-sand-200 text-start shadow-soft hover:-translate-y-0.5 transition"
                  >
                    <img src={w.poster} alt="" className="w-full h-24 object-cover" />
                    <span className="block px-3 py-2 text-sm font-extrabold text-ink-900">{w.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {wilaya && (
          <div className="flex-1 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => go("map")}
                className="px-4 py-2 rounded-2xl bg-white text-ink-900 text-sm font-bold border border-sand-200"
              >
                ← رجوع للخريطة
              </button>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-ink-900">{wilaya.title}</h2>
            </div>
            <div className="rounded-3xl overflow-hidden bg-black flex justify-center">
              <video
                key={wilaya.id}
                src={wilaya.video}
                poster={wilaya.poster}
                controls
                playsInline
                preload="metadata"
                className={wilaya.portrait ? "max-h-[70vh] w-auto" : "w-full aspect-video"}
                onEnded={() => onVideoEnded?.(wilaya.id)}
                aria-label={`فيديو ${wilaya.title}`}
              />
            </div>
            <div className="flex items-center justify-between">
              <a
                href={wilaya.moreUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-bold text-ink-900 underline"
              >
                اضغط هنا لمشاهدة المزيد
              </a>
              <button
                onClick={fullscreen}
                className="px-4 py-2 rounded-2xl bg-white text-ink-900 text-sm font-bold border border-sand-200"
              >
                ملء الشاشة
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
