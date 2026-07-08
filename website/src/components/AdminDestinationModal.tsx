import React from "react";
import { ExternalLink, Globe, ShieldCheck } from "lucide-react";
import { useApp } from "../context/AppContext";

interface AdminDestinationModalProps {
  isOpen: boolean;
  onAdmin: () => void;
  onWebsite: () => void;
}

/** Shown for administrators immediately after sign-in. */
export const AdminDestinationModal: React.FC<AdminDestinationModalProps> = ({
  isOpen,
  onAdmin,
  onWebsite,
}) => {
  const { t } = useApp();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center modal-backdrop p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border surface-panel p-8 text-center space-y-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl logo-mark font-black text-2xl mx-auto">
          C
        </div>
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 accent-chip px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
            <ShieldCheck className="h-3.5 w-3.5" />
            Administrator
          </div>
          <h2 className="font-sans text-xl font-bold">Where would you like to go?</h2>
          <p className="text-xs text-neutral-500 leading-relaxed">
            You're signed in as the Cinemax administrator. Choose your destination.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onAdmin}
            className="neon-btn flex flex-col items-center gap-2 py-5 px-4 rounded-xl font-bold text-xs uppercase tracking-wide cursor-pointer"
          >
            <ExternalLink className="h-5 w-5" />
            {t("adminPanel")}
          </button>
          <button
            type="button"
            onClick={onWebsite}
            className="btn-secondary flex flex-col items-center gap-2 py-5 px-4 rounded-xl font-bold text-xs uppercase tracking-wide cursor-pointer"
          >
            <Globe className="h-5 w-5" />
            {t("goToWebsite")}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ADMIN_ROUTING_EMAIL = "allkikisweb@gmail.com";
