// DIRECTOR DELETE AUDIT — regression guard for the production bug report.
//
// A "DIRECTOR" account (technical role: admin) could delete a client in its own
// UI while the record kept living in PostgreSQL and reappeared for the original
// Admin; the console showed 401 on /api/auth?action=me and /api/data?resource=clients
// plus a 400 on /api/data?resource=clients&id=<uuid>.
//
// This suite pins the DATABASE-STATE guarantees the fix relies on:
//   A. an authorized Director (admin role) delete returns 204 AND removes the
//      PostgreSQL row AND a subsequent GET (the Admin refresh) no longer
//      returns the client,
//   B. DELETE of a missing client is 204 (a delete can NEVER be the reported 400),
//   C. PATCH of a missing client is 400 ('Client introuvable.') — the only way
//      `resource=clients&id=<uuid>` can answer 400, i.e. an edit replay on a
//      server-absent row,
//   D. RBAC is preserved: an agent cannot delete another owner's client (403)
//      and CAN delete its own client (204),
//   E. an unauthenticated request is rejected with 401 (the reported noise) and
//      performs no database write.
// All drive the exact HTTP chain (api/data.js) the frontend uses.
import 'dotenv/config';
import dataHandler from '../api/data.js';
import { authenticate, createSessionToken } from '../server/auth.js';
import { prisma } from '../server/prisma.js';

const marker = `deldir-${Date.now()}`;
const directorPhone = `+22370${String(Date.now()).slice(-7)}`;
const agentPhone = `+22371${String(Date.now()).slice(-7)}`;
const testPassword = 'Password123!';
const directorName = `Directeur ${marker}`;
const agentName = `Agent ${marker}`;

