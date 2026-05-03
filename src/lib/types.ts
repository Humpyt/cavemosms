export interface Contact {
  id?: number;
  name: string;
  phone: string;
  email?: string;
  location?: string;
  tags: string[];
  groupIds: number[];
  optedOut: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Group {
  id?: number;
  name: string;
  color: string;
  createdAt: Date;
}

export interface MessageTemplate {
  id?: number;
  name: string;
  body: string;
  placeholders: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageBatch {
  id?: number;
  body: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  status: 'pending' | 'sending' | 'completed' | 'scheduled' | 'paused' | 'cancelled';
  scheduledAt?: Date;
  recurringType?: 'none' | 'daily' | 'weekly' | 'monthly';
  createdAt: Date;
  completedAt?: Date;
}

export interface MessageLog {
  id?: number;
  batchId: number;
  contactId: number;
  contactName: string;
  contactPhone: string;
  body: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  retryCount?: number;
  nextRetryAt?: Date;
  lastAttemptAt?: Date;
  sentAt?: Date;
  error?: string;
  nativeRequestId?: string;
}

export interface SendResult {
  messageId: string;
  success: boolean;
  error?: string;
}

export type NativePermissionState = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';

export interface SmsSubscription {
  id: number;
  slotIndex: number;
  displayName: string;
  carrierName: string;
  defaultSms: boolean;
}

export interface NativeSmsCapability {
  supported: boolean;
  canSend: boolean;
  smsPermission: NativePermissionState;
  phonePermission: NativePermissionState;
  defaultSubscriptionId: number;
  subscriptions: SmsSubscription[];
  manufacturer?: string;
  model?: string;
}

export type NativeSmsServiceStatus = 'checking' | 'ready' | 'blocked' | 'unsupported' | 'error';

export interface AppSettings {
  id?: number;
  language: string;
  theme: 'light' | 'dark' | 'system';
  sendDelay: number; // ms between messages
  maxRetries: number;
  preferredSubscriptionId: number | null;
  customVariables?: Array<{ key: string; value: string }>;
}

export type TabId = 'messages' | 'contacts' | 'templates' | 'analytics' | 'settings';

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt', name: 'Português' },
  { code: 'ar', name: 'العربية' },
  { code: 'zh', name: '中文' },
  { code: 'hi', name: 'हिन्दी' },
] as const;

export const GROUP_COLORS = [
  'hsl(225, 65%, 45%)',
  'hsl(152, 60%, 42%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 51%)',
  'hsl(280, 60%, 50%)',
  'hsl(180, 60%, 40%)',
  'hsl(330, 70%, 50%)',
  'hsl(45, 80%, 50%)',
];
