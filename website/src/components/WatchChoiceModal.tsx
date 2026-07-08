import React, { useState, useEffect } from "react";
import { Movie } from "../types";
import { useApp } from "../context/AppContext";
import { Play, Film, X, CheckSquare, Square, Clock, Star } from "lucide-react";
import { getImageUrl, tmdb, isTvShow } from "../utils/tmdb";

interface WatchChoiceModalProps {
  movie: Movie | null;
  isOpen: boolean;
  onClose: () => void;
  onChoose: (choice: "full" | "trailer") => void;
}

export const WatchChoiceModal: React.FC<WatchChoiceModalProps> = ({
  movie,
  isOpen,
  onClose,
  onChoose,
}) => {
  const { rememberChoice, setRememberChoice, setDefaultWatchChoice } = useApp();
  const [localRemember, setLocalRemember] = useState(rememberChoice);
  const [movieDetails, setMovieDetails] = useState<Movie | null>(null);

  useEffect(() => {
    if (!movie) return;
    setLocalRemember(rememberChoice);
    setMovieDetails(movie);
    if (!movie.runtime && movie.id) {
      const fetchDetails = async () => {
        try {
          const data = isTvShow(movie)
            ? await tmdb.getTVDetails(movie.id)
            : await tmdb.getMovieDetails(movie.id);
          setMovieDetails(data);
        } catch {
          /* keep basic info */
        }
      };
      fetchDetails();
    }
  }, [movie, rememberChoice]);

  if (!isOpen || !movie) return null;

  const handleSelectChoice = (choice: "full" | "trailer") => {
    if (localRemember) {
      setRememberChoice(true);
      setDefaultWatchChoice(choice);
      localStorage.setItem("cinemax_remember_choice", "true");
      localStorage.setItem("cinemax_default_choice", choice);
    } else {
      setRememberChoice(false);
      setDefaultWatchChoice(null);
      localStorage.setItem("cinemax_remember_choice", "false");
      localStorage.removeItem("cinemax_default_choice");
    }
    onChoose(choice);
  };

  const runtimeText = movieDetails?.runtime
    ? `${Math.floor(movieDetails.runtime / 60)}h ${movieDetails.runtime % 60}m`
    : movieDetails?.episode_run_time?.length
    ? `${movieDetails.episode_run_time[0]}m per ep`
    : "N/A";

  const yearText = (movieDetails?.release_date || movieDetails?.first_air_date || "").slice(0, 4) || "N/A";

  return (
    <div id="watch-choice-backdrop" className="fixed inset-0 z-55 flex items-center justify-center modal-backdrop p-4 animate-fade-in">
      <div id="watch-choice-modal" className="relative w-full max-w-2xl overflow-hidden rounded-2xl border surface-panel md:flex animate-fade-in">
        <button
          id="close-choice-modal-btn"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 rounded-lg surface-elevated p-2 text-neutral-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div id="choice-modal-poster-panel" className="hidden w-2/5 md:block bg-neutral-900">
          <img
            src={getImageUrl(movie.poster_path)}
            alt={movie.title || movie.name}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>

        <div id="choice-modal-content-panel" className="flex flex-1 flex-col justify-between p-6 md:p-8">
          <div>
            <span className="inline-block rounded-md accent-chip px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest mb-3">
              {isTvShow(movie) ? "TV Show" : "Movie"}
            </span>
            <h2 className="font-sans text-2xl font-bold tracking-tight mb-2">
              {movie.title || movie.name}
            </h2>

            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-400 mb-6">
              <div className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                <span className="font-semibold">{movie.vote_average.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>{runtimeText}</span>
              </div>
              <div>{yearText}</div>
            </div>

            <p className="text-sm text-neutral-400 line-clamp-3 leading-relaxed mb-8">{movie.overview}</p>

            <h3 className="text-center font-sans text-base font-semibold mb-4">How would you like to watch?</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
              <button
                id="modal-choose-full-btn"
                onClick={() => handleSelectChoice("full")}
                className="group flex flex-col items-center justify-center rounded-2xl border accent-chip p-5 text-center hover:border-[#39FF14] transition-colors cursor-pointer"
              >
                <div className="mb-3 rounded-full logo-mark p-3 group-hover:scale-105 transition-transform">
                  <Play className="h-5 w-5 fill-black text-black" />
                </div>
                <span className="font-semibold">Watch Full Movie</span>
                <span className="mt-1 text-[10px] text-neutral-400">Cinematic streaming player</span>
              </button>

              <button
                id="modal-choose-trailer-btn"
                onClick={() => handleSelectChoice("trailer")}
                className="group flex flex-col items-center justify-center rounded-2xl border surface-elevated p-5 text-center hover:border-neutral-600 transition-colors cursor-pointer"
              >
                <div className="mb-3 rounded-full surface-elevated p-3 text-neutral-300 group-hover:scale-105 transition-transform">
                  <Film className="h-5 w-5" />
                </div>
                <span className="font-semibold">Watch Trailer</span>
                <span className="mt-1 text-[10px] text-neutral-400">Official TMDB preview</span>
              </button>
            </div>
          </div>

          <div
            id="remember-choice-checkbox"
            onClick={() => setLocalRemember(!localRemember)}
            className="flex items-center gap-3 cursor-pointer self-center py-2 px-4 rounded-full hover:bg-neutral-800 transition-colors"
          >
            {localRemember ? (
              <CheckSquare className="h-5 w-5 text-[#39FF14]" />
            ) : (
              <Square className="h-5 w-5 text-neutral-600" />
            )}
            <span className="text-xs text-neutral-400 select-none">Remember my choice for future titles</span>
          </div>
        </div>
      </div>
    </div>
  );
};
