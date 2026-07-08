import React from "react";
import { useApp } from "../context/AppContext";
import { Bot, ImagePlus, Bookmark, ShieldCheck, Sparkles, Users, Rocket, Heart } from "lucide-react";

const FEATURES = [
  {
    icon: Bot,
    title: "AI Help Desk",
    description: "A fast, professional assistant that answers questions and can adjust your settings on request — always with your confirmation first.",
  },
  {
    icon: ImagePlus,
    title: "Visual Search",
    description: "Upload an image and let our AI find titles that match its mood, palette, and style.",
  },
  {
    icon: Bookmark,
    title: "Watchlist & Favorites",
    description: "Keep track of what you want to watch and what you love, synced to your profile.",
  },
  {
    icon: ShieldCheck,
    title: "Real Account Controls",
    description: "Change your name, password, and preferences in a settings panel that actually works.",
  },
];

const VALUES = [
  {
    icon: Sparkles,
    title: "Discovery First",
    description: "We think finding your next favorite show should feel effortless, not like scrolling forever.",
  },
  {
    icon: Users,
    title: "Built Around You",
    description: "Your watch history and preferences shape what Cinemax surfaces — not the other way around.",
  },
  {
    icon: Rocket,
    title: "Always Improving",
    description: "We ship small, meaningful upgrades often — new AI capabilities, smoother UI, better performance.",
  },
];

export const AboutPage: React.FC = () => {
  const { setCurrentView } = useApp();

  return (
    <div id="about-page" className="max-w-5xl mx-auto px-4 sm:px-6 py-14 pb-24 text-white">
      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#39FF14] font-black text-black shadow-[0_0_15px_rgba(57,255,20,0.4)] text-lg">
            C
          </div>
          <span className="text-lg font-black tracking-tighter select-none">
            <span className="text-white">CINEMA</span><span className="text-[#39FF14]">X</span>
          </span>
        </div>
        <h1 className="font-sans text-3xl sm:text-4xl font-black tracking-tight mb-4">
          Your movies, remembered. Your next watch, discovered.
        </h1>
        <p className="text-neutral-400 text-sm leading-relaxed">
          Cinemax is a personal movie & TV companion built around one idea: discovery should feel smart, not
          overwhelming. An AI Help Desk, visual search, and a watchlist that actually keeps up with you.
        </p>
      </div>

      {/* Mission */}
      <div className="glass-card rounded-3xl p-8 sm:p-10 mb-12 text-center">
        <Heart className="h-8 w-8 text-[#39FF14] mx-auto mb-4" />
        <h2 className="font-sans text-xl font-bold mb-3">Our Mission</h2>
        <p className="text-neutral-400 text-sm max-w-xl mx-auto leading-relaxed">
          We built Cinemax because tracking what you want to watch shouldn't take more effort than watching it.
          Every feature — from AI recommendations to visual search — exists to shorten the distance between "I'm
          bored" and "I found something great."
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-16">
        {[
          { value: "1M+", label: "Titles Indexed" },
          { value: "5", label: "Streaming Servers" },
          { value: "24/7", label: "AI Help Desk" },
          { value: "99.9%", label: "Uptime Target" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl bg-white/5 border border-white/10 py-6 text-center">
            <p className="font-sans text-2xl sm:text-3xl font-black text-[#39FF14]">{stat.value}</p>
            <p className="text-[10px] sm:text-xs text-neutral-500 font-semibold uppercase tracking-wider mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Features */}
      <div className="mb-16">
        <h2 className="font-sans text-2xl font-black mb-8 text-center">What You Get</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="flex gap-4 p-5 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex-shrink-0 h-11 w-11 rounded-2xl bg-[#39FF14]/10 border border-[#39FF14]/20 text-[#39FF14] flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-sans font-bold text-sm text-white mb-1">{f.title}</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">{f.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Values */}
      <div className="mb-16">
        <h2 className="font-sans text-2xl font-black mb-8 text-center">What We Believe</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {VALUES.map((v) => {
            const Icon = v.icon;
            return (
              <div key={v.title} className="text-center p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="h-11 w-11 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center mx-auto mb-4 text-[#39FF14]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-sans font-bold text-sm text-white mb-1.5">{v.title}</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">{v.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Streaming reliability note */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 mb-16 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
        <div className="flex-shrink-0 h-14 w-14 rounded-2xl bg-[#39FF14]/10 border border-[#39FF14]/20 flex items-center justify-center text-[#39FF14]">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <div>
          <h3 className="font-sans font-bold text-base text-white mb-1.5">Ad-Blocked, Multi-Server Playback</h3>
          <p className="text-xs text-neutral-400 leading-relaxed max-w-2xl">
            Every full movie plays through a sandboxed player backed by 5 reliable streaming sources — switch servers
            instantly if one is slow, with pop-ups and forced redirects blocked automatically.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center">
        <button
          onClick={() => setCurrentView("home")}
          className="neon-btn inline-flex items-center gap-2 font-extrabold px-8 py-3.5 rounded-xl text-sm uppercase tracking-wide transition-all cursor-pointer"
        >
          Explore Cinemax
        </button>
      </div>
    </div>
  );
};
