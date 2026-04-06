export interface SmsPayload {
  phoneNumber: string;
  message: string;
  senderName?: string;
  deviceId?: number;
}

export interface SendResult {
  messageId?: string;
  success: boolean;
  error?: string;
}

export interface MessageStatus {
  id: string;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
}

export interface DeviceInfo {
  deviceName: string;
  online: boolean;
}

function authHeader(username: string, password: string): string {
  return 'Basic ' + btoa(`${username}:${password}`);
}

export async function sendSms(
  baseUrl: string,
  credentials: { username: string; password: string },
  payload: SmsPayload
): Promise<SendResult> {
  try {
    const res = await fetch(`${baseUrl}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader(credentials.username, credentials.password),
      },
      body: JSON.stringify({
        phoneNumber: payload.phoneNumber,
        message: payload.message,
        senderName: payload.senderName || 'BulkSMS',
        deviceId: payload.deviceId ?? 0,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => 'HTTP error');
      return { success: false, error: `${res.status}: ${err}` };
    }

    const data = await res.json();
    return { success: true, messageId: data.id as string };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getMessageStatus(
  baseUrl: string,
  credentials: { username: string; password: string },
  messageId: string
): Promise<MessageStatus> {
  try {
    const res = await fetch(`${baseUrl}/message/${messageId}`, {
      headers: {
        Authorization: authHeader(credentials.username, credentials.password),
      },
    });

    if (!res.ok) {
      return { id: messageId, status: 'failed', error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    return {
      id: messageId,
      status: data.status === 'DELIVERED' ? 'sent' : data.status === 'FAILED' ? 'failed' : 'pending',
      error: data.error,
    };
  } catch (e: any) {
    return { id: messageId, status: 'failed', error: e.message };
  }
}

export async function getDeviceInfo(
  baseUrl: string,
  credentials: { username: string; password: string }
): Promise<DeviceInfo | null> {
  try {
    const res = await fetch(`${baseUrl}/device`, {
      headers: {
        Authorization: authHeader(credentials.username, credentials.password),
      },
    });

    if (!res.ok) return null;
    const data = await res.json();
    return {
      deviceName: data.deviceName || 'Unknown',
      online: data.online !== false,
    };
  } catch {
    return null;
  }
}
