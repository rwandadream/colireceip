import 'dotenv/config';
import { authenticate, bootstrapInitialAdmin } from '../server/auth.js';
import { prisma } from '../server/prisma.js';

const email = process.env.INITIAL_ADMIN_EMAIL;
const phone = process.env.INITIAL_ADMIN_PHONE;
const password = process.env.INITIAL_ADMIN_PASSWORD;

try {
  const secondBootstrap = await bootstrapInitialAdmin();
  const emailUser = await authenticate(email, password);
  const phoneUser = await authenticate(phone, password);
  const wrongPassword = await authenticate(email, 'intentionally-incorrect-password');
  const unknownIdentifier = await authenticate('unknown-auth-test@groupe-gaff.invalid', 'intentionally-incorrect-password');
  const administrator = await prisma.user.findFirst({
    where: { role: 'admin' },
    select: { role: true, passwordHash: true },
  });

  const results = {
    duplicateBootstrapPrevented: secondBootstrap.created === false,
    emailLogin: emailUser?.role === 'admin',
    phoneLogin: phoneUser?.role === 'admin',
    wrongPasswordRejected: wrongPassword === null,
    unknownIdentifierRejected: unknownIdentifier === null,
    adminRoleFromDatabase: administrator?.role === 'admin',
    passwordStoredAsBcrypt: Boolean(administrator?.passwordHash?.startsWith('$2')) && administrator.passwordHash !== password,
    oneAdministrator: (await prisma.user.count({ where: { role: 'admin' } })) === 1,
  };

  for (const [name, passed] of Object.entries(results)) {
    console.log(`${name}: ${passed ? 'PASS' : 'FAIL'}`);
  }

  if (Object.values(results).some((passed) => !passed)) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
