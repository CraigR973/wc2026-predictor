import { useSearchParams, Link } from 'react-router-dom';
import { Brand } from '@/components/Brand';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function WelcomePage() {
  const [searchParams] = useSearchParams();
  const invite = searchParams.get('invite');

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4 pt-safe pb-safe">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <Brand variant="splash" />
          <p className="mt-4 text-text-secondary font-sans text-sm">
            You&apos;re in! Choose how to get started.
          </p>
        </div>

        <div className="space-y-4">
          {invite && (
            <Card className="border-primary/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Join with your invite</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-text-secondary font-sans mb-3">
                  You were invited to join a league — click below to accept.
                </p>
                <Button asChild className="w-full">
                  <Link to={`/join/${invite}`}>Accept invite</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Create a league</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-text-secondary font-sans mb-3">
                Start your own league and invite friends to predict alongside you.
              </p>
              <Button asChild variant={invite ? 'outline' : 'default'} className="w-full">
                <Link to="/leagues/new">Create league</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Browse public leagues</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-text-secondary font-sans mb-3">
                Find an open league and join the fun.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/leagues/discover">Browse leagues</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
