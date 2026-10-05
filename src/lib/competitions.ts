// «المسابقات» — طبقة البيانات. مستقلة تمامًا عن نظام الطلاب/النجوم/الشارات.
// نستخدم عميلًا غير مُنمَّط (any) لأن جداول المسابقات لا تظهر في database.types.ts
// (ملف الأنواع اليدوي للمنصة القديمة) ولا نريد تعديله.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

const db = supabase as unknown as SupabaseClient<any>;

export const MEDIA_BUCKET = "competition-media";
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export type CompetitionStatus = "draft" | "published" | "closed";
export type ThemeId = "sky" | "mint" | "lilac" | "peach" | "sun";
export type QType = "mcq" | "true_false" | "number" | "text";
export type ItemKind =
  | "heading" | "text" | "instructions" | "image" | "video" | "pdf" | "link" | "divider" | "button" | "question";

export interface DraftOption { id: string; label: string; is_correct: boolean }
export interface DraftQuestion {
  qtype: QType;
  prompt: string;
  points: number;
  tf_answer: boolean | null;
  number_answer: string; // نص حتى لا نفقد ما يكتبه المستخدم أثناء الإدخال
  number_tolerance: string;
  text_answers: string[];
  options: DraftOption[];
}
export interface DraftItem {
  id: string;
  kind: ItemKind;
  data: Record<string, any>;
  question?: DraftQuestion;
}
export interface DraftPage { id: string; title: string; items: DraftItem[] }
export interface DraftCompetition {
  id: string;
  slug: string;
  status: CompetitionStatus;
  title: string;
  description: string;
  target_grade: string;
  theme: ThemeId;
  starts_at: string; // قيمة datetime-local (محلية) أو ""
  ends_at: string;
  duration_minutes: string;
  show_score: boolean;
  allow_retake: boolean;
  pages: DraftPage[];
}

export const newId = () => crypto.randomUUID();

/** مورد مرفق بالسؤال نفسه (صورة/فيديو/PDF/رابط). يُحفظ داخل data.attachments للعنصر. */
export type AttachmentKind = "image" | "video" | "pdf" | "link";
export interface DraftAttachment { id: string; kind: AttachmentKind; [key: string]: any }
export const ATTACHMENT_KINDS: { kind: AttachmentKind; icon: string; title: string }[] = [
  { kind: "image", icon: "🖼️", title: "صورة" },
  { kind: "video", icon: "🎬", title: "فيديو" },
  { kind: "pdf", icon: "📄", title: "ملف PDF" },
  { kind: "link", icon: "🔗", title: "رابط" },
];
export const MAX_ATTACHMENTS = 6;
export function getAttachments(data: Record<string, any> | undefined): DraftAttachment[] {
  return Array.isArray(data?.attachments) ? (data!.attachments as DraftAttachment[]) : [];
}

export function emptyQuestion(qtype: QType): DraftQuestion {
  return {
    qtype,
    prompt: "",
    points: 1,
    tf_answer: null,
    number_answer: "",
    number_tolerance: "0",
    text_answers: [""],
    options:
      qtype === "mcq"
        ? [1, 2, 3].map(() => ({ id: newId(), label: "", is_correct: false }))
        : [],
  };
}

export function emptyPage(): DraftPage {
  return { id: newId(), title: "", items: [] };
}

export function emptyCompetition(): DraftCompetition {
  return {
    id: newId(), slug: "", status: "draft", title: "", description: "", target_grade: "",
    theme: "sky", starts_at: "", ends_at: "", duration_minutes: "",
    show_score: true, allow_retake: false, pages: [emptyPage()],
  };
}

// ---------- تحويل التواريخ (datetime-local <-> ISO) ----------
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function localInputToIso(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}

// ---------- قائمة مسابقات المعلم (مع عدد المشاركين الحقيقي) ----------
export interface CompetitionSummary {
  id: string; slug: string; title: string; description: string | null; status: CompetitionStatus; theme: ThemeId;
  created_at: string; participants: number;
}

