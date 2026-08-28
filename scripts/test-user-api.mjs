import 'dotenv/config';
import { authenticate, bootstrapInitialAdmin } from '../server/auth.js';
import { create, list, remove, update } from '../server/data.js';
import { prisma } from '../server/prisma.js';

const marker = `user-test-${Date.now()}`;
const adminPhone = `+22377${String(Date.now()).slice(-6)}`;
const agentPhone = `+22366${String(Date.now()).slice(-6)}`;
const testPassword = 'Password123!';

try {
  // Ensure initial admin exists
  await bootstrapInitialAdmin();
  const admin = await authenticate(process.env.INITIAL_ADMIN_EMAIL, process.env.INITIAL_ADMIN_PASSWORD);
  if (!admin) throw new Error('Initial admin authentication failed.');

  console.log('--- TEST 1: Create Directeur account via API ---');
  const createdAdmin = await create(
    'users',
    {
      fullName: `Test Directeur ${marker}`,
      phone: adminPhone,
      role: 'admin',
      password: testPassword,
      active: true,
    },
    admin
  );
  console.log('Directeur created:', createdAdmin);

  console.log('--- TEST 2: Create Agent account via API ---');
  const createdAgent = await create(
    'users',
    {
      fullName: `Test Agent ${marker}`,
      phone: agentPhone,
      role: 'agent',
      password: testPassword,
      active: true,
    },
    admin
  );
  console.log('Agent created:', createdAgent);

  console.log('--- TEST 3: Authenticate with new Directeur account ---');
  const authDirecteur = await authenticate(adminPhone, testPassword);
  console.log('Directeur authentication result:', authDirecteur?.full_name, 'Role:', authDirecteur?.role);

  console.log('--- TEST 4: Authenticate with new Agent account ---');
  const authAgent = await authenticate(agentPhone, testPassword);
  console.log('Agent authentication result:', authAgent?.full_name, 'Role:', authAgent?.role);

  console.log('--- TEST 5: Update Agent password and test login ---');
  const newPassword = 'NewPassword456!';
  await update('users', createdAgent.id, { password: newPassword }, admin);
  const oldLoginFail = await authenticate(agentPhone, testPassword);
  const newLoginSuccess = await authenticate(agentPhone, newPassword);
  console.log('Old password rejected:', oldLoginFail === null ? 'PASS' : 'FAIL');
  console.log('New password login:', newLoginSuccess?.full_name === createdAgent.full_name ? 'PASS' : 'FAIL');

  console.log('--- TEST 6: List users via API ---');
  const usersList = await list('users', admin);
  console.log('User list count:', usersList.length);

  console.log('--- TEST 7: Duplicate phone is rejected ---');
  let duplicateThrown = null;
  try {
    await create('users', {
      fullName: `Test Duplicate ${marker}`,
      phone: adminPhone,
      role: 'agent',
      password: testPassword,
      active: true,
    }, admin);
  } catch (error) {
    duplicateThrown = error;
  }
  console.log('Duplicate phone error code:', duplicateThrown?.code);

  console.log('--- TEST 8: Wrong password is rejected ---');
  const wrongPasswordAuth = await authenticate(agentPhone, 'WrongPassword999!');
  console.log('Wrong password result:', wrongPasswordAuth);

  console.log('--- TEST 9: Inactive account cannot authenticate ---');
  await update('users', createdAgent.id, { active: false }, admin);
  const inactiveAuth = await authenticate(agentPhone, newPassword);
  await update('users', createdAgent.id, { active: true }, admin);
  const reactivatedAuth = await authenticate(agentPhone, newPassword);
  console.log('Inactive login:', inactiveAuth, 'Reactivated login:', reactivatedAuth?.full_name);

  console.log('--- TEST 10: Agent cannot access admin-only user endpoints (RBAC) ---');
  const agentSession = await authenticate(agentPhone, newPassword);
  let agentListThrown = null;
  try {
    await list('users', agentSession);
  } catch (error) {
    agentListThrown = error;
  }
  let agentCreateThrown = null;
  try {
    await create('users', {
      fullName: `Blocked ${marker}`,
      phone: `+22355${String(Date.now()).slice(-6)}`,
      role: 'agent',
      password: testPassword,
    }, agentSession);
  } catch (error) {
    agentCreateThrown = error;
  }
  console.log('Agent list error:', agentListThrown?.message, '| Agent create error:', agentCreateThrown?.message);

  console.log('--- TEST 11: Short password is rejected ---');
  let shortPasswordThrown = null;
  try {
    await create('users', {
      fullName: `Short ${marker}`,
      phone: `+22344${String(Date.now()).slice(-6)}`,
      role: 'agent',
      password: 'short',
      active: true,
    }, admin);
  } catch (error) {
    shortPasswordThrown = error;
  }
  console.log('Short password error:', shortPasswordThrown?.message);

  console.log('--- TEST 12: Invalid role is rejected ---');
  let invalidRoleThrown = null;
  try {
    await create('users', {
      fullName: `Role ${marker}`,
      phone: `+22333${String(Date.now()).slice(-6)}`,
      role: 'director',
      password: testPassword,
      active: true,
    }, admin);
  } catch (error) {
    invalidRoleThrown = error;
  }
  console.log('Invalid role error:', invalidRoleThrown?.message);

  const results = {
    directeurCreated: createdAdmin?.role === 'admin',
    agentCreated: createdAgent?.role === 'agent',
    directeurAuthSuccess: authDirecteur?.role === 'admin',
    agentAuthSuccess: authAgent?.role === 'agent',
    passwordUpdateSuccess: oldLoginFail === null && newLoginSuccess !== null,
    userListIncludesNewAccounts: usersList.some((u) => u.id === createdAdmin.id) && usersList.some((u) => u.id === createdAgent.id),
    duplicatePhoneRejected: duplicateThrown?.code === 'DUPLICATE_PHONE',
    wrongPasswordRejected: wrongPasswordAuth === null,
    inactiveAccountRejected: inactiveAuth === null && reactivatedAuth?.full_name === createdAgent.full_name,
    agentCannotListUsers: agentListThrown?.message === 'Forbidden.',
    agentCannotCreateUsers: agentCreateThrown?.message === 'Forbidden.',
    shortPasswordRejected: shortPasswordThrown?.message?.includes('8 caractères'),
    invalidRoleRejected: invalidRoleThrown?.message === 'Invalid role.',
  };

  console.log('\n--- SUMMARY ---');
  for (const [name, passed] of Object.entries(results)) {
    console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}`);
  }

  if (Object.values(results).some((passed) => !passed)) process.exitCode = 1;

  // Cleanup test users
  await remove('users', createdAgent.id, admin);
  await remove('users', createdAdmin.id, admin);
  console.log('Cleanup completed successfully.');
} catch (error) {
  console.error('Test Error:', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
