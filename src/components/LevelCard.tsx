import type { SkillLevel } from "../data/types";
import { toArabicDigits } from "../utils/arabicNumerals";

interface LevelCardProps {
  overallPercent: number;
  skills: SkillLevel[];
}

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function LevelCard({ overallPercent, skills }: LevelCardProps) {
  const dashOffset = CIRCUMFERENCE * (1 - overallPercent / 100);
  const hasData = skills.length > 0;

  return (
    <div className="bg-white rounded-3xl shadow-soft p-5 sm:p-6">
      <h3 className="text-lg font-extrabold text-ink-900 mb-4">مستواي في الرياضيات</h3>

      {!hasData ? (
        <div className="flex flex-col items-center text-center gap-2 py-4">
          <div className="w-16 h-16 rounded-full bg-sand-100 flex items-center justify-center">
            <span className="text-2xl">🌱</span>
          </div>
          <p className="text-sm font-bold text-ink-700">ابدأ رحلتك في الرياضيات</p>
          <p className="text-xs text-ink-500">سيظهر مستواك هنا بعد أول درس أو تدريب حقيقي.</p>
        </div>
      ) : (
        <div className="flex items-center gap-5">
          <div className="relative w-24 h-24 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#EDE3D0" strokeWidth="10" />
              <circle
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke="#1F7A4D"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-extrabold text-palm-600">
                {toArabicDigits(overallPercent)}٪
              </span>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-2.5">
            {skills.map((skill) => (
              <div key={skill.label} className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink-700 w-14 shrink-0">{skill.label}</span>
                <div className="flex-1 h-2 rounded-full bg-sand-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${skill.colorClass} transition-all duration-700`}
                    style={{ width: `${skill.percent}%` }}
                  />
                </div>
                <span className="text-[11px] font-extrabold text-ink-500 w-9 text-end">
                  {toArabicDigits(skill.percent)}٪
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
