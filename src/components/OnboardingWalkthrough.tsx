import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  ChevronRight,
  FileSpreadsheet,
  MessageSquareShare,
  ShieldCheck,
  Users2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const SPLASH_DURATION_MS = 1900;

const steps = [
  {
    icon: MessageSquareShare,
    eyebrow: 'Campaign Engine',
    title: 'Launch a batch in minutes, not menus.',
    description:
      'Write one message, personalize it with placeholders, and send it through the phone already in your hand.',
    accent:
      'from-primary/25 via-primary/10 to-primary/5',
    statLabel: 'Delivery lane',
    statValue: 'Native Android SMS',
    bullets: ['Personalize with {name}', 'Queue and retry safely'],
  },
  {
    icon: FileSpreadsheet,
    eyebrow: 'Contact Intake',
    title: 'Pull messy lists into a clean sending roster.',
    description:
      'Import CSV or phone-only files, spot duplicates before they land, and keep tags ready for targeting.',
    accent:
      'from-primary/25 via-primary/10 to-primary/5',
    statLabel: 'Accepted formats',
    statValue: 'CSV, TXT, paste',
    bullets: ['Detect duplicates early', 'Use tags for quick segments'],
  },
  {
    icon: BarChart3,
    eyebrow: 'Operational View',
    title: 'Track what shipped, failed, and needs attention.',
    description:
      'Review batches, retry problem sends, and export evidence when a campaign needs a paper trail.',
    accent:
      'from-primary/25 via-primary/10 to-primary/5',
    statLabel: 'Visibility',
    statValue: 'Batch analytics',
    bullets: ['See queued vs sent', 'Export campaign records'],
  },
  {
    icon: ShieldCheck,
    eyebrow: 'Ready State',
    title: 'Give the app permission once, then move fast.',
    description:
      'Enable SMS access, verify your SIM is active, and you are ready to run local outreach without extra infrastructure.',
    accent:
      'from-primary/25 via-primary/10 to-primary/5',
    statLabel: 'First action',
    statValue: 'Open Settings, allow SMS',
    bullets: ['Grant send and read access', 'Confirm dual-SIM selection if needed'],
  },
];

interface OnboardingWalkthroughProps {
  open: boolean;
  onComplete: () => void;
}

