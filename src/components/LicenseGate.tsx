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
    <div className="min-h-screen bg-background px-6 py-12 flex flex-col justify-center">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] bg-primary/10">
            <img src="/logo.png" alt="Camo SMS" className="h-12 w-12 object-contain" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Sign In</h1>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            Activate your Camo SMS license.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-3">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                className="h-14 pl-12 rounded-[24px] bg-secondary border-0 text-[15px] font-medium shadow-none focus-visible:ring-1 focus-visible:ring-primary/30"
                placeholder="Email address"
              />
            </div>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                className="h-14 pl-12 rounded-[24px] bg-secondary border-0 text-[15px] font-medium shadow-none focus-visible:ring-1 focus-visible:ring-primary/30"
                placeholder="Password"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-[16px] border border-destructive/20 bg-destructive/10 px-4 py-3 text-center text-xs font-bold text-destructive">
              {error}
            </p>
          )}

          <button
            className="w-full h-14 rounded-[24px] bg-primary text-primary-foreground font-bold text-[15px] hover:bg-primary/90 transition-colors flex items-center justify-center disabled:opacity-50"
            onClick={onActivate}
            disabled={activating}
          >
            {activating ? 'Signing in...' : 'Sign In'}
          </button>

          <p className="mt-8 text-center text-[13px] font-semibold text-muted-foreground">
            Need access? <a className="text-foreground hover:text-primary transition-colors underline decoration-border underline-offset-4" href="mailto:2humpyt@gmail.com">Contact Support</a>
          </p>
        </div>
      </div>
    </div>
  );
}
