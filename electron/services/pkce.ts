import crypto from 'crypto';

export interface PkcePair {
  verifier: string;
  challenge: string; // base64url(sha256(verifier)) — the "S256" method all three providers accept
}

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** RFC 7636 PKCE — required for any OAuth "public client" (a desktop app can't keep a secret
 * confidential), which is what all three providers' native-app auth flows expect. */
export function generatePkce(): PkcePair {
  const verifier = base64url(crypto.randomBytes(32)); // 43 chars, within the spec's 43-128 range
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function generateState(): string {
  return base64url(crypto.randomBytes(16));
}
