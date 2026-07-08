import React, { useEffect, useState } from "react";
import { Download, Check } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Surfaces the browser's native "Install App" flow when available (Chrome,
 * Edge, and most Android browsers). Safari/iOS doesn't support
 * beforeinstallprompt, so we show a short manual-install tip there instead.
 */
export const InstallAppButton: React.FC<{ variant?: "sidebar" | "card" }> = ({ variant = "sidebar" }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSTip, setShowIOSTip] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => setInstalled(true);
    window.addEventListener("appinstalled", installedHandler);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent) && !(window.navigator as any).standalone);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
      return;
    }
    if (isIOS) {
      setShowIOSTip((v) => !v);
    }
  };

  if (installed) {
    return (
      <div
        id="install-app-installed"
        className="flex items-center gap-3 px-4 py-2.5 text-sm rounded-lg text-[#39FF14]"
      >
        <Check className="h-4 w-4" />
        <span>App Installed</span>
      </div>
    );
  }

  if (!deferredPrompt && !isIOS) return null;

  return (
    <div className="relative">
      <button
        id="install-app-btn"
        onClick={handleInstall}
        className={
          variant === "sidebar"
            ? "flex w-full items-center gap-4 px-4 py-2.5 text-sm rounded-lg hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            : "neon-btn flex items-center gap-2 font-extrabold px-5 py-3 rounded-xl text-xs uppercase tracking-wide transition-all cursor-pointer"
        }
      >
        <Download className="h-4 w-4 text-neutral-500" />
        <span>Install App</span>
      </button>
      {showIOSTip && (
        <div className="absolute left-0 bottom-full mb-2 w-64 glass-card rounded-xl p-3 text-[11px] text-neutral-300 leading-relaxed shadow-xl z-50">
          On iOS: tap the <strong>Share</strong> icon in Safari, then <strong>"Add to Home Screen"</strong>.
        </div>
      )}
    </div>
  );
};
