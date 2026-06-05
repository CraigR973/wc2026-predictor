import { useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { markRulesRead } from '@/lib/checklist';
import { cn } from '@/lib/utils';

// ── Small helpers ──────────────────────────────────────────────────────────────

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-lg border border-border bg-surface p-5 space-y-3', className)}>
      <h2 className="text-base font-semibold text-text-primary font-sans tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Pill({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={cn(
        'inline-block px-2 py-0.5 rounded-full text-xs font-mono font-semibold leading-5',
        accent
          ? 'bg-accent/15 text-accent'
          : 'bg-primary/15 text-primary',
      )}
    >
      {children}
    </span>
  );
}

// ── Scoring tables ─────────────────────────────────────────────────────────────

function GroupScoringTable() {
  const rows = [
    { criteria: 'Correct combined total goals', note: 'e.g. predicted 2–1, actual 3–0: both = 3 goals', pts: '2' },
    { criteria: 'Correct result', note: 'Win / Draw / Loss — ignoring score', pts: '3' },
    { criteria: 'Exact scoreline', note: 'Both goals correct', pts: '5' },
  ];
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm font-sans border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-3 text-text-muted font-medium text-xs uppercase tracking-wider">Criteria</th>
            <th className="text-right py-2 text-text-muted font-medium text-xs uppercase tracking-wider w-12">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.criteria} className="border-b border-border/50">
              <td className="py-2.5 pr-3">
                <p className="text-text-primary font-medium">{r.criteria}</p>
                <p className="text-xs text-text-muted mt-0.5">{r.note}</p>
              </td>
              <td className="py-2.5 text-right">
                <Pill>{r.pts}</Pill>
              </td>
            </tr>
          ))}
          <tr className="bg-surface-elevated/50">
            <td className="py-2.5 pr-3 font-semibold text-text-primary">Maximum per group stage match</td>
            <td className="py-2.5 text-right">
              <Pill accent>10</Pill>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function KnockoutWinnerTable() {
  const rounds = [
    { round: 'Round of 32', matches: 16, pts: 5, max: 80 },
    { round: 'Round of 16', matches: 8, pts: 10, max: 80 },
    { round: 'Quarter-Finals', matches: 4, pts: 15, max: 60 },
    { round: 'Semi-Finals', matches: 2, pts: 20, max: 40 },
    { round: 'Third Place Play-off', matches: 1, pts: 10, max: 10 },
    { round: 'Final', matches: 1, pts: 25, max: 25 },
  ];
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm font-sans border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-3 text-text-muted font-medium text-xs uppercase tracking-wider">Round</th>
            <th className="text-right py-2 px-2 text-text-muted font-medium text-xs uppercase tracking-wider">Per correct</th>
            <th className="text-right py-2 text-text-muted font-medium text-xs uppercase tracking-wider">Round max</th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((r) => (
            <tr key={r.round} className="border-b border-border/50">
              <td className="py-2.5 pr-3 text-text-primary">{r.round}</td>
              <td className="py-2.5 px-2 text-right">
                <Pill>{r.pts}</Pill>
              </td>
              <td className="py-2.5 text-right text-text-secondary font-mono text-xs">{r.max}</td>
            </tr>
          ))}
          <tr className="bg-surface-elevated/50">
            <td className="py-2.5 pr-3 font-semibold text-text-primary">Total — 32 picks</td>
            <td className="py-2.5 px-2" />
            <td className="py-2.5 text-right">
              <Pill accent>295</Pill>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SpecialsTable() {
  const rows = [
    { prediction: 'Tournament Winner (pre-tournament)', pts: 20 },
    { prediction: 'Golden Boot (top scorer — free text)', pts: 15 },
    { prediction: 'Top Scoring Team', pts: 10 },
  ];
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm font-sans border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-3 text-text-muted font-medium text-xs uppercase tracking-wider">Prediction</th>
            <th className="text-right py-2 text-text-muted font-medium text-xs uppercase tracking-wider w-12">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.prediction} className="border-b border-border/50">
              <td className="py-2.5 pr-3 text-text-primary">{r.prediction}</td>
              <td className="py-2.5 text-right">
                <Pill>{r.pts}</Pill>
              </td>
            </tr>
          ))}
          <tr className="bg-surface-elevated/50">
            <td className="py-2.5 pr-3 font-semibold text-text-primary">Total specials</td>
            <td className="py-2.5 text-right">
              <Pill accent>45</Pill>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function MaximumBreakdown() {
  const rows = [
    { label: 'Group stage', detail: '72 matches × 10 pts', pts: 720 },
    { label: 'Knockout score predictions', detail: '32 matches × 10 pts', pts: 320 },
    { label: 'Knockout winner picks', detail: 'All 32 matches across 6 rounds', pts: 295 },
    { label: 'Special predictions', detail: 'Winner, Golden Boot, Top Team', pts: 45 },
  ];
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-sans text-text-primary font-medium truncate">{r.label}</p>
            <p className="text-xs font-sans text-text-muted">{r.detail}</p>
          </div>
          <span className="font-mono text-sm text-text-secondary shrink-0">{r.pts}</span>
        </div>
      ))}
      <div className="pt-2 border-t border-border flex items-center justify-between">
        <span className="text-sm font-sans font-semibold text-text-primary">Grand total</span>
        <Pill accent>1,380</Pill>
      </div>
    </div>
  );
}

