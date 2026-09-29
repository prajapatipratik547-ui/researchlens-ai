// Checks that MONGODB_URI in .env connects, without printing credentials.
// Usage: node scripts/check-db.js
import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.log('MONGODB_URI is empty in backend/.env');
  process.exit(1);
}

const problems = [];
if (/<|>/.test(uri)) problems.push('still contains <placeholders>; replace <db_username> and <db_password>, and remove the < >');
if (/^["']|["']$/.test(uri)) problems.push('remove the quotes around it');
if (!/^mongodb(\+srv)?:\/\//.test(uri)) problems.push('must start with mongodb+srv://');
const dbName = /\.net\/([^?/]*)/.exec(uri)?.[1] ?? '';
if (!dbName) problems.push('no database name: add researchlens after ".net/" (before "?")');

const host = /@([^/?]+)/.exec(uri)?.[1] ?? '(unknown host)';
console.log(`Host: ${host}  Database: ${dbName || '(none)'}`);
if (problems.length) {
  console.log('Problems:\n- ' + problems.join('\n- '));
  if (problems.some((p) => !p.startsWith('no database'))) process.exit(1);
}

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  await mongoose.connection.db.admin().ping();
  console.log(`Connected OK to database "${mongoose.connection.name}"`);
} catch (err) {
  const msg = String(err.message);
  if (/auth|Authentication/i.test(msg)) console.log('Could not log in: the username or password in the string is wrong.');
  else if (/whitelist|IP|ReplicaSetNoPrimary|Server selection timed out/i.test(msg)) {
    console.log('Could not reach the cluster: in Atlas, Network Access -> Add IP Address -> Allow Access from Anywhere (0.0.0.0/0), wait 1 minute, retry.');
  } else console.log(`Connection failed: ${msg.replace(uri, '[hidden]').slice(0, 200)}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
