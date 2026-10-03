import { useState } from "react";
import StudentShell from "../components/StudentShell";
import { getNotificationsEnabled, setNotificationsEnabled } from "../lib/notificationPrefs";
import { BellIcon } from "../components/icons/Glyphs";

export default function SettingsPage() {
  const [enabled, setEnabled] = useState(getNotificationsEnabled());

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setNotificationsEnabled(next);
  }

  return (
    <StudentShell activeId="settings">
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-900 text-center">الإعدادات</h1>

        {/* Only real, functional settings appear here — this toggle genuinely
            changes what the notification bell shows on the homepage. Sound
            and appearance options are intentionally left out: neither has a
            real underlying system in the project yet, and a switch with no
            real effect is worse than no switch at all. */}
        <div className="bg-white rounded-3xl shadow-soft p-5 sm:p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-sand-100 flex items-center justify-center shrink-0 text-ink-700">
              <BellIcon className="w-5 h-5" />
            </span>
            <div>
              <p className="text-sm font-extrabold text-ink-900">الإشعارات</p>
              <p className="text-xs text-ink-500">التحكم في تنبيهات الجرس أعلى الصفحة الرئيسية</p>
            </div>
          </div>

          <button
            onClick={toggle}
            role="switch"
            aria-checked={enabled}
            className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
              enabled ? "bg-palm-500" : "bg-sand-200"
            }`}
          >
            <span
              className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-soft transition-all ${
                enabled ? "start-6" : "start-1"
              }`}
            />
          </button>
        </div>
      </main>
    </StudentShell>
  );
}
