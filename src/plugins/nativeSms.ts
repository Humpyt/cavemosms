import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { NativePermissionState, SmsSubscription } from '@/lib/types';

export interface NativeSmsCapabilityResponse {
  supported: boolean;
  canSend: boolean;
  smsPermission: NativePermissionState;
  phonePermission: NativePermissionState;
  defaultSubscriptionId: number;
  subscriptions: SmsSubscription[];
  manufacturer?: string;
  model?: string;
}

export interface NativeSmsSendOptions {
  phoneNumber: string;
  message: string;
  requestId?: string;
  logId?: number;
  batchId?: number;
  subscriptionId?: number;
}

export interface NativeSmsSendResult {
  requestId: string;
  partCount: number;
  phoneNumber: string;
  logId?: number;
  batchId?: number;
}

export interface NativeSmsStatusEvent {
  requestId: string;
  phoneNumber: string;
  status: 'sent' | 'failed';
  partCount: number;
  logId?: number;
  batchId?: number;
  error?: string;
  resultCode?: number;
}

export interface NativeQueueEnqueueOptions extends NativeSmsSendOptions {
  dueAt?: number;
  minGapMs?: number;
  retryCount?: number;
  maxRetries?: number;
}

export interface NativeQueueStats {
  total: number;
  due: number;
  now: number;
}

export interface NativeSmsPlugin {
  getStatus(): Promise<NativeSmsCapabilityResponse>;
  requestSmsPermission(): Promise<NativeSmsCapabilityResponse>;
  requestPhonePermission(): Promise<NativeSmsCapabilityResponse>;
  send(options: NativeSmsSendOptions): Promise<NativeSmsSendResult>;
  enqueueNativeQueue(options: NativeQueueEnqueueOptions): Promise<{ queued: number }>;
  processNativeQueueNow(options?: { subscriptionId?: number; maxToProcess?: number }): Promise<{ processed: number; queued: number }>;
  getNativeQueueStats(): Promise<NativeQueueStats>;
  clearNativeQueue(): Promise<{ cleared: boolean }>;
  removeBatchFromNativeQueue(options: { batchId: number }): Promise<{ removed: number; queued: number }>;
  drainNativeEvents(): Promise<{ events: NativeSmsStatusEvent[] }>;
  addListener(
    eventName: 'smsStatusChanged',
    listenerFunc: (event: NativeSmsStatusEvent) => void
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

export const NativeSms = registerPlugin<NativeSmsPlugin>('NativeSms');
