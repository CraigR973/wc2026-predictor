import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import type { LeagueSummary } from '../lib/types';

const ACTIVE_LEAGUE_KEY = 'wc2026_active_league_slug';

interface LeagueContextValue {
  leagues: LeagueSummary[];
  activeLeague: LeagueSummary | null;
  setActiveLeague: (slug: string) => void;
  isLoading: boolean;
  refetch: () => void;
}

const LeagueContext = createContext<LeagueContextValue | null>(null);

export function LeagueProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeSlug, setActiveSlug] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_LEAGUE_KEY),
  );

  const { data: leagues = [], isLoading } = useQuery<LeagueSummary[]>({
    queryKey: ['leagues', 'mine'],
    queryFn: () => apiFetch<LeagueSummary[]>('/api/v1/leagues/mine'),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (isLoading) return;

    if (leagues.length === 0) {
      navigate('/welcome', { replace: true });
      return;
    }

    if (!activeSlug || !leagues.find((l) => l.slug === activeSlug)) {
      const slug = leagues[0].slug;
      setActiveSlug(slug);
      localStorage.setItem(ACTIVE_LEAGUE_KEY, slug);
    }
  }, [leagues, isLoading, activeSlug, navigate]);

  const setActiveLeague = useCallback((slug: string) => {
    setActiveSlug(slug);
    localStorage.setItem(ACTIVE_LEAGUE_KEY, slug);
  }, []);

  const refetchLeagues = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['leagues', 'mine'] });
  }, [queryClient]);

  const activeLeague = leagues.find((l) => l.slug === activeSlug) ?? null;

  return (
    <LeagueContext.Provider
      value={{
        leagues,
        activeLeague,
        setActiveLeague,
        isLoading,
        refetch: refetchLeagues,
      }}
    >
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeague(): LeagueContextValue {
  const ctx = useContext(LeagueContext);
  if (!ctx) throw new Error('useLeague must be used within LeagueProvider');
  return ctx;
}

/** Returns null when called outside LeagueProvider. Use in components that may render in both contexts (e.g. TopBar in tests). */
export function useLeagueOptional(): LeagueContextValue | null {
  return useContext(LeagueContext);
}

/** Sync the active league from the URL :slug param on league-scoped pages. */
export function useLeagueSlugSync(slug: string | undefined) {
  const { setActiveLeague } = useLeague();
  useEffect(() => {
    if (slug) setActiveLeague(slug);
  }, [slug, setActiveLeague]);
}