export default function OnboardingWalkthrough({ open, onComplete }: OnboardingWalkthroughProps) {
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<'splash' | 'walkthrough'>('splash');

  useEffect(() => {
    if (!open) {
      setStep(0);
      setPhase('splash');
      return;
    }

    setStep(0);
    setPhase('splash');

    const timeout = window.setTimeout(() => {
      setPhase('walkthrough');
    }, SPLASH_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [open]);

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const progressLabel = useMemo(() => `${step + 1} / ${steps.length}`, [step]);

  function handleNext() {
    if (isLast) {
      onComplete();
      return;
    }

    setStep((value) => value + 1);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onComplete()}>
      <DialogContent className="max-w-[94vw] border-0 bg-transparent p-0 shadow-none [&>button]:hidden sm:max-w-md">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-slate-950 text-white shadow-[0_30px_120px_rgba(15,23,42,0.45)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(45,212,191,0.18),_transparent_24%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))]" />
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          <div className="pointer-events-none absolute -left-14 top-16 h-40 w-40 rounded-full bg-primary/20 blur-3xl splash-orb-float" />
          <div className="pointer-events-none absolute -right-10 bottom-12 h-36 w-36 rounded-full bg-primary/20 blur-3xl splash-orb-float-delayed" />

          <AnimatePresence mode="wait">
            {phase === 'splash' ? (
              <motion.div
                key="splash"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, y: -24 }}
                transition={{ duration: 0.35 }}
                className="relative flex min-h-[560px] flex-col justify-between p-6 sm:p-7"
              >
                <div className="space-y-5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/90">
                    <img src="/logo.png" className="h-3.5 w-3.5 object-contain" alt="Logo" />
                    Camo SMS
                  </div>

                  <div className="space-y-3">
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.4 }}
                      className="flex items-center gap-3"
                    >
                      <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-white/10 ring-1 ring-white/15 backdrop-blur">
                        <MessageSquareShare className="h-8 w-8 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Mobile dispatch studio</p>
                        <h2 className="font-display text-3xl font-semibold leading-none">
                          Send smarter.
                        </h2>
                      </div>
                    </motion.div>

                    <motion.p
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.18, duration: 0.45 }}
                      className="max-w-xs text-sm leading-6 text-slate-300"
                    >
                      Built for field teams, schools, campaigns, and operations crews that need clean contact handling and reliable native SMS delivery.
                    </motion.p>
                  </div>
                </div>

                <div className="relative mt-8 overflow-hidden rounded-[1.75rem] border border-white/12 bg-white/8 p-4 backdrop-blur-xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
                  <div className="relative space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-300">Live workflow</p>
                        <p className="mt-1 font-display text-xl font-semibold">Audience to delivery</p>
                      </div>
                      <div className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                        Native SMS
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-left">
                      <div className="rounded-2xl border border-white/10 bg-slate-900/45 p-3">
                        <Users2 className="mb-3 h-4 w-4 text-primary" />
                        <p className="text-lg font-semibold">01</p>
                        <p className="text-xs text-slate-400">Import lists</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-900/45 p-3">
                        <MessageSquareShare className="mb-3 h-4 w-4 text-primary" />
                        <p className="text-lg font-semibold">02</p>
                        <p className="text-xs text-slate-400">Build message</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-900/45 p-3">
                        <BarChart3 className="mb-3 h-4 w-4 text-primary" />
                        <p className="text-lg font-semibold">03</p>
                        <p className="text-xs text-slate-400">Review outcomes</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between text-xs text-slate-400">
                  <span>Preparing workspace</span>
                  <span className="splash-loader h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                    <span className="block h-full w-1/2 rounded-full bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
                  </span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -24 }}
                transition={{ duration: 0.28 }}
                className="relative min-h-[560px] p-6 sm:p-7"
              >
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">
                        {current.eyebrow}
                      </p>
                      <div className="space-y-2">
                        <h2 className="max-w-xs font-display text-[2rem] font-semibold leading-[1.02] text-white">
                          {current.title}
                        </h2>
                        <p className="max-w-sm text-sm leading-6 text-slate-300">
                          {current.description}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-[1.4rem] border border-white/12 bg-white/8 p-3 backdrop-blur">
                      <current.icon className="h-7 w-7 text-white" />
                    </div>
                  </div>

                  <div className={`relative overflow-hidden rounded-[1.75rem] border border-white/12 bg-gradient-to-br ${current.accent} p-4`}>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.2),_transparent_35%)]" />
                    <div className="relative flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-white/70">{current.statLabel}</p>
                        <p className="mt-2 font-display text-2xl font-semibold text-white">{current.statValue}</p>
                      </div>
                      <div className="rounded-full border border-white/20 bg-slate-950/30 px-3 py-1 text-[11px] font-medium text-white/90">
                        {progressLabel}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {current.bullets.map((bullet) => (
                      <div
                        key={bullet}
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-slate-200"
                      >
                        <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-primary to-primary/80" />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-10 flex items-center justify-between gap-4">
                  <div className="flex gap-2">
                    {steps.map((_, index) => (
                      <div
                        key={index}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          index === step ? 'w-8 bg-white' : 'w-2 bg-white/20'
                        }`}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onComplete}
                      className="rounded-full px-4 text-slate-300 hover:bg-white/10 hover:text-white"
                    >
                      Skip
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleNext}
                      className="rounded-full bg-white px-4 text-slate-950 hover:bg-slate-100"
                    >
                      {isLast ? 'Open workspace' : 'Continue'}
                      {!isLast && <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
