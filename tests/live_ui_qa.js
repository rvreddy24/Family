// Read-only live acceptance: log in to the three explicitly provisioned QA accounts.
// Never creates care records, changes duty, shares GPS, sends messages or uses owner credentials.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../artifacts/live-qa-accounts.json'), 'utf8'));
  const accounts = Array.isArray(manifest) ? manifest : manifest.accounts;
  const base = (process.env.QA_BASE_URL || manifest.base || 'https://familyhubs.in').replace(/\/$/, '');
  assert.equal(new URL(base).hostname, 'familyhubs.in', 'Run only against the authorized FamilyHubs deployment.');
  assert.equal(accounts.length, 3, 'Exactly three provisioned QA identities are required.');
  const output = path.resolve(__dirname, '../artifacts/live-ui-qa');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chromium' });
  const results = [];
  try {
    for (const account of accounts) {
      const role = account.role;
      const route = role === 'ADMIN' ? '/ops/' : role === 'PARTNER' ? '/partner/' : '/';
      const tabs = role === 'ADMIN'
        ? ['Overview', 'Dispatch desk', 'Care partners', 'WhatsApp updates', 'Safety & audit']
        : role === 'PARTNER' ? ['Overview', 'My assignments', 'My profile']
          : ['Overview', 'My parents', 'Care requests', 'Health records'];
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const page = await context.newPage();
      page.setDefaultTimeout(45000);
      const failures = [];
      page.on('pageerror', error => failures.push(`Runtime: ${error.message}`));
      page.on('response', response => {
        if (response.url().startsWith(base + '/api/') && response.status() >= 400)
          failures.push(`API ${response.status()} ${new URL(response.url()).pathname}`);
      });
      page.on('requestfailed', request => {
        if (request.url().startsWith(base + '/api/') && !request.failure()?.errorText.includes('ERR_ABORTED'))
          failures.push(`Network ${new URL(request.url()).pathname}`);
      });
      try {
        const login = await context.request.post(base + '/api/auth/login', {
          headers: { 'X-FamilyHubs-Portal': role, Origin: base },
          data: { email: account.email, password: account.password, role },
        });
        assert.equal(login.status(), 200, `${role} QA login failed (credentials are not printed).`);
        const me = await context.request.get(base + '/api/auth/me', { headers: { 'X-FamilyHubs-Portal': role } });
        assert.equal(me.status(), 200, `${role} session was not restored.`);
        assert.equal((await me.json()).user.id, account.userId, 'The session must belong to the QA identity.');
        await page.goto(base + route);
        await expect(page.locator('.care-app')).toBeVisible();
        for (const [size, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
          await page.setViewportSize(viewport);
          for (const tab of tabs) {
            if (size === 'mobile') await page.getByRole('button', { name: 'Toggle navigation' }).click();
            await page.locator('nav[aria-label="Workspace navigation"]').getByRole('button', { name: tab, exact: true }).click();
            await expect(page.locator('main.content')).toHaveAttribute('aria-busy', 'false');
            await expect(page.locator('main h1')).toBeVisible();
            await expect(page.locator('main .message.error[role="alert"]')).toHaveCount(0);
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
            assert.equal(overflow, false, `${role} ${size} ${tab}: horizontal overflow.`);
            for (const title of await page.locator('.task-row .task-description h3').allTextContents())
              assert.ok(title.trim() && !['undefined', '[object Object]'].includes(title.trim()), `${role}: malformed task card.`);
            assert.equal(await page.getByText('Invalid Date', { exact: false }).count(), 0, `${role}: invalid date displayed.`);
            if (tab === 'Health records') {
              const loading = page.getByText('Loading this parent’s health records…', { exact: true });
              await expect(loading).toHaveCount(0);
            }
            if (tab === 'Overview' || /requests|assignments|Dispatch desk/.test(tab))
              await page.screenshot({ path: path.join(output, `${role.toLowerCase()}-${size}-${tab.toLowerCase().replaceAll(' ', '-')}.png`), fullPage: true });
            results.push({ role, size, tab, passed: true });
          }
        }
        await expect(page.getByText('Live connection', { exact: true })).toBeVisible();
        assert.deepEqual(failures, [], `${role}: browser/API failures.`);
        console.log(`PASS ${role}: real QA login, all ${tabs.length} screens desktop/mobile, live connection, valid task cards and no browser/API errors.`);
      } finally {
        // Revoke only the session this script created; no care data is changed.
        await context.request.post(base + '/api/auth/logout', { headers: { 'X-FamilyHubs-Portal': role, Origin: base }, data: {} }).catch(() => {});
        await context.close();
      }
    }
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ base, checkedAt: new Date().toISOString(), screens: results }, null, 2));
  } finally { await browser.close(); }
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = main;
