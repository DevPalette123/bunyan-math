import { useEffect, useRef, useState } from "react";
import type { StudentProfile } from "../data/types";
import { toArabicDigits } from "../utils/arabicNumerals";
import { getNotificationsEnabled } from "../lib/notificationPrefs";
import { BellIcon, StarIcon } from "./icons/Glyphs";

interface TopBarProps {
  student: StudentProfile;
}

export default function TopBar({ student }: TopBarProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const notificationsEnabled = getNotificationsEnabled();

  return (
    <header className="flex items-center gap-3 sm:gap-4 bg-white rounded-3xl shadow-soft px-4 sm:px-5 py-3 animate-rise-in">
      {/* Avatar + identity — name only, no grade/stage line beneath it */}
      <div className="flex items-center gap-3 rounded-2xl px-1 py-1">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-clay-400 to-rose-500 flex items-center justify-center text-white font-extrabold text-lg shrink-0">
          {student.avatarInitial}
        </div>
        <p className="text-sm font-extrabold text-ink-900 leading-tight text-start">{student.name}</p>
      </div>

      <div className="flex-1" />

      {/* Points — always the real, current value; 0 shows as 0 */}
      <div className="flex items-center gap-1.5 bg-sun-50 text-sun-500 font-extrabold px-3 py-2 rounded-2xl shrink-0">
        <StarIcon className="w-4 h-4" />
        <span className="text-sm">{toArabicDigits(student.stars)}</span>
      </div>

      {/* Notification bell — really opens a real panel; never shows
          fabricated notification items, since no real notifications
          system exists yet. */}
      <div className="relative" ref={panelRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="relative w-11 h-11 rounded-2xl bg-sand-100 flex items-center justify-center shrink-0 hover:bg-sand-200 transition-colors text-ink-700"
          aria-label="الإشعارات"
          aria-expanded={open}
        >
          <BellIcon className="w-5 h-5" />
        </button>

        {open && (
          <div className="absolute end-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-lift p-4 z-20 text-center">
            <p className="text-xs font-bold text-ink-700 leading-relaxed">
              {notificationsEnabled
                ? "لا توجد إشعارات جديدة حاليًا."
                : "الإشعارات متوقفة حاليًا من الإعدادات."}
            </p>
          </div>
        )}
      </div>
    </header>
  );
}
