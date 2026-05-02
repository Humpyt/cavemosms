import { KeyRound, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface LicenseGateProps {
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onActivate: () => void;
  activating: boolean;
  error?: string;
}

export default function LicenseGate({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onActivate,
  activating,
  error,
}: LicenseGateProps) {
  return (
    <div className="min-h-screen bg-app px-4 py-8">
      <div className="mx-auto max-w-lg">
        <Card className="surface-card border-border/70">
          <CardContent className="space-y-4 p-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                License Required
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold">Activate UG Live BulkSMS</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Sign in with your customer account to unlock this app on this device.
              </p>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => onEmailChange(event.target.value)}
                  className="pl-9"
                  placeholder="Email"
                />
              </div>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => onPasswordChange(event.target.value)}
                  className="pl-9"
                  placeholder="Password"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}

            <Button className="w-full gap-2" onClick={onActivate} disabled={activating}>
              <Lock className="h-4 w-4" />
              {activating ? 'Activating...' : 'Activate Device'}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Need access? Contact <a className="underline" href="mailto:2humpyt@gmail.com">2humpyt@gmail.com</a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
