import { useGateway } from '@/hooks/useGateway';
import { Wifi, WifiOff } from 'lucide-react';

export default function GatewayStatusBadge() {
  const { status, deviceName, queuedCount } = useGateway();

  if (status === 'idle' || status === 'discovering') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="w-2 h-2 rounded-full bg-muted animate-pulse" />
        <span className="hidden sm:inline">Finding gateway...</span>
      </div>
    );
  }

  if (status === 'offline' || status === 'error') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-destructive">
        <WifiOff className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Gateway offline</span>
        {queuedCount && queuedCount > 0 && (
          <span className="text-[10px] bg-destructive/10 px-1.5 py-0.5 rounded-full">{queuedCount} queued</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-success">
      <Wifi className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{deviceName}</span>
    </div>
  );
}
