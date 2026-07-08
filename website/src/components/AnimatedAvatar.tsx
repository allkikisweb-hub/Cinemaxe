import React from "react";

/**
 * Original, generated animated avatar designs (no photos, no licensed
 * characters/IP) built from pure SVG + CSS animation. Selecting one stores
 * a lightweight id like "anim:aurora" on the user's profile; legacy accounts
 * with a photo URL in `avatar` keep working as a static <img>.
 */
export interface AnimatedAvatarDef {
  id: string; // stored as `anim:${id}`
  label: string;
  gradient: [string, string];
}

export const ANIMATED_AVATARS: AnimatedAvatarDef[] = [
  { id: "aurora", label: "Aurora Wave", gradient: ["#39FF14", "#00c8ff"] },
  { id: "ember", label: "Ember Pulse", gradient: ["#ff5e3a", "#ffb84c"] },
  { id: "violet", label: "Violet Nova", gradient: ["#a855f7", "#ec4899"] },
  { id: "cyber", label: "Cyber Grid", gradient: ["#00c8ff", "#0ea5e9"] },
  { id: "comet", label: "Comet Trail", gradient: ["#fbbf24", "#39FF14"] },
  { id: "prism", label: "Holo Prism", gradient: ["#ec4899", "#8b5cf6"] },
];

export const ANIM_PREFIX = "anim:";

export function isAnimatedAvatar(value?: string): boolean {
  return !!value && value.startsWith(ANIM_PREFIX);
}

function getDef(value: string): AnimatedAvatarDef {
  const id = value.replace(ANIM_PREFIX, "");
  return ANIMATED_AVATARS.find((a) => a.id === id) || ANIMATED_AVATARS[0];
}

/**
 * High-quality, original cartoon character avatars — hand-tuned SVG "bust"
 * illustrations (no photos, no third-party or licensed characters). Each
 * definition is a small set of parameters (skin tone, hair style/color,
 * outfit color, background gradient, optional accessory) fed into a single
 * shared renderer below, which keeps every character visually consistent
 * while still looking distinct from one another.
 */
export interface CartoonAvatarDef {
  id: string; // stored as `cartoon:${id}`
  label: string;
  skin: string;
  hair: string;
  hairStyle: "short" | "bun" | "curly" | "quiff" | "long" | "shaved" | "afro" | "bob";
  outfit: string;
  bg: [string, string];
  accessory?: "glasses" | "headphones" | "cap";
}

export const CARTOON_AVATARS: CartoonAvatarDef[] = [
  { id: "nova", label: "Nova", skin: "#f2c19c", hair: "#2b2118", hairStyle: "bob", outfit: "#39FF14", bg: ["#0f2e1c", "#083319"], accessory: "glasses" },
  { id: "orion", label: "Orion", skin: "#c98a5c", hair: "#141414", hairStyle: "short", outfit: "#00c8ff", bg: ["#0a2233", "#071a29"] },
  { id: "sage", label: "Sage", skin: "#e8b48a", hair: "#8a5a2b", hairStyle: "curly", outfit: "#a855f7", bg: ["#241033", "#180a24"] },
  { id: "kai", label: "Kai", skin: "#8d5a3c", hair: "#0a0a0a", hairStyle: "afro", outfit: "#ff5e3a", bg: ["#331408", "#260d06"], accessory: "headphones" },
  { id: "luma", label: "Luma", skin: "#f6d3ae", hair: "#e0a83c", hairStyle: "long", outfit: "#ec4899", bg: ["#330f22", "#240a18"] },
  { id: "atlas", label: "Atlas", skin: "#d99f74", hair: "#3b2a1a", hairStyle: "quiff", outfit: "#fbbf24", bg: ["#332708", "#241b05"], accessory: "cap" },
  { id: "vega", label: "Vega", skin: "#f0c299", hair: "#5c3a21", hairStyle: "bun", outfit: "#0ea5e9", bg: ["#0a2733", "#071c26"] },
  { id: "zephyr", label: "Zephyr", skin: "#b97a52", hair: "#1a1a1a", hairStyle: "shaved", outfit: "#39FF14", bg: ["#101c33", "#0a1424"], accessory: "glasses" },
  { id: "iris", label: "Iris", skin: "#f7dcc0", hair: "#7c1f2f", hairStyle: "curly", outfit: "#8b5cf6", bg: ["#26102e", "#1a0a20"] },
  { id: "remy", label: "Remy", skin: "#dba876", hair: "#101010", hairStyle: "bob", outfit: "#22d3ee", bg: ["#062326", "#04191c"], accessory: "headphones" },
];

