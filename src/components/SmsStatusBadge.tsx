import { Smartphone, SmartphoneNfc, TriangleAlert } from 'lucide-react';
import { useNativeSms } from '@/hooks/useNativeSms';

export default function SmsStatusBadge() {
  const { serviceStatus, canSend, queuedCount, capability } = useNativeSms();

  if (serviceStatus === 'checking') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="w-2 h-2 rounded-full bg-muted animate-pulse" />
        <span className="hidden sm:inline">Checking SMS</span>
      </div>
    );
  }

  if (serviceStatus === 'unsupported') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-destructive">
        <TriangleAlert className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">SMS unavailable</span>
      </div>
    );
  }

  if (!canSend) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-warning">
        <Smartphone className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Grant SMS permission</span>
        {queuedCount > 0 && (
          <span className="text-[10px] bg-warning/15 px-1.5 py-0.5 rounded-full">{queuedCount} queued</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-success">
      <SmartphoneNfc className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">
        {capability.model ? `${capability.model}` : 'Native SMS ready'}
      </span>
      {queuedCount > 0 && (
        <span className="text-[10px] bg-success/15 px-1.5 py-0.5 rounded-full">{queuedCount} queued</span>
      )}
    </div>
  );
}
