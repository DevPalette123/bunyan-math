// الصفحة العامة للمسابقة: /competition/:slug — بلا تسجيل دخول وبلا أي عنصر من منصة الطلاب.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicCompetition, type PublicCompetition } from "../lib/competitions";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import CompetitionPlayer from "../components/competitions/CompetitionPlayer";
import Buddy from "../components/competitions/Buddy";
import { getTheme, themeVars } from "../components/competitions/themes";

function Notice({ theme, title, text }: { theme?: string; title: string; text: string }) {
  const t = getTheme(theme);
  return (
    <div dir="rtl" style={themeVars(t)} className="min-h-screen flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-md rounded-[28px] bg-white border border-[color:var(--c-border)] [box-shadow:var(--c-shadow)] p-8 flex flex-col items-center text-center gap-3">
        <Buddy theme={t.id} className="w-28 h-32" />
        <h1 className="text-xl font-extrabold">{title}</h1>
        <p className="text-sm font-medium text-[color:var(--c-muted)] leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

export default function CompetitionPage() {
  const { slug = "" } = useParams();
  const [data, setData] = useState<PublicCompetition | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!isSupabaseConfigured) { setFailed(true); return; }
    getPublicCompetition(slug).then((d) => alive && setData(d)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [slug]);

  useEffect(() => {
    if (data?.title) document.title = data.title;
  }, [data?.title]);

  if (failed) return <Notice title="تعذّر فتح المسابقة" text="تحقق من اتصالك بالإنترنت ثم أعد المحاولة." />;
  if (!data) return <Notice title="جارٍ التحميل..." text="لحظة من فضلك." />;

  switch (data.state) {
    case "not_found": return <Notice title="المسابقة غير موجودة" text="تأكد من صحة الرابط الذي وصلك." />;
    case "closed": return <Notice theme={data.theme} title={data.title ?? "المسابقة"} text="هذه المسابقة مغلقة ولا تستقبل مشاركات الآن." />;
    case "ended": return <Notice theme={data.theme} title={data.title ?? "المسابقة"} text="انتهى وقت هذه المسابقة." />;
    case "not_started": {
      const when = data.starts_at ? new Date(data.starts_at).toLocaleString("ar-OM", { dateStyle: "full", timeStyle: "short" }) : "";
      return <Notice theme={data.theme} title={data.title ?? "المسابقة"} text={`لم تبدأ المسابقة بعد.${when ? ` تبدأ ${when}.` : ""}`} />;
    }
    default:
      return <CompetitionPlayer competition={data} slug={slug} />;
  }
}
