import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import StudentDashboardPage from "./pages/StudentDashboardPage";
import LearnPage from "./pages/LearnPage";
import LessonDetailPage from "./pages/LessonDetailPage";
import BadgesPage from "./pages/BadgesPage";
import SettingsPage from "./pages/SettingsPage";
import TeacherDashboardPage from "./pages/TeacherDashboardPage";
import DiscoverPage from "./pages/DiscoverPage";
import PracticePage from "./pages/PracticePage";
import PlayPage from "./pages/PlayPage";
import QuizPage from "./pages/QuizPage";
import GamePage from "./pages/GamePage";
import FunGamePage from "./pages/FunGamePage";
import InitiativeActionPage from "./pages/InitiativeActionPage";
import CompetitionPage from "./pages/CompetitionPage";
import CompetitionBuilderPage from "./pages/CompetitionBuilderPage";
import CompetitionResultsPage from "./pages/CompetitionResultsPage";

function RootRedirect() {
  const { session, profile, loading, initialized } = useAuth();

  if (!initialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand-50">
        <p className="text-ink-500 font-bold text-sm">جارٍ التحميل...</p>
      </div>
    );
  }

  if (!session || !profile) return <Navigate to="/login" replace />;
  return <Navigate to={profile.role === "teacher" ? "/teacher" : "/student"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentDashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/learn"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <LearnPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/learn/:lessonId"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <LessonDetailPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/discover"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <DiscoverPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/practice"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <PracticePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/play"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <PlayPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/quiz"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <QuizPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/play/fun/:funId"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <FunGamePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/play/:gameId"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <GamePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/initiatives/:initiativeId"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <InitiativeActionPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/badges"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <BadgesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      {/* Any other not-yet-built /student/* path falls back to the dashboard
          instead of a dead 404 — same spirit as the old wildcard route. */}
      <Route path="/student/*" element={<Navigate to="/student" replace />} />

      {/* «المسابقات»: الصفحة العامة بلا حساب، وصفحات الإدارة للمعلمة فقط. */}
      <Route path="/competition/:slug" element={<CompetitionPage />} />
      <Route
        path="/teacher/competitions/new"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <CompetitionBuilderPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/competitions/:id/edit"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <CompetitionBuilderPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/competitions/:id/results"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <CompetitionResultsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher/*"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherDashboardPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}