const results = {};
const record = (name, passed, detail = '') => {
  results[name] = passed;
  console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}${detail ? ` (${detail})` : ''}`);
};

function invokeApi({ method = 'POST', resource, body, cookie, id }) {
  const headers = { 'content-type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  const req = { method, query: { ...(resource ? { resource } : {}), ...(id ? { id } : {}) }, headers, body };
  let statusCode = 200;
  let payload;
  const res = {
    status(code) { statusCode = code; return this; },
    json(data) { payload = data; return this; },
    end() { return this; },
  };
  return dataHandler(req, res).then(() => ({ statusCode, payload }));
}

const cookieFor = (user) => `groupe_gaff_session=${encodeURIComponent(createSessionToken(user))}`;

let director;
let agent;
let adminCookie;
let directorCookie;
let agentCookie;
const createdClientIds = [];

try {
  const admin = await authenticate(process.env.INITIAL_ADMIN_EMAIL, process.env.INITIAL_ADMIN_PASSWORD);
  if (!admin) throw new Error('Admin authentication failed.');
  adminCookie = cookieFor(admin);

  console.log('--- Create Director and Agent accounts ---');
  const rawDirector = await dataHandler(
    { method: 'POST', query: { resource: 'users' }, headers: { 'content-type': 'application/json', cookie: adminCookie }, body: { fullName: directorName, phone: directorPhone, role: 'admin', password: testPassword, active: true } },
    makeRes()
  );
  const rawAgent = await dataHandler(
    { method: 'POST', query: { resource: 'users' }, headers: { 'content-type': 'application/json', cookie: adminCookie }, body: { fullName: agentName, phone: agentPhone, role: 'agent', password: testPassword, active: true } },
    makeRes()
  );
  director = await authenticate(directorPhone, testPassword);
  agent = await authenticate(agentPhone, testPassword);
  if (!director || !agent) throw new Error('Director/Agent authentication failed.');
  record('directorIsAdminRole', director.role === 'admin', director.role);
  directorCookie = cookieFor(director);
  agentCookie = cookieFor(agent);
  void rawDirector; void rawAgent;

  console.log('--- A. Director deletes an existing client -> DB row removed ---');
  const client = await invokeApi({ method: 'POST', resource: 'clients', cookie: directorCookie, body: { fullName: `Client ${marker}`, phone: `+22372${String(Date.now()).slice(-7)}`, city: 'Bamako' } });
  const clientId = client.payload?.data?.id;
  createdClientIds.push(clientId);
  record('director.createClient', client.statusCode === 201 && Boolean(clientId), `status=${client.statusCode}`);
  const dbRowBefore = await prisma.client.count({ where: { id: clientId } });
  record('director.createPersistsInDb', dbRowBefore === 1, `rows=${dbRowBefore}`);
  const del = await invokeApi({ method: 'DELETE', resource: 'clients', id: clientId, cookie: directorCookie });
  const dbRowAfter = await prisma.client.count({ where: { id: clientId } });
  const listAfterDirector = await invokeApi({ method: 'GET', resource: 'clients', cookie: adminCookie });
  const goneFromAdminRefresh = Array.isArray(listAfterDirector.payload?.data)
    ? !listAfterDirector.payload.data.some((c) => c.id === clientId)
    : false;
  record('director.delete204', del.statusCode === 204, `status=${del.statusCode}`);
  record('director.deleteRemovesDbRow', dbRowAfter === 0, `rows=${dbRowAfter}`);
  record('adminRefreshNoLongerShowsClient', goneFromAdminRefresh, '');

  console.log('--- B. DELETE of a missing client is 204 (never 400) ---');
  const missing = '00000000-0000-4000-8000-000000000000';
  const delMissing = await invokeApi({ method: 'DELETE', resource: 'clients', id: missing, cookie: directorCookie });
  record('deleteMissingIs204', delMissing.statusCode === 204, `status=${delMissing.statusCode}`);

  console.log('--- C. PATCH of a missing client is 400 (the only clients 400 path) ---');
  const patchMissing = await invokeApi({ method: 'PATCH', resource: 'clients', id: missing, cookie: directorCookie, body: { fullName: 'Edité' } });
  record('patchMissingIs400', patchMissing.statusCode === 400, `status=${patchMissing.statusCode}`);

  console.log('--- D. RBAC preserved: agent cannot delete another owner, CAN delete own ---');
  const directorClient2 = await invokeApi({ method: 'POST', resource: 'clients', cookie: directorCookie, body: { fullName: `Autre ${marker}`, phone: `+22373${String(Date.now()).slice(-7)}` } });
  const directorClient2Id = directorClient2.payload?.data?.id;
  createdClientIds.push(directorClient2Id);
  const agentForbidden = await invokeApi({ method: 'DELETE', resource: 'clients', id: directorClient2Id, cookie: agentCookie });
  const agentOwnClient = await invokeApi({ method: 'POST', resource: 'clients', cookie: agentCookie, body: { fullName: `Propre ${marker}`, phone: `+22374${String(Date.now()).slice(-7)}` } });
  const agentOwnClientId = agentOwnClient.payload?.data?.id;
  createdClientIds.push(agentOwnClientId);
  const agentOwnDelete = await invokeApi({ method: 'DELETE', resource: 'clients', id: agentOwnClientId, cookie: agentCookie });
  const dbAgentOwnRows = await prisma.client.count({ where: { id: agentOwnClientId } });
  record('agentCannotDeleteOtherOwnersClient', agentForbidden.statusCode === 403, `status=${agentForbidden.statusCode}`);
  record('agentCanDeleteOwnClient', agentOwnDelete.statusCode === 204 && dbAgentOwnRows === 0, `status=${agentOwnDelete.statusCode}`);

  console.log('--- E. Unauthenticated DELETE is 401 and performs no write ---');
  const unauthClient = await invokeApi({ method: 'POST', resource: 'clients', cookie: directorCookie, body: { fullName: `Anon ${marker}`, phone: `+22375${String(Date.now()).slice(-7)}` } });
  const unauthClientId = unauthClient.payload?.data?.id;
  createdClientIds.push(unauthClientId);
  const unauthenticated = await invokeApi({ method: 'DELETE', resource: 'clients', id: unauthClientId });
  const dbUnauthRows = await prisma.client.count({ where: { id: unauthClientId } });
  record('unauthenticatedDeleteIs401', unauthenticated.statusCode === 401, `status=${unauthenticated.statusCode}`);
  record('unauthenticatedDoesNotDelete', dbUnauthRows === 1, `rows=${dbUnauthRows}`);

  console.log('\n--- SUMMARY ---');
  let allPass = true;
  for (const [name, passed] of Object.entries(results)) {
    allPass = allPass && passed;
  }
  console.log(`total: ${Object.keys(results).length} checks, ${Object.values(results).filter(Boolean).length} PASS`);
  if (!allPass) process.exitCode = 1;
} catch (error) {
  console.error('Test Error:', error);
  process.exitCode = 1;
} finally {
  try {
    if (director && adminCookie) await dataHandler({ method: 'DELETE', query: { resource: 'users', id: director.id }, headers: { cookie: adminCookie } }, makeRes()).catch(() => undefined);
    if (agent && adminCookie) await dataHandler({ method: 'DELETE', query: { resource: 'users', id: agent.id }, headers: { cookie: adminCookie } }, makeRes()).catch(() => undefined);
    for (const id of createdClientIds) {
      if (id && adminCookie) {
        await dataHandler({ method: 'DELETE', query: { resource: 'clients', id }, headers: { cookie: adminCookie } }, makeRes()).catch(() => undefined);
      }
    }
  } catch { /* best-effort cleanup */ }
  await prisma.$disconnect();
}

function makeRes() {
  const res = {
    status() { return this; },
    json() { return this; },
    end() { return this; },
  };
  return res;
}