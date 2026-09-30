import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildCspDirectives, buildCspMiddleware, inlineScriptHashes, resolveCspMode, serializeCsp } from '../../server/config/csp';

export async function runCspTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n--- Running Content-Security-Policy Tests ---');
  let passed = 0;
  let failed = 0;
  const assert = (cond: boolean, name: string, detail?: string) => {
    if (cond) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name} ${detail ? `-> ${detail}` : ''}`);
      failed++;
    }
  };

  assert(resolveCspMode({ NODE_ENV: 'development' } as any) === 'off', 'CSP is off outside production (Vite dev server)');
  assert(resolveCspMode({ NODE_ENV: 'production' } as any) === 'report-only', 'CSP defaults to report-only in production');
  assert(resolveCspMode({ NODE_ENV: 'production', CSP_MODE: 'enforce' } as any) === 'enforce', 'CSP_MODE=enforce is honoured');
  assert(resolveCspMode({ NODE_ENV: 'production', CSP_MODE: 'bogus' } as any) === 'report-only', 'unknown CSP_MODE falls back to report-only');

  const html = '<script>window.a=1</script><script src="/x.js"></script><script type="module" src="/m.js"></script><script async src="https://accounts.google.com/gsi/client"></script>';
  const hashes = inlineScriptHashes(html);
  assert(hashes.length === 1 && /^'sha256-[A-Za-z0-9+/=]+'$/.test(hashes[0]), 'only inline scripts are hashed');

  const d = buildCspDirectives({ NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://app.example.com, https://*.example.org' } as any, hashes);
  const csp = serializeCsp(d);
  assert(d['script-src'].includes('https://accounts.google.com/gsi/client'), 'script-src allows Google Sign-In');
  assert(d['script-src'].includes('https://maps.googleapis.com'), 'script-src allows Google Maps');
  assert(d['script-src'].includes('https://js.paystack.co'), 'script-src allows Paystack');
  assert(!d['script-src'].includes("'unsafe-inline'") && !d['script-src'].includes("'unsafe-eval'"), 'script-src has no unsafe-inline / unsafe-eval');
  assert(d['frame-src'].includes('https://checkout.paystack.com') && d['frame-src'].includes('https://accounts.google.com/gsi/'), 'frame-src allows Paystack checkout and the GSI button iframe');
  assert(d['object-src'].join() === "'none'", "object-src is 'none'");
  assert(d['frame-ancestors'].includes('https://app.example.com') && !d['frame-ancestors'].some((s) => s.includes('*')), 'frame-ancestors = self + explicit allowed origins (no wildcards)');
  assert(!/;\s*;/.test(csp) && csp.includes("default-src 'self'"), 'serialised policy is well formed');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csp-'));
  const file = path.join(dir, 'index.html');
  fs.writeFileSync(file, html);
  const headers: Record<string, string> = {};
  const mw = buildCspMiddleware({ NODE_ENV: 'production' } as any, file)!;
  mw({} as any, { setHeader: (k: string, v: string) => (headers[k] = v) } as any, () => {});
  assert(Boolean(headers['Content-Security-Policy-Report-Only']) && !headers['Content-Security-Policy'], 'production default sends Content-Security-Policy-Report-Only');
  const h2: Record<string, string> = {};
  buildCspMiddleware({ NODE_ENV: 'production', CSP_MODE: 'enforce' } as any, file)!({} as any, { setHeader: (k: string, v: string) => (h2[k] = v) } as any, () => {});
  assert(Boolean(h2['Content-Security-Policy']), 'enforce mode sends Content-Security-Policy');
  assert(buildCspMiddleware({ NODE_ENV: 'development' } as any, file) === null, 'no middleware in development');
  fs.rmSync(dir, { recursive: true, force: true });

  console.log(`--- Finished CSP Tests: ${passed} passed, ${failed} failed ---`);
  return { passed, failed };
}