// ── Tournament flow section ────────────────────────────────────────────────────

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-mono font-semibold tracking-[0.2em] uppercase text-text-muted mb-2 mt-5 first:mt-0">
      {children}
    </h3>
  );
}

function BulletList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="mt-[5px] shrink-0 w-1.5 h-1.5 rounded-full bg-primary/60" aria-hidden />
          <span className="text-sm font-sans text-text-secondary leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function WhyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface-elevated px-4 py-4 space-y-2">
      {children}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function AboutPage() {
  // Viewing the rules satisfies the pre-tournament checklist's "Read the rules"
  // item (U20.4).
  useEffect(() => {
    markRulesRead();
  }, []);

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="About" eyebrow="Calcio" showBack />

      {/* What this is */}
      <Section title="What is this?">
        <p className="text-sm font-sans text-text-secondary leading-relaxed">
          A private, invite-only prediction league for the 2026 FIFA World Cup. Up to 15 players
          compete across the entire tournament — 72 group-stage matches and 32 knockout fixtures,
          from the Round of 32 all the way to the Final. Predictions lock automatically at each
          match&rsquo;s kickoff, results are fetched automatically, and the leaderboard updates in
          real time.
        </p>
      </Section>

      {/* How scoring works */}
      <Section title="How scoring works">
        <div className="space-y-5">

          <div>
            <h3 className="text-xs font-mono font-semibold tracking-[0.2em] uppercase text-text-muted mb-2">
              Group stage
            </h3>
            <GroupScoringTable />
            <p className="text-xs text-text-muted mt-2 font-sans">
              Points stack — a correct exact score is worth all three rows (2 + 3 + 5 = 10).
            </p>
          </div>

          <div>
            <h3 className="text-xs font-mono font-semibold tracking-[0.2em] uppercase text-text-muted mb-2">
              Knockout score predictions
            </h3>
            <p className="text-sm text-text-secondary font-sans leading-relaxed">
              The same group-stage rules apply, but to the 90-minute score only. Extra time and
              penalties determine who advances, but don&rsquo;t affect points. A match that ends
              1–1 after 90 minutes (then decided on penalties) is scored as a 1–1 draw for
              prediction purposes. Maximum 10 pts per knockout match.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-mono font-semibold tracking-[0.2em] uppercase text-text-muted mb-2">
              Knockout winner picks (per round)
            </h3>
            <KnockoutWinnerTable />
            <p className="text-xs text-text-muted mt-2 font-sans">
              Submitted round by round as teams are determined. Locked at the kickoff of the first
              match in each round.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-mono font-semibold tracking-[0.2em] uppercase text-text-muted mb-2">
              Special predictions
            </h3>
            <SpecialsTable />
            <p className="text-xs text-text-muted mt-2 font-sans">
              Submitted before the tournament begins. Awarded at the end of the tournament.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-mono font-semibold tracking-[0.2em] uppercase text-text-muted mb-2">
              Maximum possible points
            </h3>
            <div className="rounded-lg border border-border bg-surface-elevated p-4">
              <MaximumBreakdown />
            </div>
          </div>

        </div>
      </Section>

      {/* How it works through the tournament */}
      <Section title="How it works through the tournament">
        <div>
          <SubHead>Joining</SubHead>
          <BulletList items={[
            'You\'ll get a unique invite link from the admin (over WhatsApp).',
            'Click the link, choose your display name, set your own 4–8 digit PIN.',
            <>Nobody — not even the admin — sees your PIN.</>,
            'Forgot it? Reset via the app.',
          ]} />

          <SubHead>Group stage — 11–28 June</SubHead>
          <BulletList items={[
            'Predict each match\'s score any time before kickoff.',
            'Predictions lock automatically when the match kicks off.',
            <>Results auto-fetch every 5 minutes from <span className="text-text-primary font-medium">football-data.org</span>.</>,
            'The leaderboard updates the moment a result lands.',
            'Compare your predictions head-to-head against any other player after a match locks.',
          ]} />

          <SubHead>Knockout transitions</SubHead>
          <BulletList items={[
            <>After the group stage, the admin reviews standings (including the 8 best third-placed teams per FIFA rules) and triggers the advance to Round of 32.</>,
            'The 16 R32 matches appear in the app with kickoff times pulled from football-data.',
            <>Predict the <strong className="text-text-primary font-semibold">winner</strong> of each knockout match (not the score) before the first R32 match kicks off. Points increase as the stakes do: <Pill>R32 = 5</Pill> <Pill>R16 = 10</Pill> <Pill>QF = 15</Pill> <Pill>SF = 20</Pill> <Pill>3rd = 10</Pill> <Pill>Final = 25</Pill>.</>,
            'Knockout score predictions (separate from winner picks) also continue — same group-stage points system applied to the 90-min score.',
            'Same flow repeats for R16, QF, SF, and the Final.',
          ]} />

          <SubHead>Special predictions — locked at the opening match</SubHead>
          <BulletList items={[
            <>Three special predictions submitted <strong className="text-text-primary font-semibold">before the tournament starts</strong>: Tournament Winner <Pill>20 pts</Pill>, Golden Boot <Pill>15 pts</Pill>, Top Scoring Team <Pill>10 pts</Pill>.</>,
            'These lock at the kickoff of the opening match (11 June).',
            'Awarded by the admin at the end of the tournament once the final whistle goes — your predictions are safe until then.',
          ]} />

          <SubHead>Why per-round predictions, not a pre-tournament bracket?</SubHead>
          <p className="text-sm font-sans text-text-secondary leading-relaxed mb-3">
            Some leagues ask you to fill your entire bracket before the tournament starts,
            March-Madness-style. This league does it round by round. Here's why it's better:
          </p>
          <WhyCard>
            <BulletList items={[
              <><strong className="text-text-primary font-semibold">You're never out.</strong> Even if your favourite gets knocked out in R32, you're still competing in every remaining round.</>,
              <><strong className="text-text-primary font-semibold">More informed picks.</strong> You've seen the group stage form before you commit to R32 winners.</>,
              <><strong className="text-text-primary font-semibold">Joining late is fine.</strong> You can still play even if you missed some group matches.</>,
              <><strong className="text-text-primary font-semibold">More moments.</strong> Every round transition is a fresh set of predictions and fresh trash talk on the group chat.</>,
            ]} />
          </WhyCard>
        </div>
      </Section>

      {/* How it was built */}
      <Section title="How it was built">
        <p className="text-sm font-sans text-text-secondary leading-relaxed">
          Built by Craig Robinson and Lewis Steele. The frontend is a React 18 PWA hosted on
          Vercel; the backend is a FastAPI service running on Railway backed by a Supabase Postgres
          database. Match results are fetched automatically from{' '}
          <a
            href="https://www.football-data.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-2 hover:underline inline-flex items-center gap-0.5"
          >
            football-data.org
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
          . Push notifications use the Web Push / VAPID standard.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {['React 18', 'Vite', 'FastAPI', 'PostgreSQL', 'Vercel', 'Railway', 'Supabase', 'Workbox'].map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 rounded-md bg-surface-elevated border border-border text-xs font-mono text-text-secondary"
            >
              {tag}
            </span>
          ))}
        </div>
      </Section>

      {/* Footer credit */}
      <p className="text-center text-xs font-sans text-text-muted pb-2">
        A friends league, built properly.
      </p>
    </div>
  );
}
