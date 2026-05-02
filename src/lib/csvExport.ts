import { format } from 'date-fns';
import type { MessageBatch, MessageLog } from './types';

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function downloadCsv(filename: string, csvContent: string): Promise<void> {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };

  if (typeof window !== 'undefined' && typeof nav.share === 'function') {
    try {
      const file = new File([blob], filename, { type: 'text/csv' });
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ title: filename, files: [file] });
        return;
      }
    } catch {
      // Fall through to anchor/data-url fallback.
    }
  }

  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  } catch {
    // Fall through to data URL fallback.
  }

  const dataUri = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
  const fallbackLink = document.createElement('a');
  fallbackLink.href = dataUri;
  fallbackLink.download = filename;
  fallbackLink.target = '_blank';
  document.body.appendChild(fallbackLink);
  fallbackLink.click();
  document.body.removeChild(fallbackLink);
}

export async function exportAnalyticsReport(batches: MessageBatch[]) {
  const headers = ['Batch ID', 'Message', 'Recipients', 'Sent', 'Failed', 'Status', 'Created At', 'Completed At'];
  const rows = batches.map((b) => [
    String(b.id ?? ''),
    escapeCsv(b.body),
    String(b.recipientCount),
    String(b.sentCount),
    String(b.failedCount),
    b.status,
    format(b.createdAt, 'yyyy-MM-dd HH:mm:ss'),
    b.completedAt ? format(b.completedAt, 'yyyy-MM-dd HH:mm:ss') : '',
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  await downloadCsv(`analytics-report-${format(new Date(), 'yyyy-MM-dd')}.csv`, csv);
}

export async function exportBatchDetails(batch: MessageBatch, logs: MessageLog[]) {
  const headers = ['Contact Name', 'Phone', 'Status', 'Sent At', 'Error'];
  const rows = logs.map((l) => [
    escapeCsv(l.contactName),
    escapeCsv(l.contactPhone),
    l.status,
    l.sentAt ? format(l.sentAt, 'yyyy-MM-dd HH:mm:ss') : '',
    l.error ? escapeCsv(l.error) : '',
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const safeName = batch.body.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
  await downloadCsv(`batch-${safeName}-${format(new Date(), 'yyyy-MM-dd')}.csv`, csv);
}
