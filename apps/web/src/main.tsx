import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const tokens = [
  { name: 'background', value: '#0A0F1E' },
  { name: 'surface', value: '#131929' },
  { name: 'surface-elevated', value: '#1C2540' },
  { name: 'border', value: '#263354' },
  { name: 'text-primary', value: '#F0F4FF' },
  { name: 'text-secondary', value: '#8A9CC7' },
  { name: 'text-muted', value: '#4A5A80' },
  { name: 'primary', value: '#00E676' },
  { name: 'primary-dark', value: '#00B854' },
  { name: 'accent', value: '#3D7FFF' },
  { name: 'gold', value: '#FFD700' },
  { name: 'silver', value: '#C0C0C0' },
  { name: 'bronze', value: '#CD7F32' },
  { name: 'warning', value: '#FF9800' },
  { name: 'error', value: '#FF4757' },
];

function App() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-10">

        {/* Header */}
        <div>
          <h1 className="font-display text-6xl text-primary tracking-wider">WC 2026 PREDICTOR</h1>
          <p className="text-text-secondary mt-2 font-sans">Phase 0.3 — Design System Preview</p>
        </div>

        {/* Colour Palette */}
        <Card>
          <CardHeader>
            <CardTitle>Colour Tokens</CardTitle>
            <CardDescription>§7.2 — all design system colours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {tokens.map(({ name, value }) => (
                <div key={name} className="flex flex-col gap-1.5">
                  <div
                    className="h-12 rounded-lg border border-border"
                    style={{ backgroundColor: value }}
                  />
                  <p className="text-xs text-text-secondary font-mono leading-tight">{name}</p>
                  <p className="text-xs text-text-muted font-mono">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Typography */}
        <Card>
          <CardHeader>
            <CardTitle>Typography</CardTitle>
            <CardDescription>Bebas Neue · Outfit · JetBrains Mono</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-text-muted mb-1">Bebas Neue — display/scores</p>
              <p className="font-display text-5xl text-primary tracking-wide">3 — 1</p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">Outfit 700 — headings</p>
              <p className="font-sans font-bold text-2xl text-text-primary">Leaderboard</p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">Outfit 400 — body</p>
              <p className="font-sans text-base text-text-secondary">
                England vs Spain · Group D · Matchday 2
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">JetBrains Mono — timestamps</p>
              <p className="font-mono text-sm text-text-secondary">14 Jun 2026 · 20:00 BST</p>
            </div>
          </CardContent>
        </Card>

        {/* Buttons */}
        <Card>
          <CardHeader>
            <CardTitle>Buttons</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="default">Submit Prediction</Button>
            <Button variant="accent">View Bracket</Button>
            <Button variant="outline">Edit</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="destructive">Delete</Button>
            <Button variant="default" size="sm">Small</Button>
            <Button variant="default" size="lg">Large CTA</Button>
          </CardContent>
        </Card>

        {/* Badges */}
        <Card>
          <CardHeader>
            <CardTitle>Badges</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="default">+10 pts</Badge>
            <Badge variant="accent">Group D</Badge>
            <Badge variant="gold">1st</Badge>
            <Badge variant="silver">2nd</Badge>
            <Badge variant="bronze">3rd</Badge>
            <Badge variant="success">Correct</Badge>
            <Badge variant="warning">Deadline soon</Badge>
            <Badge variant="error">Wrong</Badge>
            <Badge variant="muted">Locked</Badge>
            <Badge variant="live">LIVE</Badge>
          </CardContent>
        </Card>

        {/* Leaderboard Card Sample */}
        <Card>
          <CardHeader>
            <CardTitle>Leaderboard Row Sample</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { rank: '1', name: 'Craig Robinson', pts: 847, round: '+32', medal: 'text-gold' },
              { rank: '2', name: 'Jamie Byrne', pts: 801, round: '+28', medal: 'text-silver' },
              { rank: '3', name: 'Alex Chen', pts: 774, round: '+25', medal: 'text-bronze' },
            ].map(({ rank, name, pts, round, medal }) => (
              <div
                key={rank}
                className="flex items-center gap-4 rounded-lg bg-surface-elevated px-4 py-3 border border-border"
              >
                <span className={`font-display text-3xl w-8 text-center ${medal}`}>{rank}</span>
                <span className="flex-1 font-sans font-medium text-text-primary">{name}</span>
                <span className="font-display text-2xl text-text-primary">{pts}</span>
                <Badge variant="success">{round}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
