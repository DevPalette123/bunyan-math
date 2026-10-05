/**
 * These types mirror the tables created in supabase/schema.sql.
 * They are hand-written (not generated) to keep the project runnable without
 * the Supabase CLI. If you later run `supabase gen types typescript`, you can
 * replace this file with the generated one — the shapes below match it.
 *
 * Two structural requirements, both required by @supabase/supabase-js@2.116 +
 * @supabase/postgrest-js, and both are real typing rules — not something to
 * silence with `as any`:
 *
 * 1. Every schema (e.g. "public") must satisfy `GenericSchema`: each table
 *    needs `Row` / `Insert` / `Update` *and* a `Relationships` array, and the
 *    schema itself needs `Tables`, `Views`, and `Functions` keys (empty ones
 *    are fine). Missing any of these collapses the client's internal
 *    `Schema` generic to `never`.
 * 2. `Row` / `Insert` / `Update` must be declared with `type` (a plain
 *    object-literal alias), not `interface`. TypeScript's `X extends
 *    Record<string, unknown>` check — which `GenericTable` relies on — does
 *    not match named `interface` declarations, only `type` aliases, even
 *    when the shape is identical. Using `interface` here reproduces the same
 *    "Argument of type X is not assignable to parameter of type 'never'"
 *    error on every `.insert()` / `.update()` / `.select()` call.
 */

export type UserRole = "teacher" | "student";

export type ProfileRow = {
  id: string; // same as auth.users.id
  role: UserRole;
  full_name: string;
  created_at: string;
};

export type ClassRow = {
  id: string;
  teacher_id: string;
  name: string;
  created_at: string;
};

export type TeacherRow = {
  id: string; // same as profiles.id
  bio: string | null;
};

export type StudentRow = {
  id: string; // same as profiles.id
  class_id: string | null;
  grade_label: string | null;
  stars: number;
  login_code: string | null;
};

export type TaskStatus = "published" | "cancelled";

export type TaskRow = {
  id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  task_type: string;
  points: number;
  start_date: string | null;
  due_date: string | null;
  status: TaskStatus;
  created_at: string;
};

export type TaskAssignmentStatus = "not_started" | "in_progress" | "completed";

export type TaskAssignmentRow = {
  id: string;
  task_id: string;
  student_id: string;
  status: TaskAssignmentStatus;
  started_at: string | null;
  completed_at: string | null;
};

export type BadgeRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  condition_type: string;
  condition_value: number | null;
};

export type StudentBadgeRow = {
  id: string;
  student_id: string;
  badge_id: string;
  earned_at: string;
};

// jsonb columns (placement_questions.options, placement_attempt_questions.options_snapshot)
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// The three values below mirror the CHECK constraints in schema.sql.
export type PlacementSkillCode =
  | "addition_no_carry"
  | "subtraction_no_borrow"
  | "rounding"
  | "doubling"
  | "ascending_order"
  | "descending_order"
  | "comparison"
  | "even_odd";

export type PlacementDifficulty = "easy" | "medium" | "hard";

export type PlacementAttemptStatus = "in_progress" | "completed";

// Note: column-level grants in schema.sql stop the browser (authenticated role)
// from SELECTing `correct_answer`; the column still exists on the table, so it
// is part of the Row shape here.
export type PlacementQuestionRow = {
  id: string;
  skill: PlacementSkillCode;
  question: string;
  options: Json;
  correct_answer: string;
  difficulty: PlacementDifficulty;
  created_at: string;
};

export type PlacementAttemptRow = {
  id: string;
  student_id: string;
  started_at: string;
  expires_at: string;
  completed_at: string | null;
  status: PlacementAttemptStatus;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  unanswered: number;
  percentage: number | null; // numeric, no default
  level: string | null;
  points_awarded: number;
  weak_skills: string[];
  strong_skills: string[];
  recommended_skill: string | null;
};

export type PlacementAttemptQuestionRow = {
  id: string;
  attempt_id: string;
  question_id: string;
  skill: string;
  question_order: number;
  options_snapshot: Json | null;
  selected_answer: string | null;
  correct_answer: string | null;
  is_correct: boolean | null;
  answered_at: string | null;
};

