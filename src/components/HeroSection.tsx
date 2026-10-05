import studentBanner from "../assets/hero/student-banner.jpg";
import BrandHero from "./BrandHero";
import { SparkleIcon } from "./icons/Glyphs";

interface HeroSectionProps {
  studentName: string;
  motivationalLine: string;
}

/** غلاف الطالب: الصورة كاملة بلا قص، وعلى الشاشات الكبيرة في إطار كريمي بزخرفة خفيفة، والتحية تحتها. */
export default function HeroSection({ studentName, motivationalLine }: HeroSectionProps) {
  const firstName = studentName.split(" ")[0];

  return (
    <BrandHero
      image={studentBanner}
      framed
      alt="منصة بنيان الرياضيات — نبني مهاراتنا ونعتز بهويتنا"
      title={`مرحبًا بك يا ${firstName} ✨`}
      subtitle="معًا نكتشف عالم الرياضيات"
      actions={
        <p className="flex items-center gap-1.5 rounded-full bg-rose-50 px-3.5 py-1.5 text-xs font-bold text-rose-500 sm:text-[13px]">
          <SparkleIcon className="h-3.5 w-3.5 shrink-0" />
          {motivationalLine}
        </p>
      }
    />
  );
}
