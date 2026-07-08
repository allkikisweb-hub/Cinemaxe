import React, { useEffect, useState } from "react";
import { Movie } from "../types";
import { getImageUrl, tmdb } from "../utils/tmdb";
import { X, Play, Star, Clock, Calendar, Info } from "lucide-react";

interface MovieDetailsModalProps {
  movie: Movie | null;
  isOpen: boolean;
  onClose: () => void;
  onPlay: (movie: Movie) => void;
}

/**
 * A full-detail view of a single title — everything the Hero's "More Info"
 * button promises, distinct from "Play Now" which jumps straight into
 * playback. Fetches the deeper TMDB record (full overview, genres, runtime)
 * whenever the summary data on hand looks incomplete.
 */
export const MovieDetailsModal: React.FC<MovieDetailsModalProps> = ({ movie, isOpen, onClose, onPlay }) => {
  const [details, setDetails] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!movie) return;
    setDetails(movie);
    if (movie.isCustom) return; // Admin-authored content has no TMDB id to deepen

    const needsMore = !movie.genres || !movie.runtime;
    if (!needsMore) return;

    setLoading(true);
    const isTv = !movie.title;
    const fetchPromise = isTv ? tmdb.getTVDetails(movie.id) : tmdb.getMovieDetails(movie.id);
    fetchPromise
      .then((data) => setDetails(data))
      .catch((err) => console.error("Failed to load full movie details", err))
      .finally(() => setLoading(false));
  }, [movie]);

  if (!isOpen || !movie) return null;

  const d = details || movie;
  const isTv = !d.title;
  const runtimeText = d.runtime
    ? `${Math.floor(d.runtime / 60)}h ${d.runtime % 60}m`
    : d.episode_run_time && d.episode_run_time.length > 0
    ? `${d.episode_run_time[0]}m per episode`
    : null;
  const yearText = (d.release_date || d.first_air_date || "").slice(0, 4);

  return (
    <div
      id="movie-details-backdrop"
      className="fixed inset-0 z-55 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        id="movie-details-modal"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[88vh] overflow-y-auto no-scrollbar rounded-3xl border border-white/10 glass-card bg-[#0a0a0a]/98 text-white shadow-2xl shadow-black/80 animate-fade-in"
      >
        {/* Backdrop image header */}
        <div className="relative w-full aspect-video overflow-hidden">
          <img
            src={getImageUrl(d.backdrop_path || d.poster_path, "original")}
            alt={d.title || d.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/30 to-transparent" />
          <button
            id="close-details-modal-btn"
            onClick={onClose}
            className="absolute right-4 top-4 z-20 rounded-full bg-black/50 p-2 text-neutral-300 hover:bg-black/70 hover:text-white transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="absolute bottom-0 left-0 right-0 p-6">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#39FF14]/15 border border-[#39FF14]/30 px-2 py-0.5 text-[10px] font-bold text-[#39FF14] uppercase tracking-widest mb-3">
              <Info className="h-3 w-3" /> {isTv ? "TV Show" : "Movie"} Details
            </span>
            <h2 className="font-sans text-2xl sm:text-3xl font-black tracking-tight text-white">
              {d.title || d.name}
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-400">
            {d.vote_average != null && (
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                <span className="font-bold text-white">{d.vote_average.toFixed(1)}</span>
                <span>/ 10</span>
              </div>
            )}
            {yearText && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-neutral-500" />
                <span>{yearText}</span>
              </div>
            )}
            {runtimeText && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-neutral-500" />
                <span>{runtimeText}</span>
              </div>
            )}
            {loading && <span className="text-[#39FF14] animate-pulse">Loading full details…</span>}
          </div>

          {/* Genres */}
          {d.genres && d.genres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {d.genres.map((g) => (
                <span
                  key={g.id}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-neutral-300"
                >
                  {g.name}
                </span>
              ))}
            </div>
          )}

          {/* Overview */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-neutral-500 mb-2">Overview</h3>
            <p className="text-sm text-neutral-300 leading-relaxed">
              {d.overview || "No synopsis available for this title yet."}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              id="details-modal-play-btn"
              onClick={() => onPlay(d)}
              className="flex items-center gap-2 bg-[#39FF14] hover:bg-[#31dd11] text-black font-extrabold px-6 py-3 rounded-2xl shadow-[0_0_20px_rgba(57,255,20,0.35)] transition-all cursor-pointer"
            >
              <Play className="h-5 w-5 fill-black" />
              <span>Play Movie</span>
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-6 py-3 rounded-2xl transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
