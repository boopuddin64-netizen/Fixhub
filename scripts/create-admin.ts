/**
 * Creates / promotes a Fixhub ADMIN account.   Usage:  npm run admin:create -- --email you@example.com [options]
 *
 *   --email <addr>       (required) admin e-mail address
 *   --name "Full Name"   display name (default: the part of the e-mail before "@")
 *   --phone <number>     optional
 *   --promote            allow turning an EXISTING customer/technician account into an admin
 *   --reset-password     set a new password for an EXISTING admin (also signs out all of its sessions)
 *   --password-stdin     read the password from stdin (one line) instead of prompting; the admin is then
 *                        forced to choose their own password at first sign-in
 *
 * The password is NEVER taken from the command line (it would show up in `ps` and shell history). It is prompted for
 * twice with hidden input, or read from stdin / the ADMIN_PASSWORD environment variable (automation) - in those two
 * cases the account is flagged "must change password". It must satisfy the strict admin policy (12+ chars, upper,
 * lower, digit, symbol). There is no default admin and no seeded admin password anywhere.
 *
 * IMPORTANT: the script uses the same database as the app, so it needs the same DATABASE_URL (+ FIXHUB_USE_POSTGRES=true
 * outside production). Fixhub keeps one writer per database, so STOP the app first (or run this in a one-off job);
 * if the app is running the script refuses with a clear message instead of racing it. On a platform without shell
 * access set ADMIN_BOOTSTRAP_EMAIL + ADMIN_BOOTSTRAP_PASSWORD for one boot instead (see README).
 */
import 'dotenv/config';
import readline from 'readline';

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (['promote', 'reset-password', 'password-stdin', 'help'].includes(key)) out[key] = true;
    else if (['email', 'name', 'phone'].includes(key)) out[key] = argv[++i] ?? '';
    else if (key === 'password') throw new Error('Passing the password on the command line is not supported (it would leak via `ps`/shell history). Omit it to be prompted, or use --password-stdin / ADMIN_PASSWORD.');
    else throw new Error(`Unknown option --${key}. Run with --help.`);
  }
  return out;
}

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) return reject(new Error('No terminal available for a hidden prompt. Use --password-stdin or the ADMIN_PASSWORD environment variable.'));
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const w = (rl as any)._writeToOutput;
    (rl as any)._writeToOutput = function (s: string) {
      if ((rl as any)._muted) return; // do not echo the typed characters
      w.call(rl, s);
    };
    rl.question(question, (answer) => {
      (rl as any)._muted = false;
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    (rl as any)._muted = true;
  });
}

async function readStdinLine(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8').split(/\r?\n/)[0] ?? '';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: npm run admin:create -- --email you@example.com [--name "Full Name"] [--phone 0803...] [--promote] [--reset-password] [--password-stdin]');
    return;
  }
  const email = String(args.email || '').trim();
  if (!email) throw new Error('--email is required.');

  // Fail fast instead of waiting 30 s when the app (the single writer) is running.
  process.env.WRITER_LOCK_WAIT_MS = process.env.WRITER_LOCK_WAIT_MS ?? '0';

  const { pgDb } = await import('../server/db/pgClient');
  const { db } = await import('../server/db');
  const { createOrPromoteAdmin } = await import('../server/services/adminAuthService');
  const { validateAdminPassword, ADMIN_PASSWORD_POLICY_MESSAGE } = await import('../src/utils/adminPasswordPolicy');

  await pgDb.ready;
  if (pgDb.isMemoryMode) {
    console.warn(
      '\nWARNING: no PostgreSQL configured - this is the throw-away in-memory database, the admin will NOT survive this process.\n' +
        'Set DATABASE_URL (and FIXHUB_USE_POSTGRES=true outside production) to the same database the app uses.\n'
    );
  }

  let password: string;
  let mustChangePassword = true;
  if (args['password-stdin']) {
    password = await readStdinLine();
  } else if (process.env.ADMIN_PASSWORD) {
    password = process.env.ADMIN_PASSWORD;
  } else {
    console.log(ADMIN_PASSWORD_POLICY_MESSAGE);
    password = await promptHidden('New admin password: ');
    const confirm = await promptHidden('Repeat password:    ');
    if (password !== confirm) throw new Error('The two passwords do not match.');
    mustChangePassword = false; // the operator just chose it themselves
  }
  const early = validateAdminPassword(password, { email, name: String(args.name || '') });
  if (early) throw new Error(early);

  await db.init();
  if (!pgDb.isMemoryMode && !db.holdsWriterLock) {
    await db.shutdown();
    throw new Error(
      'Another Fixhub instance is running against this database (it holds the writer lock). Stop the app first, run this command, then start the app again - otherwise the running app would overwrite the new admin.'
    );
  }
  const result = createOrPromoteAdmin({
    email,
    password,
    name: args.name ? String(args.name) : undefined,
    phone: args.phone ? String(args.phone) : undefined,
    promote: Boolean(args.promote),
    resetPassword: Boolean(args['reset-password']),
    mustChangePassword,
  });
  if (!result.ok) throw new Error(result.error);
  await db.flush();
  await db.shutdown();

  const verb = {
    created: 'Admin created',
    promoted: 'Existing account promoted to admin',
    password_reset: 'Admin password reset (all earlier sessions were signed out)',
    exists: 'An admin with this e-mail already exists - nothing changed (use --reset-password to set a new password)',
  }[result.status!];
  console.log(`\n${verb}: ${result.email}`);
  if (mustChangePassword && result.status !== 'exists') console.log('The password must be changed at first sign-in.');
  console.log('Sign in at  <your-app-url>/admin');
  await pgDb.pool.end().catch(() => {});
  process.exit(0);
}

main().catch(async (err) => {
  console.error(`\nadmin:create failed: ${err?.message || err}`);
  process.exit(1);
});
