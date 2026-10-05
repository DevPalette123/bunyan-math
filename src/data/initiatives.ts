import iconSkillsGrowth from "../assets/icons/icon-skills-growth.png";
import iconIdentityHomeland from "../assets/icons/icon-identity-homeland.png";
import iconDigitalLeader from "../assets/icons/icon-digital-leader.png";

export type InitiativeKind = "pdf" | "slides" | "presentation" | "game" | "coming-soon";

export interface Initiative {
  id: string;
  title: string;
  icon: string;
  kind: InitiativeKind;
  /** For kind "pdf" — served from /public/initiatives/, shown inline via
   * an embedded viewer (browsers render PDF natively). */
  fileUrl?: string;
  /** For kind "slides" — real slide images rendered from the actual .pptx,
   * shown in a custom in-app viewer so it opens inside the platform
   * (browsers cannot render .pptx natively at all, even via an iframe). */
  slideCount?: number;
  slidesBasePath?: string;
  /** The real, downloadable .pptx this deck was generated from. */
  downloadUrl?: string;
}

// "تعزيز الطلاب (لوحة النجوم المرحة)" intentionally لا تظهر هنا — أصبحت
// أداة خاصة بالمعلم فقط (تُدار من لوحة المعلم)؛ الطالب ترى فقط عدد
// نجومها هي في رئيسيتها.
export const initiatives: Initiative[] = [
  {
    id: "skills-growth",
    title: "تنمية المهارات النمائية",
    icon: iconSkillsGrowth,
    // لعبة تفاعلية مبنية داخل المنصة (تنمية المهارات النمائية) — تُفتح مباشرة، بلا ملف.
    kind: "game",
  },
  {
    id: "identity-homeland",
    title: "هويتي ووطني",
    icon: iconIdentityHomeland,
    // عرض تفاعلي مبني داخل المنصة (فيديوهات في public/initiatives/identity-homeland/)
    kind: "presentation",
  },
  {
    id: "digital-leader",
    title: "مبادرة القائد الرقمي",
    icon: iconDigitalLeader,
    kind: "pdf",
    fileUrl: "/initiatives/digital-leader.pdf",
  },
];
