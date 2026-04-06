import Bonjour, { Service } from 'bonjour-service';

let bonjourInstance: Bonjour | null = null;
let currentBrowser: any = null;

export interface DiscoveredGateway {
  name: string;
  address: string;
  port: number;
  username?: string;
  password?: string;
}

function parseCredentials(txt: Record<string, string>): { username?: string; password?: string } {
  const raw = txt['auth'] || '';
  if (!raw) return {};
  try {
    const decoded = atob(raw);
    const [username, password] = decoded.split(':');
    return { username, password };
  } catch {
    return {};
  }
}

export async function findGateway(timeoutMs = 5000): Promise<DiscoveredGateway[]> {
  return new Promise((resolve) => {
    const results: DiscoveredGateway[] = [];
    bonjourInstance = new Bonjour();

    currentBrowser = bonjourInstance.find({ type: '_sms-gateway._tcp.local' }, (service: Service) => {
      const txt = service.txt || {};
      const { username, password } = parseCredentials(txt as Record<string, string>);
      results.push({
        name: service.name,
        address: service.ipv4Addresses?.[0] || service.host || '',
        port: service.port,
        username,
        password,
      });
    });

    setTimeout(() => {
      stopDiscovery();
      resolve(results);
    }, timeoutMs);
  });
}

export function stopDiscovery() {
  if (currentBrowser) {
    try { currentBrowser.stop(); } catch {}
    currentBrowser = null;
  }
  if (bonjourInstance) {
    try { bonjourInstance.destroy(); } catch {}
    bonjourInstance = null;
  }
}
