import type { MainSection } from "../data/types";
import { COMING_SOON_IDS } from "../data/navigation";

interface MainSectionsProps {
  sections: MainSection[];
  onOpen: (section: MainSection) => void;
}

export default function MainSections({ sections, onOpen }: MainSectionsProps) {
  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-5">
      {sections.map((section, index) => {
        const comingSoon = COMING_SOON_IDS.includes(section.id);
        return (
          <button
            key={section.id}
            onClick={() => onOpen(section)}
            disabled={comingSoon}
            aria-label={comingSoon ? `${section.title} — قريبًا` : undefined}
            style={{ animationDelay: `${100 + index * 60}ms` }}
            className={`group relative flex flex-col items-center text-center rounded-3xl ${section.bgClass} p-5 lg:p-6 h-44 sm:h-48 lg:h-52 shadow-soft transition-all duration-300 animate-pop-in ${
              comingSoon
                ? "opacity-60 saturate-[0.6] cursor-not-allowed"
                : "hover:shadow-lift hover:-translate-y-1"
            }`}
          >
            {comingSoon && (
              <span className="absolute top-3 inset-x-0 mx-auto w-fit text-[10px] font-extrabold text-ink-500 bg-white/90 px-2.5 py-1 rounded-full shadow-soft">
                قريبًا
              </span>
            )}
            <div
              className={`w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-white/70 flex items-center justify-center mb-3 transition-transform duration-300 shrink-0 ${
                comingSoon ? "" : "group-hover:scale-110"
              }`}
            >
              <img src={section.icon} alt="" className="w-11 h-11 lg:w-14 lg:h-14 object-contain" />
            </div>
            <h3 className={`text-base sm:text-lg lg:text-xl font-extrabold mb-1 ${section.accentClass}`}>
              {section.title}
            </h3>
            <p className="text-xs sm:text-[13px] lg:text-sm text-ink-700 leading-relaxed line-clamp-2">
              {section.description}
            </p>
          </button>
        );
      })}
    </section>
  );
}
