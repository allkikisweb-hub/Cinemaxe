import React, { useState } from "react";

interface CinemaxLogoProps {
  className?: string;
  compact?: boolean;
}

export const CinemaxLogo: React.FC<CinemaxLogoProps> = ({ className = "", compact = false }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const imgSrc = compact ? "/branding/cinemax-logo-mark.svg" : "/branding/cinemax-stream-logo.svg";

  return (
    <div className={`flex items-center justify-center ${className}`.trim()}>
      <div className={compact ? "relative flex h-12 w-12 items-center justify-center overflow-visible rounded-xl bg-transparent" : "relative flex w-64 max-w-[78vw] items-center justify-center overflow-visible bg-transparent sm:w-80"}>
        {!imgFailed && (
          <img
            src={imgSrc}
            alt="Cinemax"
            className={compact ? "h-11 w-11 object-contain" : "h-auto w-full object-contain"}
            onError={() => setImgFailed(true)}
          />
        )}

        {imgFailed && (
          <svg viewBox="0 0 120 120" className={compact ? "relative h-11 w-11" : "relative h-28 w-28"} aria-hidden="true">
            <defs>
              <linearGradient id="g1" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#7CFF7F" />
                <stop offset="50%" stopColor="#39FF14" />
                <stop offset="100%" stopColor="#00D24A" />
              </linearGradient>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <circle cx="60" cy="60" r="34" fill="none" stroke="#052009" strokeWidth="10" />
            <path
              d="M88 60a28 28 0 1 1-28-28"
              fill="none"
              stroke="url(#g1)"
              strokeWidth="18"
              strokeLinecap="round"
              filter="url(#glow)"
            />
          </svg>
        )}
      </div>
    </div>
  );
};
