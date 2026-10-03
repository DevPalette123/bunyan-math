import schoolLogo from "../assets/logo/school-logo.png";

/**
 * School logo (مدرسة الزلفى) — transparent PNG, centered at the top of every page.
 * `size` controls the height; the width follows the artwork's proportions.
 */
export default function SchoolLogo({
  size = "h-20 sm:h-24",
  className = "pt-4 pb-1",
}: {
  size?: string;
  className?: string;
}) {
  return (
    <div className={`flex justify-center ${className}`} dir="rtl">
      <img
        src={schoolLogo}
        alt="شعار مدرسة الزلفى (١-٤)"
        className={`${size} w-auto object-contain select-none`}
        draggable={false}
      />
    </div>
  );
}
