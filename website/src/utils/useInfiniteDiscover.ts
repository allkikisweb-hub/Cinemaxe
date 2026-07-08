import { useState, useRef, useCallback, useEffect } from "react";
import { Movie } from "../types";

export interface DiscoverPage {
  results: Movie[];
  totalPages: number;
}

/**
 * Drives an infinite-scroll / "Load More" grid against a paginated TMDB
 * fetcher. Re-runs from page 1 whenever `fetcher` changes identity (callers
 * should memoize/recreate the fetcher when the active genre/collection changes).
 */
export function useInfiniteDiscover(fetcher: (page: number) => Promise<DiscoverPage>, resetKey: string) {
  const [items, setItems] = useState<Movie[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const seenIds = useRef<Set<number>>(new Set());
  const currentResetKey = useRef(resetKey);

  const loadPage = useCallback(
    async (pageToLoad: number, isReset: boolean) => {
      setLoading(true);
      try {
        const { results, totalPages: tp } = await fetcher(pageToLoad);
        if (isReset) seenIds.current = new Set();
        const fresh = results.filter((m) => !seenIds.current.has(m.id));
        fresh.forEach((m) => seenIds.current.add(m.id));
        setItems((prev) => (isReset ? fresh : [...prev, ...fresh]));
        setTotalPages(tp);
        setPage(pageToLoad);
      } catch {
        // leave existing items in place on failure
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [fetcher]
  );

  // Reset and reload when the caller signals a new genre/collection
  useEffect(() => {
    currentResetKey.current = resetKey;
    setInitialLoading(true);
    setItems([]);
    loadPage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const hasMore = page < totalPages;

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    loadPage(page + 1, false);
  }, [loading, hasMore, page, loadPage]);

  return { items, loading, initialLoading, hasMore, loadMore };
}
