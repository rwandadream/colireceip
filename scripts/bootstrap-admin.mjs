import 'dotenv/config';
import { bootstrapInitialAdmin } from '../server/auth.js';

try {
  const result = await bootstrapInitialAdmin();
  console.log(result.created ? 'Initial administrator created.' : 'An administrator already exists; no changes made.');
} catch {
  console.error('Initial administrator bootstrap failed. Check required server-side environment variable names and database availability.');
  process.exitCode = 1;
}
