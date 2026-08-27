// Offline login verifiers.
//
// To allow offline login without storing plaintext passwords, a per-device
// verifier is derived with PBKDF2-SHA256 (WebCrypto) and stored in IndexedDB.
// The verifier is created only after the user has successfully authenticated
// online (or when an account is created locally), so anyone who steals the
// device data cannot bypass the server without first knowing the password used
// online, and cannot recover the password from the verifier cheaply.
//
// LIMITATION: an offline verifier can be brute-forced locally to recover the
// password if an attacker gains read access to the IndexedDB data AND the
// password is weak. This is the standard trade-off of any offline
// authentication; it is strictly safer than the previous plaintext storage.

import { getDB } from './db';

export interface StoredVerifier {
  identifier: string;
  kind: 'email' | 'phone';
  salt: string;
  iterations: number;
  hash: string;
  created_at: string;
}

const ITERATIONS = 210_000;
const SALT_BYTES = 16;
const enc = new TextEncoder();

export function normalizeIdentifier(identifier: string): string {
  const trimmed = identifier.trim();
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  return trimmed.replace(/[\s().-]/g, '');
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomSalt(): Uint8Array {
  const salt = new Uint8Array(SALT_BYTES);
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure RNG is unavailable.');
  globalThis.crypto.getRandomValues(salt);
  return salt;
}

async function deriveBits(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('WebCrypto (crypto.subtle) est indisponible sur ce navigateur.');
  }
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

function arraysEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function createOfflineVerifier(identifier: string, password: string): Promise<void> {
  const normalized = normalizeIdentifier(identifier);
  if (!normalized || !password) return;
  const salt = randomSalt();
  const derived = await deriveBits(password, salt, ITERATIONS);
  const verifier: StoredVerifier = {
    identifier: normalized,
    kind: normalized.includes('@') ? 'email' : 'phone',
    salt: toBase64(salt.buffer),
    iterations: ITERATIONS,
    hash: toBase64(derived.buffer),
    created_at: new Date().toISOString(),
  };
  const db = await getDB();
  await db.put('auth_verifiers', verifier);
}

// Stores the verifier under every login identifier the user can use
// (email and phone), so offline login works with either one.
export async function storeUserVerifier(
  user: { email?: string; phone: string },
  password: string
): Promise<void> {
  const identifiers = new Set<string>();
  if (user.email) identifiers.add(normalizeIdentifier(user.email));
  if (user.phone) identifiers.add(normalizeIdentifier(user.phone));
  for (const identifier of identifiers) {
    await createOfflineVerifier(identifier, password);
  }
}

export async function verifyOfflinePassword(identifier: string, password: string): Promise<boolean> {
  const normalized = normalizeIdentifier(identifier);
  if (!normalized || !password) return false;
  try {
    const db = await getDB();
    const stored = await db.get('auth_verifiers', normalized);
    if (!stored) return false;
    const salt = fromBase64(stored.salt);
    const derived = await deriveBits(password, salt, stored.iterations);
    return arraysEqual(toBase64(derived.buffer), stored.hash);
  } catch {
    return false;
  }
}

export async function removeOfflineVerifier(identifier: string): Promise<void> {
  const db = await getDB();
  await db.delete('auth_verifiers', normalizeIdentifier(identifier));
}