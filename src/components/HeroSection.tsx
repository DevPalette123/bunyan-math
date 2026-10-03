import heroIllustration from "../assets/hero/hero-illustration.jpg";
import { SparkleIcon } from "./icons/Glyphs";

interface HeroSectionProps {
  studentName: string;
  motivationalLine: string;
}

export default function HeroSection({ studentName, motivationalLine }: HeroSectionProps) {
  const firstName = studentName.split(" ")[0];

  return (
    <section
      className="relative overflow-hidden rounded-4xl shadow-soft animate-rise-in [animation-delay:60ms]"
      // Sampled directly from the illustration's own background (sky-teal at
      // its top, warm sand at its bottom) so the section's own surface is
      // never a different colour than the image — no seam is possible
      // regardless of how the image gets cropped at any breakpoint.
      style={{ background: "linear-gradient(180deg, #D8ECED 0%, #E4EDE8 55%, #F1EDE4 100%)" }}
    >
      {/* Mobile / narrow: illustration as a full-width band on top, text
          stacked below it — this is what actually fixes small screens,
          rather than squeezing a side-by-side layout into no space.
          Desktop / tablet (sm+): side-by-side, illustration always on the
          physical left and text on the physical right, independent of RTL
          (flex-col has no direction ambiguity; flex-row-reverse under our
          inherited dir="rtl" puts the first DOM child — the illustration —
          on the left and the second — the text — on the right). */}
      <div className="flex flex-col sm:flex-row-reverse">
        <div className="relative h-32 sm:h-60 md:h-64 sm:w-[44%] md:w-[42%] shrink-0">
          <img
            src={heroIllustration}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover object-[22%_58%] sm:object-[16%_55%]"
          />
          {/* Bottom fade on mobile (image sits above the text block) */}
          <div
            className="absolute inset-0 bg-gradient-to-b from-transparent to-[#F1EDE4] sm:hidden"
            aria-hidden="true"
          />
          {/* Horizontal fade on desktop/tablet (image blends into the text side) */}
          <div
            className="absolute inset-0 hidden sm:block bg-gradient-to-l from-transparent via-transparent to-[#E4EDE8]"
            aria-hidden="true"
          />
        </div>

        <div className="flex-1 flex flex-col justify-center gap-1.5 sm:gap-2 px-5 py-4 sm:py-5 sm:ps-8 sm:pe-6 text-center sm:text-start">
          <h2 className="flex items-center justify-center sm:justify-start gap-2 text-xl sm:text-2xl md:text-3xl font-extrabold text-ink-900">
            مرحبًا بك يا {firstName}
            <SparkleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-sun-500 shrink-0" />
          </h2>
          <p className="text-sm sm:text-base md:text-lg font-bold text-ink-700">
            معًا نكتشف عالم الرياضيات
          </p>
          <p className="flex items-center justify-center sm:justify-start gap-1.5 text-xs sm:text-sm font-bold text-rose-500">
            <SparkleIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            {motivationalLine}
          </p>
        </div>
      </div>
    </section>
  );
}

