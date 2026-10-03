import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import BrandFooter from "./BrandFooter";
import SchoolLogo from "./SchoolLogo";
import { useAuth } from "../context/AuthContext";

interface StudentShellProps {
  /** Which sidebar/mobile-nav item should be highlighted on this page. */
  activeId: string;
  children: ReactNode;
}

export default function StudentShell({ activeId, children }: StudentShellProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  function handleSelect(id: string) {
    if (id === "home") navigate("/student");
    else if (id === "learn") navigate("/learn");
    else if (id === "discover") navigate("/discover");
    else if (id === "practice") navigate("/practice");
    else if (id === "play") navigate("/play");
    else if (id === "quiz") navigate("/quiz");
    else if (id === "identity-homeland" || id === "digital-leader" || id === "skills-growth") navigate(`/initiatives/${id}`);
    else if (id === "badges") navigate("/badges");
    else if (id === "settings") navigate("/settings");
    // Other sections aren't wired to a route yet — selecting them is a
    // harmless no-op until each one is built, exactly like before this
    // shell existed.
  }

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-sand-50 flex" dir="rtl">
      <Sidebar activeId={activeId} onSelect={handleSelect} onNavigate={() => {}} onSignOut={handleSignOut} />

      <div className="flex-1 min-w-0 flex flex-col">
        <SchoolLogo />
        <div className="flex-1">{children}</div>
        <BrandFooter />
      </div>

      <MobileNav activeId={activeId} onSelect={handleSelect} onNavigate={() => {}} onSignOut={handleSignOut} />
    </div>
  );
}
