import React from "react";
import { Wrench } from "lucide-react";

interface MaintenanceScreenProps {
  siteName: string;
  heroTagline?: string;
  isAdmin?: boolean;
  onAdminPanel?: () => void;
}

export const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({
  siteName,
  heroTagline,
  isAdmin,
  onAdminPanel,
}) => (
  <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg, #050505)" }}>
    <div className="max-w-md text-center space-y-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl logo-mark font-black text-2xl mx-auto">
        C
      </div>
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider accent-chip">
          <Wrench className="h-3.5 w-3.5" />
          Maintenance
        </div>
        <h1 className="font-sans text-2xl font-bold">{siteName} is under maintenance</h1>
        <p className="text-sm text-neutral-500 leading-relaxed">
          {heroTagline || "We are performing scheduled updates. Please check back shortly."}
        </p>
      </div>
      {isAdmin && onAdminPanel && (
        <button
          type="button"
          onClick={onAdminPanel}
          className="neon-btn font-bold px-6 py-3 rounded-xl text-xs uppercase tracking-wide cursor-pointer"
        >
          Open Admin Panel
        </button>
      )}
    </div>
  </div>
);
