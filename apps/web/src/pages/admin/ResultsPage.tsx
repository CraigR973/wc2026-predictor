import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface AdminMatchResult {
  match_id: string;
  match_number: number;
  status: string;
  kickoff_utc: string;
  home_team: string | null;
  away_team: string | null;
  actual_home_score: number | null;
  actual_away_score: number | null;
  extra_time: boolean;
  penalties: boolean;
  result_source: 'auto' | 'manual' | 'override' | null;
  result_entered_at: string | null;
}

type SourceVariant = 'success' | 'muted' | 'warning';

function sourceVariant(source: AdminMatchResult['result_source']): SourceVariant {
  if (source === 'auto') return 'success';
  if (source === 'override') return 'warning';
  return 'muted';
}

function sourceLabel(source: AdminMatchResult['result_source']): string {
  const map: Record<string, string> = {
    auto: 'Auto',
    manual: 'Manual',
    override: 'Override',
  };
  return source ? (map[source] ?? source) : '—';
}

export function AdminResultsPage() {
  const { data, isLoading, error } = useQuery<AdminMatchResult[]>({
    queryKey: ['admin', 'results'],
    queryFn: () => apiFetch<AdminMatchResult[]>('/api/v1/admin/results'),
    staleTime: 30_000,
  });

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to="/admin" className="text-text-muted hover:text-text-primary text-sm font-sans">
          ← Admin
        </Link>
        <h1 className="font-display text-3xl text-primary tracking-wider">Results</h1>
      </div>

      {error && (
        <p className="text-error text-sm font-sans mb-4">Failed to load results.</p>
      )}

      {isLoading && (
        <p className="text-text-muted text-sm font-sans">Loading…</p>
      )}

      {data && data.length === 0 && (
        <p className="text-text-muted text-sm font-sans">No completed matches yet.</p>
      )}

      {data && data.length > 0 && (
        <div className="space-y-2">
          {data.map((m) => {
            const homeLabel = m.home_team ?? '?';
            const awayLabel = m.away_team ?? '?';
            const kickoff = formatInTimeZone(new Date(m.kickoff_utc), 'UTC', 'dd MMM HH:mm');

            return (
              <Card key={m.match_id}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-text-muted w-10 shrink-0">
                      #{m.match_number}
                    </span>

                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <span className="text-sm font-sans text-text-primary truncate">
                        {homeLabel}
                      </span>
                      <span className="font-display text-primary shrink-0">
                        {m.actual_home_score ?? '?'} – {m.actual_away_score ?? '?'}
                      </span>
                      <span className="text-sm font-sans text-text-primary truncate">
                        {awayLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {m.extra_time && !m.penalties && (
                        <Badge variant="muted">AET</Badge>
                      )}
                      {m.penalties && (
                        <Badge variant="muted">Pens</Badge>
                      )}
                      <Badge variant={sourceVariant(m.result_source)}>
                        {sourceLabel(m.result_source)}
                      </Badge>
                    </div>

                    <span className="text-xs font-mono text-text-muted shrink-0 hidden sm:block">
                      {kickoff}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
