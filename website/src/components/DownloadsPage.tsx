import React, { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { Download, Trash2, Play, HardDrive, AlertTriangle, Loader2 } from "lucide-react";
import { getImageUrl } from "../utils/tmdb";
import { formatBytes, getLocalDownload } from "../utils/localDownloads";
import { DownloadItem } from "../types";

export const DownloadsPage: React.FC = () => {
  const {
    user,
    isGuest,
    downloads,
    downloadStorageUsed,
    downloadStorageLimit,
    removeDownload,
    requireSignInPrompt,
    setSelectedMovie,
    setPlayerMode,
    setCurrentView,
    fetchDownloads,
  } = useApp();

  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (user && !isGuest) fetchDownloads();
  }, [user?.id, isGuest]);

  if (isGuest || !user) {
    return (
      <div className="text-center py-24 text-neutral-500 space-y-4">
        <Download className="h-12 w-12 mx-auto text-neutral-600" />
        <h3 className="font-sans font-bold text-lg">Sign in to manage downloads</h3>
        <p className="text-xs max-w-sm mx-auto">Downloaded movies are saved to your device and tracked in your account.</p>
        <button onClick={requireSignInPrompt} className="neon-btn font-bold px-6 py-2.5 rounded-xl text-xs uppercase cursor-pointer">
          Sign In
        </button>
      </div>
    );
  }

  const used = downloadStorageUsed ?? user.downloadStorageUsed ?? 0;
  const limit = downloadStorageLimit ?? user.downloadStorageLimit ?? 2 * 1024 * 1024 * 1024;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const isFull = used >= limit;
  const isNearFull = pct >= 85;

  const handleDelete = async (item: DownloadItem) => {
    if (!confirm(`Remove "${item.title}" from Download History and delete local files?`)) return;
    setBusyId(item.movie_id);
    await removeDownload(item.movie_id);
    setBusyId(null);
  };

  const handlePlay = async (item: DownloadItem) => {
    const local = await getLocalDownload(item.movie_id);
    const poster = local?.posterPath || item.poster || "";
    setSelectedMovie({
      id: item.movie_id,
      title: item.media_type === "movie" ? item.title : undefined,
      name: item.media_type === "tv" ? item.title : undefined,
      overview: local?.overview || "",
      poster_path: poster,
      backdrop_path: local?.backdropPath || poster,
      vote_average: local?.voteAverage ?? 0,
      release_date: local?.releaseDate || undefined,
      first_air_date: local?.releaseDate || undefined,
      media_type: item.media_type,
    });
    setPlayerMode("full");
    setCurrentView("player");
  };

  return (
    <div id="downloads-view" className="p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Download className="h-6 w-6 text-[#39FF14]" />
        <div>
          <h2 className="font-sans font-bold text-xl">Download History</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Titles saved to your device and Cinemax account</p>
        </div>
      </div>

      {/* Storage quota — explicit 2GB rule */}
      <div className={`rounded-2xl border p-5 space-y-3 ${isFull ? "alert-error" : isNearFull ? "accent-chip" : "surface-panel"}`}>
        <div className="flex items-start gap-3">
          <HardDrive className={`h-5 w-5 flex-shrink-0 mt-0.5 ${isFull ? "text-rose-400" : "text-[#39FF14]"}`} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold">Website Download Storage</p>
              <p className="text-xs font-bold tabular-nums">
                {formatBytes(used)} / {formatBytes(limit)} used
              </p>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
              Each account is strictly limited to <strong className="text-neutral-300">2 GB</strong> of downloaded movies on Cinemax.
              Files are also saved to your device. When storage is full, delete items below before downloading more.
            </p>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-neutral-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isFull ? "bg-rose-500" : isNearFull ? "bg-amber-500" : "bg-[#39FF14]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {isFull && (
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-400">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            Storage full — delete downloads to free space before adding new titles.
          </div>
        )}
        {isNearFull && !isFull && (
          <p className="text-xs font-semibold text-amber-400/90">
            Warning: You are approaching your 2 GB limit ({pct}% used).
          </p>
        )}
      </div>

      {downloads.length === 0 ? (
        <div className="text-center py-20 surface-panel rounded-2xl space-y-3">
          <Download className="h-12 w-12 text-neutral-600 mx-auto" />
          <h3 className="font-sans font-bold text-lg text-neutral-400">No downloads yet</h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto px-4">
            Open any movie and tap <strong>Download</strong> on the player page. Your file will be saved to this device and listed here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {downloads.map((item) => (
            <div
              key={item.movie_id}
              className="flex items-center gap-4 p-4 rounded-2xl surface-panel hover:border-[#39FF14]/30 transition-colors"
            >
              <img
                src={item.poster ? getImageUrl(item.poster, "w200") : ""}
                alt={item.title}
                className="w-14 h-20 rounded-lg object-cover bg-neutral-800 flex-shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{item.title}</p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {item.media_type === "tv" ? "TV Show" : "Movie"} · {formatBytes(item.size_bytes)} · {new Date(item.added_at).toLocaleDateString()}
                </p>
                <p className="text-[10px] text-[#39FF14] font-semibold mt-1">Saved on device</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handlePlay(item)}
                  className="neon-btn p-2.5 rounded-xl cursor-pointer"
                  title="Play"
                >
                  <Play className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  disabled={busyId === item.movie_id}
                  className="btn-secondary p-2.5 rounded-xl text-rose-400 hover:text-rose-300 cursor-pointer disabled:opacity-50"
                  title="Delete download"
                >
                  {busyId === item.movie_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
