import React from "react";
import { Movie } from "../types";
import { Star, Play, Plus, Check, Loader2 } from "lucide-react";
import { getImageUrl, isTvShow } from "../utils/tmdb";
import { useApp } from "../context/AppContext";

interface MovieCardProps {
  movie: Movie;
  rank?: number;
  onClick: () => void;
  isPreparing?: boolean;
}

export const MovieCard: React.FC<MovieCardProps> = ({ movie, rank, onClick, isPreparing }) => {
  const { user, addToWatchlist, removeFromWatchlist } = useApp();

  const isTv = isTvShow(movie);
  const titleText = movie.title || movie.name || "Untitled";
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "0.0";
  const year = (movie.release_date || movie.first_air_date || "").slice(0, 4) || "N/A";

  const isWatchlisted = user ? (user.myList || user.watchlist || []).includes(movie.id) : false;

  const handleWatchlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    if (isWatchlisted) {
      removeFromWatchlist(movie.id);
    } else {
      addToWatchlist(movie.id);
    }
  };

  return (
    <div
      id={`movie-card-${movie.id}`}
      onClick={isPreparing ? undefined : onClick}
        className={`group relative flex-none w-full cursor-pointer rounded-3xl overflow-hidden solid-card hover:border-[#39FF14]/40 transition-all duration-300 select-none ${
        isPreparing ? "opacity-80 pointer-events-none" : "hover:-translate-y-0.5"
      }`}

    >
      {rank !== undefined && (
        <div
          id={`rank-overlay-${movie.id}`}
          className="absolute top-2 left-2 z-20 flex h-8 w-8 items-center justify-center rounded-xl logo-mark font-sans font-black text-sm"
        >
          {rank}
        </div>
      )}

      <div id={`poster-container-${movie.id}`} className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-800">
        <img
          src={getImageUrl(movie.poster_path, "w500")}
          alt={titleText}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          referrerPolicy="no-referrer"
        />

        {isPreparing && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black/70 backdrop-blur-[2px]">
            <Loader2 className="h-7 w-7 text-[#39FF14] animate-spin" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#39FF14]">Loading…</span>
          </div>
        )}

        <div
          id={`hover-overlay-${movie.id}`}
          className="card-hover-overlay absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4 z-10"
        >
          <button
            id={`watchlist-toggle-${movie.id}`}
            onClick={handleWatchlistClick}
            className={`self-end p-2 rounded-full border transition-all duration-200 cursor-pointer ${
              isWatchlisted
                ? "logo-mark border-[#39FF14]"
                : "surface-elevated border-neutral-700 text-neutral-300 hover:text-white"
            }`}
          >
            {isWatchlisted ? <Check className="h-4 w-4 stroke-[3px]" /> : <Plus className="h-4 w-4" />}
          </button>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-full logo-mark p-3.5 opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300">
              <Play className="h-5 w-5 fill-black" />
            </div>
          </div>

          <div className="space-y-1.5 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 text-amber-500">
                <Star className="h-3 w-3 fill-amber-500" />
                <span className="text-xs font-bold text-white">{rating}</span>
              </div>
              <span className="text-[10px] font-bold text-neutral-400">•</span>
              <span className="text-[10px] font-medium text-neutral-300">{year}</span>
            </div>
            <h4 className="text-xs font-bold text-white line-clamp-1">{titleText}</h4>
          </div>
        </div>
      </div>

      <div id={`card-footer-${movie.id}`} className="p-3 space-y-1 surface-elevated border-t border-neutral-800">
        <h4 className="text-xs font-bold text-neutral-200 truncate group-hover:text-[#39FF14] transition-colors duration-200">
          {titleText}
        </h4>
        <div className="flex items-center justify-between text-[10px] text-neutral-500 font-medium">
          <span>{isTv ? "TV Show" : "Movie"}</span>
          <div className="flex items-center gap-1">
            <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />
            <span className="text-neutral-300 font-semibold">{rating}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
