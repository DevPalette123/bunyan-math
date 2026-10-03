import type { CSSProperties } from "react";
import type { ThemeId } from "../../lib/competitions";

export interface CompetitionTheme {
  id: ThemeId;
  name: string;          // اسم القالب
  buddyName: string;     // اسم الشخصية (هوية بصرية فقط، لا علاقة لها بنوع الأسئلة)
  bg: string;            // خلفية الصفحة
  card: string;          // خلفية البطاقة
  primary: string;       // لون الأزرار
  primaryHover: string;
  onPrimary: string;
  soft: string;          // خلفية ناعمة للعناصر
  softer: string;
  border: string;
  text: string;
  muted: string;
  accent: string;        // لون الشخصية الأساسي
  shadow: string;
}

// ألوان باستيل هادئة. النص دائمًا داكن بتباين مقروء على البطاقة البيضاء.
export const THEMES: Record<ThemeId, CompetitionTheme> = {
  sky: {
    id: "sky", name: "أزرق هادئ", buddyName: "غيمة",
    bg: "linear-gradient(180deg,#EAF3FB 0%,#F6FAFD 55%,#EEF5FB 100%)", card: "#FFFFFF",
    primary: "#5B8DB8", primaryHover: "#4A7BA6", onPrimary: "#FFFFFF",
    soft: "#E6F0F9", softer: "#F3F8FC", border: "#D4E3F0", text: "#27415A", muted: "#6B829A",
    accent: "#9CC3E6", shadow: "0 14px 34px -14px rgba(70,110,150,.28)",
  },
  mint: {
    id: "mint", name: "أخضر هادئ", buddyName: "بومة",
    bg: "linear-gradient(180deg,#E8F5EE 0%,#F5FBF8 55%,#EAF6F0 100%)", card: "#FFFFFF",
    primary: "#5BA383", primaryHover: "#4A9072", onPrimary: "#FFFFFF",
    soft: "#E2F3EA", softer: "#F2FAF6", border: "#CFE6DA", text: "#24493A", muted: "#668A78",
    accent: "#9ED2B8", shadow: "0 14px 34px -14px rgba(60,130,100,.28)",
  },
  lilac: {
    id: "lilac", name: "بنفسجي هادئ", buddyName: "قطوطة",
    bg: "linear-gradient(180deg,#F0ECFA 0%,#F9F7FD 55%,#F2EEFA 100%)", card: "#FFFFFF",
    primary: "#8A7BC4", primaryHover: "#7767B4", onPrimary: "#FFFFFF",
    soft: "#ECE8F8", softer: "#F7F5FC", border: "#DDD6F0", text: "#3A3260", muted: "#7D76A0",
    accent: "#C3B8EA", shadow: "0 14px 34px -14px rgba(110,95,170,.28)",
  },
  peach: {
    id: "peach", name: "خوخي وردي", buddyName: "دبدوب",
    bg: "linear-gradient(180deg,#FDEDE8 0%,#FFF8F5 55%,#FDEFEA 100%)", card: "#FFFFFF",
    primary: "#D98A7A", primaryHover: "#C97868", onPrimary: "#FFFFFF",
    soft: "#FCE9E3", softer: "#FEF5F2", border: "#F4D6CD", text: "#5C3A33", muted: "#A07A71",
    accent: "#F2B8A8", shadow: "0 14px 34px -14px rgba(190,110,90,.26)",
  },
  sun: {
    id: "sun", name: "أصفر دافئ", buddyName: "نحلة",
    bg: "linear-gradient(180deg,#FBF3D9 0%,#FFFBEE 55%,#FBF4DE 100%)", card: "#FFFFFF",
    primary: "#C9A042", primaryHover: "#B68E33", onPrimary: "#FFFFFF",
    soft: "#FAF0CF", softer: "#FEF9E8", border: "#F0E2B0", text: "#574520", muted: "#9A8650",
    accent: "#F2D675", shadow: "0 14px 34px -14px rgba(170,135,40,.26)",
  },
};

export const THEME_ORDER: ThemeId[] = ["sky", "mint", "lilac", "peach", "sun"];

export function getTheme(id: string | undefined | null): CompetitionTheme {
  return THEMES[(id as ThemeId) ?? "sky"] ?? THEMES.sky;
}

export function themeVars(t: CompetitionTheme): CSSProperties {
  return {
    "--c-primary": t.primary, "--c-primary-hover": t.primaryHover, "--c-on-primary": t.onPrimary,
    "--c-soft": t.soft, "--c-softer": t.softer, "--c-border": t.border, "--c-text": t.text,
    "--c-muted": t.muted, "--c-card": t.card, "--c-shadow": t.shadow, "--c-accent": t.accent,
    background: t.bg, color: t.text,
  } as CSSProperties;
}
