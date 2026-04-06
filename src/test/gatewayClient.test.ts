import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendSms, getMessageStatus, getDeviceInfo } from '@/services/gatewayClient';

describe('gatewayClient', () => {
  const baseUrl = 'http://192.168.1.100:8080';
  const credentials = { username: 'user', password: 'pass' };

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('sendSms returns messageId on success', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'msg-123' }),
    });

    const result = await sendSms(baseUrl, credentials, {
      phoneNumber: '+1234567890',
      message: 'Hello',
      senderName: 'BulkSMS',
      deviceId: 0,
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-123');
  });

  it('sendSms returns error on network failure', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const result = await sendSms(baseUrl, credentials, {
      phoneNumber: '+1234567890',
      message: 'Hello',
      senderName: 'BulkSMS',
      deviceId: 0,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('getDeviceInfo returns device name and online status', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ deviceName: 'MyPhone', online: true }),
    });

    const result = await getDeviceInfo(baseUrl, credentials);
    expect(result?.deviceName).toBe('MyPhone');
    expect(result?.online).toBe(true);
  });
});
