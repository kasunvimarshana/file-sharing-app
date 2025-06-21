export async function createHash(data) {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const response = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return response;
}
