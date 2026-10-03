import logoMark from "../assets/logo/logo-mark.png";
import { navItems, settingsNavItem, COMING_SOON_IDS } from "../data/navigation";
import { LogOutIcon } from "./icons/Glyphs";

interface SidebarProps {
  activeId: string;
  onSelect: (id: string) => void;
  onNavigate: (label: string) => void;
  onSignOut?: () => void;
}

export default function Sidebar({ activeId, onSelect, onNavigate, onSignOut }: SidebarProps) {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 shrink-0 h-screen sticky top-0 bg-white border-s border-sand-200 px-4 py-6">
      {/* Platform identity — real logo asset, no emoji */}
      <div className="flex items-center gap-2.5 px-1.5 mb-8">
        <img src={logoMark} alt="بنيان الرياضيات" className="w-11 h-11 object-contain shrink-0" />
        <div className="min-w-0">
          <h1 className="text-[15px] font-extrabold text-ink-900 leading-tight truncate">
            بنيان الرياضيات
          </h1>
          <p className="text-[10.5px] text-ink-500 leading-snug mt-0.5">
            بالعلم نبني وطنًا
            <br />
            وبالرياضيات نبني مهاراتنا
          </p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.id === activeId;
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
              className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-bold transition-colors duration-200 text-start ${
                comingSoon
                  ? "text-ink-400 cursor-not-allowed opacity-70"
                  : isActive
                    ? "bg-palm-50 text-palm-700"
                    : "text-ink-700 hover:bg-sand-100"
              }`}
            >
              {/* Active indicator bar */}
              <span
                className={`absolute inset-y-2 start-0 w-1 rounded-full bg-palm-500 transition-opacity duration-200 ${
                  isActive ? "opacity-100" : "opacity-0"
                }`}
              />
              <span
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 ${
                  isActive ? "bg-white shadow-soft scale-105" : "group-hover:scale-105"
                }`}
              >
                <img src={item.icon} alt="" className="w-5 h-5 object-contain" />
              </span>
              <span className="truncate">{item.label}</span>
              {comingSoon && (
                <span className="ms-auto text-[10px] font-extrabold text-ink-400 bg-sand-100 px-2 py-0.5 rounded-full shrink-0">
                  قريبًا
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Settings */}
      <button
        onClick={() => {
          onSelect("settings");
          onNavigate(settingsNavItem.label);
        }}
        className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-bold text-ink-700 hover:bg-sand-100 transition-colors mt-2"
      >
        <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0">
          <img src={settingsNavItem.icon} alt="" className="w-5 h-5 object-contain" />
        </span>
        <span>{settingsNavItem.label}</span>
      </button>

      {onSignOut && (
        <button
          onClick={onSignOut}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-bold text-rose-500 hover:bg-rose-50 transition-colors"
        >
          <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0">
            <LogOutIcon className="w-5 h-5" />
          </span>
          <span>تسجيل الخروج</span>
        </button>
      )}
    </aside>
  );
}
