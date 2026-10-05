import type { ReactNode } from "react";
import teacherBanner from "../../assets/hero/teacher-banner.jpg";
import BrandHero from "../BrandHero";

interface TeacherHeroProps {
  teacherName: string;
  /** شريحة الصف (الاسم + التعديل). */
  classSlot?: ReactNode;
  /** أزرار الإجراءات السريعة. */
  actions?: ReactNode;
}

export default function TeacherHero({ teacherName, classSlot, actions }: TeacherHeroProps) {
  // الاسم يُسبق بـ«أ.» (تصلح للمعلم والمعلمة)، ولا تتكرر إن كان الاسم يبدأ بلقب أصلًا (مثل «معلم تجريبي»).
  const name = teacherName.trim();
  const greetingName = /^(أ\.|أستاذ|الأستاذ|معلم|المعلم)/.test(name) ? name : `أ. ${name}`.trim();

  return (
    <BrandHero
      image={teacherBanner}
      alt="منصة بنيان الرياضيات — نبني مهاراتنا ونعتز بهويتنا"
      title={`مرحبًا بك، ${greetingName}`}
      subtitle="هنا يبدأ أثرك التعليمي ✨"
      actions={
        (classSlot || actions) && (
          <>
            {classSlot}
            {actions}
          </>
        )
      }
    />
  );
}
