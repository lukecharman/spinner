export function normalizeRoomCode(code: string): string {
  return code.trim().toLowerCase();
}

export async function hashRoomCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(normalizeRoomCode(code));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

export function isRoomId(value: string): boolean {
  return /^[a-f0-9]{16}$/.test(value);
}