// «اختبر» — أسئلة تُولَّد على الخادم. عمود answer_key (الإجابة الصحيحة) محجوب
// عن المتصفح بصلاحيات الأعمدة في schema.sql، لذلك لا يظهر في Row عمدًا:
// الواجهة لا تراه أبدًا، ولا يجوز استعمال select("*") على هذا الجدول.
export type QuizAttemptRow = {
  id: string;
  student_id: string;
  started_at: string;
  expires_at: string;
  completed_at: string | null;
  status: PlacementAttemptStatus;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  unanswered: number;
  percentage: number | null;
  level: string | null;
  points_awarded: number;
  best_streak: number;
  weak_skills: string[];
  strong_skills: string[];
};

export type QuizAttemptQuestionRow = {
  id: string;
  attempt_id: string;
  skill: PlacementSkillCode;
  question_order: number;
  prompt: string;
  visual: Json;
  question_text: string;
  options: Json;
  selected_answer: string | null;
  correct_answer: string | null;
  is_correct: boolean | null;
  answered_at: string | null;
};

// «ألعب» — كتالوج الألعاب ومحاولاتها. عمود answer_key (الإجابة الصحيحة) محجوب عن
// المتصفح بصلاحيات الأعمدة، وجدول game_questions (البنك) غير مقروء للمتصفح كليًا؛
// لذلك لا يظهر أيٌّ منهما هنا. لا تستعمل select("*") على game_attempt_questions.
export type PlayGameRow = {
  id: string;
  title: string;
  skill: string;
  /** هل تُمنح نجوم لهذه اللعبة؟ إن نعم: النجوم = عدد الإجابات الصحيحة، في أول
   *  محاولة مكتملة فقط لهذا الطالب في هذه اللعبة (وليس يوميًا كـ«اختبر»). */
  reward_enabled: boolean;
  reward_min_percentage: number;
  enabled: boolean;
};

export type GameAttemptStatus = "in_progress" | "completed" | "abandoned";

export type GameAttemptRow = {
  id: string;
  student_id: string;
  game_id: string;
  skill: string;
  attempt_number: number;
  started_at: string;
  expires_at: string;
  completed_at: string | null;
  status: GameAttemptStatus;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  percentage: number | null;
  duration_seconds: number | null;
  points_awarded: number;
};

export type GameAttemptQuestionRow = {
  id: string;
  attempt_id: string;
  bank_question_id: string | null;
  skill: PlacementSkillCode;
  difficulty: string;
  question_order: number;
  question_text: string;
  operand_a: number;
  operand_b: number | null;
  operator: string;
  visual: Json;
  options: Json;
  selected_answer: string | null;
  correct_answer: string | null;
  is_correct: boolean | null;
  answered_at: string | null;
};

export type LessonCompletionRow = {
  id: string;
  student_id: string;
  lesson_id: string;
  points_awarded: number;
  completed_at: string;
};

export type PracticeCompletionRow = {
  id: string;
  student_id: string;
  practice_id: string;
  points_awarded: number;
  completed_at: string;
};

export type FunGameResultRow = {
  id: string;
  student_id: string;
  game_id: string;
  stars: number;
  mistakes: number;
  duration_seconds: number | null;
  points_awarded: number;
  played_at: string;
};

export type InitiativeCompletionRow = {
  id: string;
  student_id: string;
  initiative_id: string;
  points_awarded: number;
  completed_at: string;
};