export async function listMyCompetitions(): Promise<CompetitionSummary[]> {
  const { data, error } = await db
    .from("competitions")
    .select("id, slug, title, description, status, theme, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Omit<CompetitionSummary, "participants">[];
  // عدد حقيقي لكل مسابقة (استعلام count خفيف، بلا جلب الصفوف).
  const counts = await Promise.all(
    rows.map(async (r) => {
      const { count, error: cErr } = await db
        .from("competition_submissions")
        .select("id", { count: "exact", head: true })
        .eq("competition_id", r.id);
      if (cErr) throw cErr;
      return count ?? 0;
    })
  );
  return rows.map((r, i) => ({ ...r, participants: counts[i] }));
}

// ---------- تحميل مسابقة كاملة للتحرير ----------
export async function loadCompetitionForEdit(id: string): Promise<DraftCompetition | null> {
  const { data: c, error } = await db.from("competitions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!c) return null;
  const [pg, it, qs, op] = await Promise.all([
    db.from("competition_pages").select("*").eq("competition_id", id).order("position"),
    db.from("competition_items").select("*").eq("competition_id", id).order("position"),
    db.from("competition_questions").select("*").eq("competition_id", id),
    db.from("competition_options").select("*").eq("competition_id", id).order("position"),
  ]);
  for (const r of [pg, it, qs, op]) if (r.error) throw r.error;

  const qMap = new Map<string, any>((qs.data ?? []).map((q: any) => [q.id, q]));
  const optsByQ = new Map<string, DraftOption[]>();
  for (const o of op.data ?? []) {
    const list = optsByQ.get(o.question_id) ?? [];
    list.push({ id: o.id, label: o.label, is_correct: o.is_correct });
    optsByQ.set(o.question_id, list);
  }

  const pages: DraftPage[] = (pg.data ?? []).map((p: any) => ({
    id: p.id,
    title: p.title ?? "",
    items: (it.data ?? [])
      .filter((i: any) => i.page_id === p.id)
      .map((i: any): DraftItem => {
        const q = qMap.get(i.id);
        return {
          id: i.id,
          kind: i.kind,
          data: i.data ?? {},
          question: q
            ? {
                qtype: q.qtype,
                prompt: q.prompt,
                points: q.points,
                tf_answer: q.tf_answer,
                number_answer: q.number_answer == null ? "" : String(q.number_answer),
                number_tolerance: String(q.number_tolerance ?? 0),
                text_answers: q.text_answers?.length ? q.text_answers : [""],
                options: optsByQ.get(q.id) ?? [],
              }
            : undefined,
        };
      }),
  }));

  return {
    id: c.id, slug: c.slug, status: c.status, title: c.title,
    description: c.description ?? "", target_grade: c.target_grade ?? "", theme: c.theme,
    starts_at: isoToLocalInput(c.starts_at), ends_at: isoToLocalInput(c.ends_at),
    duration_minutes: c.duration_minutes ? String(c.duration_minutes) : "",
    show_score: c.show_score, allow_retake: c.allow_retake,
    pages: pages.length ? pages : [emptyPage()],
  };
}

// ---------- الحفظ (دالة ذرّية في قاعدة البيانات) ----------
export async function saveCompetition(c: DraftCompetition): Promise<void> {
  const payload = {
    id: c.id,
    title: c.title,
    description: c.description,
    target_grade: c.target_grade,
    theme: c.theme,
    starts_at: localInputToIso(c.starts_at),
    ends_at: localInputToIso(c.ends_at),
    duration_minutes: c.duration_minutes ? Number(c.duration_minutes) : null,
    show_score: c.show_score,
    allow_retake: c.allow_retake,
    pages: c.pages.map((p) => ({
      id: p.id,
      title: p.title,
      items: p.items.map((i) => ({
        id: i.id,
        kind: i.kind,
        data: i.data,
        question: i.question
          ? {
              qtype: i.question.qtype,
              prompt: i.question.prompt,
              points: i.question.points,
              tf_answer: i.question.qtype === "true_false" ? i.question.tf_answer : null,
              number_answer: i.question.qtype === "number" ? i.question.number_answer.trim() || null : null,
              number_tolerance: i.question.qtype === "number" ? i.question.number_tolerance || "0" : "0",
              text_answers: i.question.qtype === "text" ? i.question.text_answers : [],
              options: i.question.qtype === "mcq" ? i.question.options : [],
            }
          : null,
      })),
    })),
  };
  const { error } = await db.rpc("save_competition", { p_payload: payload });
  if (error) throw error;
}

export async function setCompetitionStatus(id: string, status: CompetitionStatus): Promise<void> {
  const { error } = await db.from("competitions").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteCompetition(id: string): Promise<void> {
  // احذف ملفات الوسائط أولًا (best-effort) ثم المسابقة (الباقي يُحذف بالتتالي).
  try {
    const { data: u } = await db.auth.getUser();
    const uid = u.user?.id;
    if (uid) {
      const { data: files } = await db.storage.from(MEDIA_BUCKET).list(`${uid}/${id}`, { limit: 1000 });
      if (files?.length) {
        await db.storage.from(MEDIA_BUCKET).remove(files.map((f) => `${uid}/${id}/${f.name}`));
      }
    }
  } catch {
    /* لا نمنع الحذف بسبب فشل تنظيف الملفات */
  }
  const { error } = await db.from("competitions").delete().eq("id", id);
  if (error) throw error;
}

/** أساس الرابط العام: عنوان الموقع المنشور إن ضُبط، وإلا عنوان الصفحة الحالية. */
export function siteBase(): string {
  const configured = String(import.meta.env.VITE_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(configured) ? configured : window.location.origin;
}
/** هل الرابط محلي (localhost) فلا يعمل عند أي شخص آخر؟ */
export function isLocalBase(): boolean {
  try {
    const h = new URL(siteBase()).hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".local") || /^192\.168\./.test(h) || /^10\./.test(h);
  } catch { return false; }
}
export function competitionUrl(slug: string): string {
  return `${siteBase()}/competition/${slug}`;
}

// ---------- رفع الملفات ----------
const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "application/pdf": "pdf",
};
export const ACCEPT_BY_KIND: Record<"image" | "video" | "pdf", string> = {
  image: "image/png,image/jpeg,image/webp,image/gif",
  video: "video/mp4,video/webm,video/quicktime",
  pdf: "application/pdf",
};

export async function uploadMedia(competitionId: string, kind: "image" | "video" | "pdf", file: File): Promise<string> {
  const allowed = ACCEPT_BY_KIND[kind].split(",");
  if (!allowed.includes(file.type)) throw new Error("نوع الملف غير مدعوم.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("حجم الملف أكبر من ٥٠ ميجابايت.");
  const { data: u } = await db.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("انتهت الجلسة، سجّل الدخول من جديد.");
  const path = `${uid}/${competitionId}/${newId()}.${EXT_BY_MIME[file.type]}`;
  const { error } = await db.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

const signedCache = new Map<string, { url: string; exp: number }>();
export async function signedMediaUrl(path: string): Promise<string | null> {
  const hit = signedCache.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data, error } = await db.storage.from(MEDIA_BUCKET).createSignedUrl(path, 60 * 60 * 3);
  if (error || !data) return null;
  signedCache.set(path, { url: data.signedUrl, exp: Date.now() + 60 * 60 * 2 * 1000 });
  return data.signedUrl;
}

// ---------- الواجهة العامة (بلا حساب) ----------
export interface PublicOption { id: string; label: string }
export interface PublicQuestion { qtype: QType; prompt: string; points: number; options: PublicOption[] | null }
export interface PublicItem { id: string; kind: ItemKind; data: Record<string, any>; question: PublicQuestion | null }
export interface PublicPage { id: string; title: string | null; items: PublicItem[] }
export interface PublicCompetition {
  state: "not_found" | "closed" | "not_started" | "ended" | "open";
  title?: string; description?: string | null; theme?: ThemeId; target_grade?: string | null;
  starts_at?: string | null; ends_at?: string | null; duration_minutes?: number | null; show_score?: boolean;
  pages?: PublicPage[];
}
export interface SubmitResult {
  ok: boolean; show_score: boolean; score?: number; max_score?: number; correct_count?: number; question_count?: number;
}

export async function getPublicCompetition(slug: string): Promise<PublicCompetition> {
  const { data, error } = await db.rpc("get_public_competition", { p_slug: slug });
  if (error) throw error;
  return data as PublicCompetition;
}

const TOKEN_KEY = "bunyan-comp-token";
function clientToken(): string {
  try {
    let t = localStorage.getItem(TOKEN_KEY);
    if (!t) { t = newId(); localStorage.setItem(TOKEN_KEY, t); }
    return t;
  } catch { return newId(); }
}

const ERROR_MESSAGES: Record<string, string> = {
  already_submitted: "تمت مشاركتك في هذه المسابقة من قبل.",
  competition_unavailable: "هذه المسابقة غير متاحة الآن.",
  competition_not_started: "لم تبدأ المسابقة بعد.",
  competition_ended: "انتهى وقت المسابقة.",
  invalid_name: "الرجاء كتابة الاسم (حرفان على الأقل).",
  invalid_grade: "الرجاء كتابة الصف.",
  competition_full: "اكتمل عدد المشاركين في هذه المسابقة.",
};

export async function submitCompetition(
  slug: string, name: string, grade: string, answers: Record<string, string>, startedAt: Date
): Promise<SubmitResult> {
  const { data, error } = await db.rpc("submit_competition", {
    p_slug: slug, p_name: name, p_grade: grade, p_answers: answers,
    p_started_at: startedAt.toISOString(), p_token: clientToken(),
  });
  if (error) {
    const key = Object.keys(ERROR_MESSAGES).find((k) => error.message?.includes(k));
    throw new Error(key ? ERROR_MESSAGES[key] : "تعذّر إرسال مشاركتك. حاول مرة أخرى.");
  }
  return data as SubmitResult;
}

// ---------- نتائج المعلم ----------
export interface SubmissionRow {
  id: string; participant_name: string; grade_label: string; score: number; max_score: number;
  correct_count: number; question_count: number; submitted_at: string; duration_seconds: number | null; timed_out: boolean;
}
export interface AnswerRow {
  id: string; position: number; qtype: string; prompt_snapshot: string; answer_text: string | null;
  correct_text: string | null; is_correct: boolean; points_awarded: number; points_possible: number;
}

export async function loadSubmissions(competitionId: string): Promise<SubmissionRow[]> {
  const { data, error } = await db
    .from("competition_submissions")
    .select("id, participant_name, grade_label, score, max_score, correct_count, question_count, submitted_at, duration_seconds, timed_out")
    .eq("competition_id", competitionId)
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SubmissionRow[];
}

export async function loadAnswers(submissionId: string): Promise<AnswerRow[]> {
  const { data, error } = await db
    .from("competition_answers")
    .select("id, position, qtype, prompt_snapshot, answer_text, correct_text, is_correct, points_awarded, points_possible")
    .eq("submission_id", submissionId)
    .order("position");
  if (error) throw error;
  return (data ?? []) as AnswerRow[];
}

export async function deleteSubmission(id: string): Promise<void> {
  const { error } = await db.from("competition_submissions").delete().eq("id", id);
  if (error) throw error;
}

export async function loadCompetitionHeader(id: string) {
  const { data, error } = await db.from("competitions").select("id, slug, title, status, theme, show_score").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as { id: string; slug: string; title: string; status: CompetitionStatus; theme: ThemeId; show_score: boolean } | null;
}

/** تحويل رابط يوتيوب/فيميو إلى رابط تضمين آمن، أو null إن لم يكن معروفًا. */
export function toEmbedUrl(url: string): { kind: "embed" | "direct"; src: string } | null {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    const host = u.hostname.replace(/^www\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1);
    else if (host.endsWith("youtube.com")) {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else if (u.pathname.startsWith("/embed/") || u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2];
    }
    if (id && /^[\w-]{6,20}$/.test(id)) return { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${id}` };
    if (host === "vimeo.com") {
      const vid = u.pathname.split("/").filter(Boolean)[0];
      if (vid && /^\d+$/.test(vid)) return { kind: "embed", src: `https://player.vimeo.com/video/${vid}` };
    }
    return { kind: "direct", src: u.toString() };
  } catch {
    return null;
  }
}

export function isHttpUrl(v: string): boolean {
  try { return /^https?:$/.test(new URL(v).protocol); } catch { return false; }
}

/** فحص الجاهزية للنشر — يُرجع قائمة مشكلات بالعربية (فارغة = جاهزة). */
export function validateForPublish(c: DraftCompetition): string[] {
  const out: string[] = [];
  if (!c.title.trim()) out.push("اكتب اسم المسابقة.");
  if (!c.pages.some((p) => p.items.length > 0)) out.push("أضف عنصرًا واحدًا على الأقل.");
  if (c.starts_at && c.ends_at && new Date(c.ends_at) <= new Date(c.starts_at)) out.push("تاريخ النهاية يجب أن يكون بعد البداية.");
  let n = 0;
  c.pages.forEach((p, pi) => p.items.forEach((it) => {
    const where = `الصفحة ${pi + 1}`;
    if (["image", "video", "pdf"].includes(it.kind)) {
      if (it.data.source === "url" ? !isHttpUrl(it.data.url ?? "") : !it.data.path) out.push(`${where}: عنصر ${KIND_LABEL[it.kind]} بلا ملف أو رابط صحيح.`);
    }
    if (it.kind === "link" && !isHttpUrl(it.data.url ?? "")) out.push(`${where}: رابط خارجي غير صحيح (يبدأ بـ https://).`);
    if (["heading", "text", "instructions"].includes(it.kind) && !(it.data.text ?? "").trim()) out.push(`${where}: عنصر ${KIND_LABEL[it.kind]} فارغ.`);
    if (it.kind === "question") {
      getAttachments(it.data).forEach((a) => {
        const w = `السؤال ${n + 1}`;
        if (a.kind === "link") {
          if (!isHttpUrl(a.url ?? "")) out.push(`${w}: رابط مرفق غير صحيح (يبدأ بـ https://).`);
        } else if (a.source === "url" ? !isHttpUrl(a.url ?? "") : !a.path) {
          out.push(`${w}: مورد مرفق (${KIND_LABEL[a.kind]}) بلا ملف أو رابط صحيح.`);
        }
      });
    }
    if (it.kind === "question" && it.question) {
      n += 1;
      const q = it.question;
      const w = `السؤال ${n}`;
      if (!q.prompt.trim()) out.push(`${w}: اكتب نص السؤال.`);
      if (q.qtype === "mcq") {
        const filled = q.options.filter((o) => o.label.trim());
        if (filled.length < 2) out.push(`${w}: خياران على الأقل.`);
        if (!q.options.some((o) => o.is_correct && o.label.trim())) out.push(`${w}: حدّد الإجابة الصحيحة.`);
      }
      if (q.qtype === "true_false" && q.tf_answer === null) out.push(`${w}: حدّد هل العبارة صح أم خطأ.`);
      if (q.qtype === "number" && !/^-?\d+(\.\d+)?$/.test(q.number_answer.trim())) out.push(`${w}: الإجابة الرقمية غير صحيحة.`);
      if (q.qtype === "text" && !q.text_answers.some((a) => a.trim())) out.push(`${w}: أضف إجابة نصية صحيحة واحدة على الأقل.`);
    }
  }));
  return out;
}

export const KIND_LABEL: Record<ItemKind, string> = {
  heading: "عنوان", text: "نص", instructions: "تعليمات", image: "صورة", video: "فيديو", pdf: "ملف PDF",
  link: "رابط خارجي", divider: "فاصل", button: "زر انتقال", question: "سؤال",
};
