// Prove the AI chat path: set a fake key, intercept the Anthropic API, verify
// the NPC reply comes from the "LLM" and still moves the meters.
const { chromium, executablePath, BASE } = require('./_pw.cjs');
const SHOT = process.env.SHOT_DIR;
const errors = [];
(async () => {
  const b = await chromium.launch({ executablePath });
  const page = await b.newPage({ viewport: { width: 1100, height: 800 }, serviceWorkers: 'block' });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  // intercept the Anthropic endpoint with a canned generative reply
  await page.route('https://api.anthropic.com/**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ content: [{ type: 'text', text: 'Mmm, generated reply just for you, cutie. 😏' }] }),
  }));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  const gate = await page.$('#age-yes'); if (gate) await gate.click();
  await page.click('[data-new="1"]');
  await page.waitForSelector('#cc-roles .role-card');
  await page.fill('#cc-name', 'Ava');
  await page.click('[data-r="artist"]');
  await page.click('#cc-go');
  await page.waitForSelector('#portrait-box svg.portrait');
  await page.waitForTimeout(300);

  // enable the Anthropic tier via menu (select mode, then key)
  await page.click('#btn-menu');
  await page.waitForSelector('#m-ai');
  await page.click('#m-ai');
  await page.waitForSelector('#chat-mode');
  await page.selectOption('#chat-mode', 'anthropic');
  await page.waitForSelector('#ai-key');
  await page.fill('#ai-key', 'sk-ant-fake-test-key');
  await page.click('#ai-save');
  await page.waitForTimeout(300);

  // type a message; the reply should be the intercepted LLM text
  await page.fill('#chat-input', 'hey you look amazing today');
  await page.click('#chat-send');
  await page.waitForTimeout(1200);
  const log = await page.textContent('#chat-log');
  if (!log.includes('generated reply just for you')) errors.push('AI reply not shown; log=' + log.slice(-200));
  await page.screenshot({ path: `${SHOT}/ai-chat.png` });

  await b.close();
  if (errors.length) { console.log('AI ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('AI E2E PASS — key set via menu, Anthropic API called, generative reply rendered');
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