export type StarBoardEntryRow = {
  id: string;
  class_id: string;
  student_id: string | null;
  display_name: string;
  stars: number;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string; role: UserRole; full_name: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      classes: {
        Row: ClassRow;
        Insert: Partial<ClassRow> & { teacher_id: string; name: string };
        Update: Partial<ClassRow>;
        Relationships: [
          {
            foreignKeyName: "classes_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      teachers: {
        Row: TeacherRow;
        Insert: Partial<TeacherRow> & { id: string };
        Update: Partial<TeacherRow>;
        Relationships: [
          {
            foreignKeyName: "teachers_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      students: {
        Row: StudentRow;
        Insert: Partial<StudentRow> & { id: string };
        Update: Partial<StudentRow>;
        Relationships: [
          {
            foreignKeyName: "students_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "students_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: TaskRow;
        Insert: Partial<TaskRow> & { class_id: string; teacher_id: string; title: string };
        Update: Partial<TaskRow>;
        Relationships: [
          {
            foreignKeyName: "tasks_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      task_assignments: {
        Row: TaskAssignmentRow;
        Insert: Partial<TaskAssignmentRow> & { task_id: string; student_id: string };
        Update: Partial<TaskAssignmentRow>;
        Relationships: [
          {
            foreignKeyName: "task_assignments_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_assignments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      badges: {
        Row: BadgeRow;
        Insert: Partial<BadgeRow> & { code: string; name: string; condition_type: string };
        Update: Partial<BadgeRow>;
        Relationships: [];
      };
      student_badges: {
        Row: StudentBadgeRow;
        Insert: Partial<StudentBadgeRow> & { student_id: string; badge_id: string };
        Update: Partial<StudentBadgeRow>;
        Relationships: [
          {
            foreignKeyName: "student_badges_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_badges_badge_id_fkey";
            columns: ["badge_id"];
            isOneToOne: false;
            referencedRelation: "badges";
            referencedColumns: ["id"];
          },
        ];
      };
      // Read from the client only through embedded selects
      // (placement_attempt_questions -> placement_questions(question, options)).
      placement_questions: {
        Row: PlacementQuestionRow;
        Insert: Partial<PlacementQuestionRow> & {
          skill: PlacementSkillCode;
          question: string;
          options: Json;
          correct_answer: string;
        };
        Update: Partial<PlacementQuestionRow>;
        Relationships: [];
      };
      placement_attempts: {
        Row: PlacementAttemptRow;
        Insert: Partial<PlacementAttemptRow> & { student_id: string; expires_at: string };
        Update: Partial<PlacementAttemptRow>;
        Relationships: [
          {
            foreignKeyName: "placement_attempts_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      placement_attempt_questions: {
        Row: PlacementAttemptQuestionRow;
        Insert: Partial<PlacementAttemptQuestionRow> & {
          attempt_id: string;
          question_id: string;
          skill: string;
          question_order: number;
        };
        Update: Partial<PlacementAttemptQuestionRow>;
        Relationships: [
          {
            foreignKeyName: "placement_attempt_questions_attempt_id_fkey";
            columns: ["attempt_id"];
            isOneToOne: false;
            referencedRelation: "placement_attempts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "placement_attempt_questions_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "placement_questions";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_attempts: {
        Row: QuizAttemptRow;
        Insert: Partial<QuizAttemptRow> & { student_id: string; expires_at: string };
        Update: Partial<QuizAttemptRow>;
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_attempt_questions: {
        Row: QuizAttemptQuestionRow;
        Insert: Partial<QuizAttemptQuestionRow> & {
          attempt_id: string;
          skill: PlacementSkillCode;
          question_order: number;
          prompt: string;
          visual: Json;
          question_text: string;
          options: Json;
        };
        Update: Partial<QuizAttemptQuestionRow>;
        Relationships: [
          {
            foreignKeyName: "quiz_attempt_questions_attempt_id_fkey";
            columns: ["attempt_id"];
            isOneToOne: false;
            referencedRelation: "quiz_attempts";
            referencedColumns: ["id"];
          },
        ];
      };
      play_games: {
        Row: PlayGameRow;
        Insert: Partial<PlayGameRow> & { id: string; title: string; skill: string };
        Update: Partial<PlayGameRow>;
        Relationships: [];
      };
      game_attempts: {
        Row: GameAttemptRow;
        Insert: Partial<GameAttemptRow> & {
          student_id: string;
          game_id: string;
          skill: string;
          attempt_number: number;
          expires_at: string;
        };
        Update: Partial<GameAttemptRow>;
        Relationships: [
          {
            foreignKeyName: "game_attempts_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_attempts_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "play_games";
            referencedColumns: ["id"];
          },
        ];
      };
      game_attempt_questions: {
        Row: GameAttemptQuestionRow;
        Insert: Partial<GameAttemptQuestionRow> & {
          attempt_id: string;
          skill: PlacementSkillCode;
          difficulty: string;
          question_order: number;
          question_text: string;
          operand_a: number;
          operand_b: number;
          operator: string;
          visual: Json;
          options: Json;
        };
        Update: Partial<GameAttemptQuestionRow>;
        Relationships: [
          {
            foreignKeyName: "game_attempt_questions_attempt_id_fkey";
            columns: ["attempt_id"];
            isOneToOne: false;
            referencedRelation: "game_attempts";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_completions: {
        Row: LessonCompletionRow;
        Insert: Partial<LessonCompletionRow> & { student_id: string; lesson_id: string };
        Update: Partial<LessonCompletionRow>;
        Relationships: [
          {
            foreignKeyName: "lesson_completions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      practice_completions: {
        Row: PracticeCompletionRow;
        Insert: Partial<PracticeCompletionRow> & { student_id: string; practice_id: string };
        Update: Partial<PracticeCompletionRow>;
        Relationships: [
          {
            foreignKeyName: "practice_completions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      initiative_completions: {
        Row: InitiativeCompletionRow;
        Insert: Partial<InitiativeCompletionRow> & { student_id: string; initiative_id: string };
        Update: Partial<InitiativeCompletionRow>;
        Relationships: [
          {
            foreignKeyName: "initiative_completions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      fun_game_results: {
        Row: FunGameResultRow;
        Insert: Partial<FunGameResultRow> & { student_id: string; game_id: string; stars: number };
        Update: Partial<FunGameResultRow>;
        Relationships: [
          {
            foreignKeyName: "fun_game_results_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      star_board_entries: {
        Row: StarBoardEntryRow;
        Insert: Partial<StarBoardEntryRow> & { class_id: string; display_name: string };
        Update: Partial<StarBoardEntryRow>;
        Relationships: [
          {
            foreignKeyName: "star_board_entries_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "star_board_entries_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      complete_task_assignment: {
        Args: { target_assignment_id: string };
        Returns: void;
      };
      evaluate_and_award_badges: {
        Args: { target_student_id: string };
        Returns: void;
      };
      complete_lesson: {
        Args: { p_lesson_id: string };
        Returns: void;
      };
      complete_practice: {
        Args: { p_practice_id: string };
        Returns: void;
      };
      // «ألعب» الجديدة — يعيد عدد النجوم المضافة للرصيد.
      record_fun_game_result: {
        Args: { p_game_id: string; p_stars: number; p_mistakes: number; p_duration_seconds: number };
        Returns: number;
      };
      complete_initiative: {
        Args: { p_initiative_id: string };
        Returns: void;
      };
      // Returns the new placement_attempts.id (uuid).
      start_placement_attempt: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      // Returns whether the selected answer was correct.
      record_placement_answer: {
        Args: { p_attempt_id: string; p_question_id: string; p_selected_answer: string };
        Returns: boolean;
      };
      complete_placement_attempt: {
        Args: { p_attempt_id: string };
        Returns: void;
      };
      // «اختبر» — يُرجع رقم المحاولة (يستأنف المفتوحة إن وُجدت).
      start_quiz_attempt: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      // يُرجع صف واحد: صحة الإجابة + الإجابة الصحيحة (بعد إغلاق باب تغييرها).
      record_quiz_answer: {
        Args: { p_attempt_id: string; p_question_id: string; p_selected_answer: string };
        Returns: { was_correct: boolean; right_answer: string }[];
      };
      complete_quiz_attempt: {
        Args: { p_attempt_id: string };
        Returns: void;
      };
      // «ألعب» — يُرجع رقم المحاولة (يستأنف المفتوحة للعبة نفسها إن وُجدت).
      start_game_attempt: {
        Args: { p_game_id: string };
        Returns: string;
      };
      record_game_answer: {
        Args: { p_attempt_id: string; p_question_id: string; p_selected_answer: string };
        Returns: { was_correct: boolean; right_answer: string }[];
      };
      complete_game_attempt: {
        Args: { p_attempt_id: string };
        Returns: void;
      };
      // لوحة النجوم: زيادة/إنقاص ذرّي، يُرجع الرقم الحقيقي بعد التعديل.
      adjust_star_board_stars: {
        Args: { p_entry_id: string; p_delta: number };
        Returns: number;
      };
    };
  };
};
