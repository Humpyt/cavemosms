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
  status: 'pending' | 'sending' | 'completed' | 'scheduled';
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
  sentAt?: Date;
  error?: string;
  gatewayMessageId?: string;
}

export interface GatewayInfo {
  id?: number;
  name: string;         // device name from android-sms-gateway
  address: string;      // IP:port
  username: string;
  password: string;
  lastSeen: Date;
  isOnline: boolean;
}

export interface SendResult {
  messageId: string;
  success: boolean;
  error?: string;
}

export type GatewayStatus = 'idle' | 'discovering' | 'offline' | 'online' | 'error';

export interface AppSettings {
  id?: number;
  language: string;
  theme: 'light' | 'dark' | 'system';
  sendDelay: number; // ms between messages
  maxRetries: number;
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
