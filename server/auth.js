import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma.js';

const SESSION_COOKIE = 'groupe_gaff_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith('<')) throw new Error('Required server configuration is unavailable.');
  return value;
}

function sessionSecret() {
  return requiredEnvironment('JWT_SECRET');
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function normalizePhone(value) {
  return value.trim().replace(/[\s().-]/g, '');
}

export function publicUser(user) {
  return {
    id: user.id,
    email: user.email ?? undefined,
    full_name: user.fullName,
    phone: user.phone,
    role: user.role,
    active: user.active,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  };
}

export async function bootstrapInitialAdmin() {
  const email = normalizeEmail(requiredEnvironment('INITIAL_ADMIN_EMAIL'));
  const fullName = requiredEnvironment('INITIAL_ADMIN_NAME');
  const password = requiredEnvironment('INITIAL_ADMIN_PASSWORD');
  const phone = normalizePhone(requiredEnvironment('INITIAL_ADMIN_PHONE'));

  const existingAdmin = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (existingAdmin) return { created: false, user: publicUser(existingAdmin) };

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, fullName, phone, passwordHash, role: 'admin', active: true },
  });
  return { created: true, user: publicUser(user) };
}

export async function authenticate(identifier, password) {
  if (typeof identifier !== 'string' || typeof password !== 'string' || !identifier.trim() || !password) return null;
  const trimmedIdentifier = identifier.trim();
  const isEmail = trimmedIdentifier.includes('@');
  let user = isEmail
    ? await prisma.user.findFirst({ where: { email: { equals: normalizeEmail(trimmedIdentifier), mode: 'insensitive' } } })
    : await prisma.user.findUnique({ where: { phone: normalizePhone(trimmedIdentifier) } });

  if (!user) {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      await bootstrapInitialAdmin();
      user = isEmail
        ? await prisma.user.findFirst({ where: { email: { equals: normalizeEmail(trimmedIdentifier), mode: 'insensitive' } } })
        : await prisma.user.findUnique({ where: { phone: normalizePhone(trimmedIdentifier) } });
    }
  }

  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) return null;
  return publicUser(user);
}

export function createSessionToken(user) {
  return jwt.sign({ sub: user.id }, sessionSecret(), { expiresIn: SESSION_MAX_AGE_SECONDS, issuer: 'groupe-gaff' });
}

export function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`);
}

export function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
}

export async function requireAuthenticatedUser(req) {
  const cookie = req.headers.cookie?.split(';').map((entry) => entry.trim()).find((entry) => entry.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) return null;
  try {
    const token = decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1));
    const payload = jwt.verify(token, sessionSecret(), { issuer: 'groupe-gaff' });
    if (typeof payload === 'string' || !payload.sub) return null;
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    return user?.active ? publicUser(user) : null;
  } catch {
    return null;
  }
}

export function isAdmin(user) {
  return user?.role === 'admin';
}