export const CARTOON_PREFIX = "cartoon:";

export function isCartoonAvatar(value?: string): boolean {
  return !!value && value.startsWith(CARTOON_PREFIX);
}

function getCartoonDef(value: string): CartoonAvatarDef {
  const id = value.replace(CARTOON_PREFIX, "");
  return CARTOON_AVATARS.find((a) => a.id === id) || CARTOON_AVATARS[0];
}

/** Draws the hair silhouette for a given style, positioned over a head centered at (50, 46) with radius 26. */
function HairShape({ style, color }: { style: CartoonAvatarDef["hairStyle"]; color: string }) {
  switch (style) {
    case "short":
      return <path d="M24 40 Q26 14 50 14 Q74 14 76 40 Q64 28 50 28 Q36 28 24 40Z" fill={color} />;
    case "bob":
      return <path d="M22 44 Q20 12 50 12 Q80 12 78 44 L78 56 Q71 46 71 34 Q71 24 50 24 Q29 24 29 34 Q29 46 22 56 Z" fill={color} />;
    case "curly":
      return (
        <g fill={color}>
          <circle cx="30" cy="26" r="10" />
          <circle cx="42" cy="16" r="11" />
          <circle cx="58" cy="16" r="11" />
          <circle cx="70" cy="26" r="10" />
          <circle cx="50" cy="20" r="12" />
        </g>
      );
    case "afro":
      return <circle cx="50" cy="30" r="27" fill={color} />;
    case "long":
      return <path d="M23 44 Q20 10 50 10 Q80 10 77 44 L80 70 Q73 74 71 55 Q73 32 50 26 Q27 32 29 55 Q27 74 20 70 Z" fill={color} />;
    case "quiff":
      return <path d="M25 38 Q24 22 38 14 Q34 26 44 18 Q50 8 58 18 Q68 12 66 26 Q76 22 75 38 Q63 26 50 26 Q37 26 25 38Z" fill={color} />;
    case "bun":
      return (
        <g fill={color}>
          <path d="M24 40 Q25 14 50 14 Q75 14 76 40 Q64 27 50 27 Q36 27 24 40Z" />
          <circle cx="50" cy="8" r="9" />
        </g>
      );
    case "shaved":
      return <path d="M24 36 Q26 20 50 20 Q74 20 76 36 Q64 30 50 30 Q36 30 24 36Z" fill={color} opacity={0.55} />;
    default:
      return null;
  }
}

function Accessory({ type }: { type: NonNullable<CartoonAvatarDef["accessory"]> }) {
  if (type === "glasses") {
    return (
      <g stroke="#0a0a0a" strokeWidth="2.5" fill="rgba(10,10,10,0.15)">
        <circle cx="40" cy="48" r="8" />
        <circle cx="60" cy="48" r="8" />
        <line x1="48" y1="47" x2="52" y2="47" />
      </g>
    );
  }
  if (type === "cap") {
    return (
      <g>
        <path d="M22 38 Q24 12 50 12 Q76 12 78 38 Q64 26 50 26 Q36 26 22 38Z" fill="#111318" />
        <path d="M22 38 Q14 40 10 36 Q22 30 30 34 Z" fill="#111318" />
      </g>
    );
  }
  // headphones
  return (
    <g stroke="#111318" strokeWidth="5" fill="none" strokeLinecap="round">
      <path d="M22 42 Q22 12 50 12 Q78 12 78 42" />
      <rect x="15" y="40" width="10" height="18" rx="4" fill="#111318" stroke="none" />
      <rect x="75" y="40" width="10" height="18" rx="4" fill="#111318" stroke="none" />
    </g>
  );
}

