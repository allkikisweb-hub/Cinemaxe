import React from "react";
import { PublicAd } from "../utils/siteConfig";

interface AdBannerProps {
  ad: PublicAd;
  className?: string;
  variant?: "banner" | "sidebar" | "pre-roll";
}

export const AdBanner: React.FC<AdBannerProps> = ({ ad, className = "", variant = "banner" }) => {
  const heightClass =
    variant === "sidebar" ? "h-28" : variant === "pre-roll" ? "h-36 sm:h-44" : "h-32 sm:h-40";

  return (
    <a
      href={ad.targetUrl}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`block rounded-2xl overflow-hidden border border-white/10 bg-black/40 group ${heightClass} ${className}`}
      aria-label={`Advertisement: ${ad.title}`}
    >
      <img
        src={ad.imageUrl}
        alt={ad.title}
        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
        referrerPolicy="no-referrer"
      />
      <span className="sr-only">Sponsored: {ad.title}</span>
    </a>
  );
};
