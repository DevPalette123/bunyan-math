import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Tajawal", "Cairo", "system-ui", "sans-serif"],
        // خط كوفي للأرقام والعناوين في «اختبر» فقط — يعطيها طابع الخط
        // العماني المعماري. Tajawal يبقى بديلًا إن لم يُحمَّل الخط.
        kufi: ["Reem Kufi", "Tajawal", "Cairo", "system-ui", "sans-serif"],
      },
      colors: {
        // Base neutrals — warm sand, not sterile white
        sand: {
          50: "#FBF8F3",
          100: "#F5EFE3",
          200: "#EDE3D0",
        },
        ink: {
          900: "#1F2A24",
          700: "#3A4A40",
          500: "#6B7A70",
          // 400/300: used in the code (muted text) but were never defined.
          400: "#909B94",
          300: "#B5BCB8",
        },
        // Omani-inspired primary: deep palm green + desert clay + falaj sky blue
        palm: {
          50: "#EAF5EE",
          100: "#CFE9D8",
          400: "#3E9C6B",
          500: "#1F7A4D",
          600: "#146239",
          700: "#0F4E2E",
        },
        clay: {
          50: "#FBEAE7",
          400: "#E08669",
          500: "#D06A4A",
          600: "#B8552F",
        },
        sky: {
          50: "#E9F4FB",
          400: "#5BA9D6",
          500: "#3A8FC4",
        },
        sun: {
          50: "#FDF3DC",
          400: "#F0B94A",
          500: "#E3A422",
          600: "#B78317", // used in the code but was never defined
        },
        berry: {
          50: "#F3EBF7",
          300: "#C09BD4", // used in the code but was never defined
          400: "#A570C2",
          500: "#8C55AD",
          600: "#6F428A", // hover / darker text — used in the code but was never defined
          700: "#56336B", // used in the code but was never defined
        },
        rose: {
          50: "#FCE9EE",
          400: "#E86E8F",
          500: "#D6486E",
        },
        // ---------------------------------------------------------------
        // Teacher-scoped accent palette — cool, calm, professional. Used
        // exclusively by TeacherDashboardPage and its components, so the
        // teacher's console reads as a distinct, more grown-up product
        // from the warm/playful student palette above (sand/palm/sun/
        // rose etc.), which is untouched and still powers the student
        // dashboard exactly as before. Neutral backgrounds/text on teacher
        // pages use Tailwind's built-in `slate` scale directly (already
        // available — no override needed here).
        // ---------------------------------------------------------------
        teach: {
          // Blue-grey identity colour — primary actions on teacher pages.
          50: "#EEF3F6",
          100: "#DCE7ED",
          300: "#8CA3AF", // used in the code but was never defined
          400: "#5B7C8D",
          500: "#3E6478",
          600: "#2F4F60",
          700: "#233D4A",
        },
        mint: {
          // Calm success/positive accent (progress, completion).
          50: "#EAF6F1",
          100: "#D3EEE3",
          400: "#5FB79A",
          500: "#3E9C82",
          600: "#2F7C67",
        },
        // ---------------------------------------------------------------
        // «اختبر» فقط — واحة الغسق (أخضر نخيل عميق) وطوب الطين. تُستخدم في
        // QuizPage ومكوّناتها، وباقي المنصة لا يتأثر بها.
        // ---------------------------------------------------------------
        oasis: {
          700: "#124B35",
          800: "#0D3F2C",
          900: "#0A2E22",
        },
        brick: {
          300: "#EBA98F",
          400: "#DC7F5C",
          500: "#C8643F",
          600: "#A44D2E",
          700: "#7E3A22",
        },
        mortar: "#F3DFC1",
        lilac: {
          // Light cool-purple accent — badges/achievements only.
          50: "#F1EEFB",
          100: "#E2DCF5",
          400: "#9C8FD9",
          500: "#8577C9",
        },
      },
      borderRadius: {
        "3xl": "1.75rem",
        "4xl": "2.25rem",
      },
      boxShadow: {
        soft: "0 8px 24px -8px rgba(31, 42, 36, 0.12)",
        card: "0 12px 28px -10px rgba(31, 42, 36, 0.16)",
        lift: "0 20px 40px -12px rgba(31, 42, 36, 0.22)",
      },
      keyframes: {
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.94)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        // «اختبر»: الطوبة تسقط في مكانها وترتدّ ارتدادة صغيرة.
        "brick-drop": {
          "0%": { opacity: "0", transform: "translateY(-46px)" },
          "55%": { opacity: "1", transform: "translateY(4px)" },
          "78%": { transform: "translateY(-2px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // اهتزازة قصيرة للخيار الخاطئ.
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-7px)" },
          "40%": { transform: "translateX(7px)" },
          "60%": { transform: "translateX(-4px)" },
          "80%": { transform: "translateX(4px)" },
        },
        "streak-pop": {
          "0%": { opacity: "0", transform: "scale(0.5)" },
          "60%": { opacity: "1", transform: "scale(1.22)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "flag-wave": {
          "0%, 100%": { transform: "scaleX(1) skewY(0deg)" },
          "50%": { transform: "scaleX(0.8) skewY(-5deg)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "1" },
        },
        // «ألعب»: انتقال السؤال الجديد، وقفزة الشخصية، وتمايلها عند الخطأ، وظهور الجوهرة.
        "game-in": {
          "0%": { opacity: "0", transform: "translateX(-28px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateX(0) scale(1)" },
        },
        "mascot-hop": {
          "0%, 100%": { transform: "translateY(0) scale(1, 1)" },
          "30%": { transform: "translateY(-18px) scale(0.96, 1.05)" },
          "55%": { transform: "translateY(0) scale(1.06, 0.94)" },
          "75%": { transform: "translateY(-6px) scale(1, 1)" },
        },
        "mascot-wobble": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "20%": { transform: "rotate(-7deg)" },
          "45%": { transform: "rotate(6deg)" },
          "70%": { transform: "rotate(-3deg)" },
        },
        "mascot-float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        "gem-pop": {
          "0%": { opacity: "0", transform: "scale(0.2) rotate(-25deg)" },
          "60%": { opacity: "1", transform: "scale(1.3) rotate(6deg)" },
          "100%": { opacity: "1", transform: "scale(1) rotate(0deg)" },
        },
        "bubble-pop": {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.92)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        // لوحة النجوم: علامة «+١» تطفو وتختفي فوق البطاقة عند إضافة نجمة.
        "float-up": {
          "0%": { opacity: "0", transform: "translateY(4px) scale(0.8)" },
          "20%": { opacity: "1", transform: "translateY(-6px) scale(1.1)" },
          "100%": { opacity: "0", transform: "translateY(-46px) scale(1)" },
        },
        // قصاصات الاحتفال: تسقط مرة واحدة فقط (المدة والتأخير والانحراف
        // تأتي من متغيرات CSS على كل قصاصة).
        "confetti-fall": {
          "0%": { opacity: "1", transform: "translate3d(0, -24px, 0) rotate(0deg)" },
          "100%": {
            opacity: "0.9",
            transform: "translate3d(var(--drift, 0px), 105vh, 0) rotate(680deg)",
          },
        },
      },
      animation: {
        "rise-in": "rise-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
        "pop-in": "pop-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "brick-drop": "brick-drop 0.65s cubic-bezier(0.22, 1, 0.36, 1) both",
        shake: "shake 0.45s ease-in-out both",
        "streak-pop": "streak-pop 0.45s cubic-bezier(0.16, 1, 0.3, 1) both",
        "flag-wave": "flag-wave 1.9s ease-in-out infinite",
        "float-up": "float-up 0.9s cubic-bezier(0.16, 1, 0.3, 1) both",
        "game-in": "game-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) both",
        "mascot-hop": "mascot-hop 0.7s ease-out both",
        "mascot-wobble": "mascot-wobble 0.6s ease-in-out both",
        "mascot-float": "mascot-float 2.6s ease-in-out infinite",
        "gem-pop": "gem-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "bubble-pop": "bubble-pop 0.35s cubic-bezier(0.16, 1, 0.3, 1) both",
        "glow-pulse": "glow-pulse 1.6s ease-in-out infinite",
        "confetti-fall":
          "confetti-fall var(--dur, 3.6s) cubic-bezier(0.25, 0.6, 0.5, 1) var(--delay, 0s) both",
      },
    },
  },
  plugins: [],
} satisfies Config;