export const CartoonAvatar: React.FC<{ value: string; size?: number }> = ({ value, size = 64 }) => {
  const def = getCartoonDef(value);
  const uid = React.useId().replace(/[:]/g, "");

  return (
    <div className="relative rounded-full overflow-hidden" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <defs>
          <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={def.bg[0]} />
            <stop offset="100%" stopColor={def.bg[1]} />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#bg-${uid})`} />

        {/* Shoulders / outfit */}
        <path d="M8 100 Q8 72 50 72 Q92 72 92 100 Z" fill={def.outfit} />
        <path d="M8 100 Q8 76 32 73 L38 82 L30 100 Z" fill="rgba(0,0,0,0.12)" />
        <path d="M92 100 Q92 76 68 73 L62 82 L70 100 Z" fill="rgba(0,0,0,0.12)" />

        {/* Neck */}
        <rect x="43" y="60" width="14" height="16" rx="4" fill={def.skin} />

        {/* Head */}
        <circle cx="50" cy="46" r="26" fill={def.skin} />

        {/* Ears */}
        <circle cx="24" cy="48" r="4.5" fill={def.skin} />
        <circle cx="76" cy="48" r="4.5" fill={def.skin} />

        {/* Hair (behind-face styles drawn first, is fine on top since face features are separate) */}
        <HairShape style={def.hairStyle} color={def.hair} />

        {/* Eyes */}
        <circle cx="41" cy="48" r="3" fill="#161616" />
        <circle cx="59" cy="48" r="3" fill="#161616" />

        {/* Smile */}
        <path d="M40 58 Q50 65 60 58" stroke="#161616" strokeWidth="2.5" strokeLinecap="round" fill="none" />

        {/* Blush */}
        <circle cx="33" cy="55" r="3.5" fill="#ff8a80" opacity="0.35" />
        <circle cx="67" cy="55" r="3.5" fill="#ff8a80" opacity="0.35" />

        {def.accessory && <Accessory type={def.accessory} />}
      </svg>
    </div>
  );
};

export const AnimatedAvatar: React.FC<{ value: string; size?: number; initials?: string }> = ({
  value,
  size = 64,
  initials = "C",
}) => {
  const def = getDef(value);
  const [from, to] = def.gradient;
  const uid = React.useId().replace(/[:]/g, "");

  return (
    <div
      className="relative animated-avatar-float"
      style={{ width: size, height: size }}
    >
      {/* Rotating gradient ring */}
      <div
        className="absolute inset-0 rounded-full animated-avatar-ring"
        style={{
          background: `conic-gradient(from 0deg, ${from}, ${to}, ${from})`,
          padding: Math.max(2, size * 0.06),
        }}
      >
        <div className="w-full h-full rounded-full bg-[#0a0a0a]" />
      </div>

      {/* Secondary counter-rotating ring for depth */}
      <div
        className="absolute rounded-full border animated-avatar-ring-reverse"
        style={{
          inset: size * 0.1,
          borderColor: `${from}55`,
          borderWidth: Math.max(1, size * 0.015),
        }}
      />

      {/* Soft pulsing glow */}
      <div
        className="absolute inset-0 rounded-full blur-md animated-avatar-glow"
        style={{ background: `radial-gradient(circle, ${from}66, transparent 70%)` }}
      />

      {/* Orbiting particle */}
      <div
        className="absolute rounded-full animated-avatar-orbit"
        style={{
          top: "50%",
          left: "50%",
          width: Math.max(3, size * 0.08),
          height: Math.max(3, size * 0.08),
          marginTop: -Math.max(1.5, size * 0.04),
          marginLeft: -Math.max(1.5, size * 0.04),
          background: to,
          boxShadow: `0 0 8px ${to}`,
          ["--orbit-radius" as any]: `${size * 0.42}px`,
        }}
      />

      {/* Monogram core */}
      <div
        className="absolute rounded-full flex items-center justify-center font-black text-black animated-avatar-shimmer"
        style={{
          inset: size * 0.14,
          background: `linear-gradient(120deg, ${from}, ${to}, ${from})`,
          fontSize: size * 0.32,
        }}
      >
        {initials}
      </div>
    </div>
  );
};

export const AvatarRenderer: React.FC<{ value: string; size?: number; initials?: string; className?: string }> = ({
  value,
  size = 64,
  initials,
  className,
}) => {
  if (isCartoonAvatar(value)) {
    return <CartoonAvatar value={value} size={size} />;
  }
  if (isAnimatedAvatar(value)) {
    return <AnimatedAvatar value={value} size={size} initials={initials} />;
  }
  return (
    <img
      src={value}
      alt="Avatar"
      className={className}
      style={{ width: size, height: size, objectFit: "cover", borderRadius: "9999px" }}
      referrerPolicy="no-referrer"
    />
  );
};
