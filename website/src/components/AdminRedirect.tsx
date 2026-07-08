import { useEffect } from "react";
import { useApp } from "../context/AppContext";
import { Loader2 } from "lucide-react";

/** Legacy in-app admin route — immediately hands off to the standalone panel. */
export const AdminRedirect: React.FC = () => {
  const { goToAdminPanel, setCurrentView } = useApp();

  useEffect(() => {
    goToAdminPanel().catch(() => setCurrentView("home"));
  }, [goToAdminPanel, setCurrentView]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-neutral-400">
      <Loader2 className="h-8 w-8 animate-spin text-[#39FF14]" />
      <p className="text-sm font-semibold">Opening Admin Panel…</p>
    </div>
  );
};
