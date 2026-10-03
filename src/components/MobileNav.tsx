import { useState } from "react";
import logoMark from "../assets/logo/logo-mark.png";
import { navItems, settingsNavItem, COMING_SOON_IDS } from "../data/navigation";
import { LogOutIcon, MenuIcon } from "./icons/Glyphs";

interface MobileNavProps {
  activeId: string;
  onSelect: (id: string) => void;
  onNavigate: (label: string) => void;
  onSignOut?: () => void;
}

const PRIMARY_MOBILE_IDS = ["home", "practice", "play", "quiz"];

export default function MobileNav({ activeId, onSelect, onNavigate, onSignOut }: MobileNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const primaryItems = navItems.filter((item) => PRIMARY_MOBILE_IDS.includes(item.id));

  return (
    <>
      {/* Slide-out full menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/40" onClick={() => setMenuOpen(false)} />
          <div className="absolute top-0 bottom-0 start-0 w-72 bg-white shadow-lift p-5 flex flex-col animate-rise-in">
            <div className="flex items-center gap-3 px-1 mb-6">
              <img src={logoMark} alt="بنيان الرياضيات" className="w-10 h-10 object-contain shrink-0" />
              <h1 className="text-base font-extrabold text-ink-900">بنيان الرياضيات</h1>
            </div>
            <nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
              {navItems.map((item) => {
                const comingSoon = COMING_SOON_IDS.includes(item.id);
                return (
                  <button
                    key={item.id}
                    disabled={comingSoon}
                    onClick={() => {
                      if (comingSoon) return;
                      onSelect(item.id);
                      onNavigate(item.label);
                      setMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[15px] font-bold transition-colors text-start ${
                      comingSoon
                        ? "text-ink-400 cursor-not-allowed opacity-70"
                        : item.id === activeId
                          ? "bg-palm-50 text-palm-700"
                          : "text-ink-700 hover:bg-sand-100"
                    }`}
                  >
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
                      <img src={item.icon} alt="" className="w-6 h-6 object-contain" />
                    </span>
                    <span>{item.label}</span>
                    {comingSoon && (
                      <span className="ms-auto text-[10px] font-extrabold text-ink-400 bg-sand-100 px-2 py-0.5 rounded-full shrink-0">
                        قريبًا
                      </span>
                    )}
                  </button>
                );
              })}
              <button
                onClick={() => {
                  onSelect("settings");
                  onNavigate(settingsNavItem.label);
                  setMenuOpen(false);
                }}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[15px] font-bold text-ink-700 hover:bg-sand-100"
              >
                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
                  <img src={settingsNavItem.icon} alt="" className="w-6 h-6 object-contain" />
                </span>
                <span>{settingsNavItem.label}</span>
              </button>
              {onSignOut && (
                <button
                  onClick={() => {
                    onSignOut();
                    setMenuOpen(false);
                  }}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[15px] font-bold text-rose-500 hover:bg-rose-50"
                >
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
                    <LogOutIcon className="w-5 h-5" />
                  </span>
                  <span>تسجيل الخروج</span>
                </button>
              )}
            </nav>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-sand-200 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-between">
        {primaryItems.map((item) => {
          const comingSoon = COMING_SOON_IDS.includes(item.id);
          return (
            <button
              key={item.id}
              disabled={comingSoon}
              onClick={() => {
                if (comingSoon) return;
                onSelect(item.id);
                onNavigate(item.label);
              }}
              aria-label={comingSoon ? `${item.label} — قريبًا` : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl ${
                comingSoon ? "opacity-40" : ""
              }`}
            >
              <span
                className={`w-7 h-7 flex items-center justify-center transition-transform ${
                  item.id === activeId ? "scale-110" : ""
                }`}
              >
                <img src={item.icon} alt="" className="w-full h-full object-contain" />
              </span>
              <span
                className={`text-[11px] font-bold ${
                  item.id === activeId ? "text-palm-600" : "text-ink-500"
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
        <button
          onClick={() => setMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl"
        >
          <MenuIcon className="w-6 h-6 text-ink-500" />
          <span className="text-[11px] font-bold text-ink-500">المزيد</span>
        </button>
      </nav>
    </>
  );
}
