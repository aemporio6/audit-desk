// Smoke + data-review test. Needs Playwright (npm i playwright). Real files are NOT in the repo:
// set AD_TEST_DATA to a folder holding: orders.csv, txn.csv (eBay reports) to run the data part.
const { chromium } = require('playwright'); const fs = require('fs'); const http = require('http'); const path = require('path');
const root = path.join(__dirname, '..'); const mt = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.wasm': 'application/wasm' };
const srv = http.createServer((q, r) => { let u = q.url.split('?')[0]; if (u === '/') u = '/index.html'; try { const p = path.join(root, u); const b = fs.readFileSync(p); r.setHeader('Content-Type', mt[path.extname(p)] || 'application/octet-stream'); r.end(b); } catch (e) { r.statusCode = 404; r.end('no'); } }).listen(8799);
const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('PASS', m); };
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('https://**', r => r.abort()); await pg.goto('http://127.0.0.1:8799/'); await pg.waitForTimeout(1500);
  await pg.evaluate(() => go('add')); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => !!document.querySelector('#drop') && !!document.querySelector('#lnk12')), 'link box sits under the drop zone');
  await pg.evaluate(() => pickFiles({})); ok(await pg.evaluate(() => !!document.querySelector('#lnk12m')), 'Add-it window has the link box'); await pg.evaluate(() => closeLayer());
  await pg.evaluate(() => go('review')); ok(await pg.evaluate(() => /Nothing to review/.test(document.querySelector('#view').innerText)), 'review page empty state');
  ok(await pg.evaluate(() => { const o = ocrShot('Report for 1 Aug 2026 - 31 Oct 2026\n£1,998.29 £663.23 £1,435.06\n292 £6.84 £0.00 £1,998.29'); return o.sales === 1998.29 && o.costs === 563.23 && o.net === 1435.06 && o.qty === 292 && o.from === '2026-08-01'; }), 'screenshot reader: summary, period, costs repaired from sales − net');
  ok(await pg.evaluate(() => { const o = ocrShot('Breakdown Amount Percent of selling cost\n£563.23 Insertion fees £3672 6.5%\nRegulatory operating fees £916 1.6%\nPostage labels £14.94 2.7%'); return o.ins === 36.72 && o.reg === 9.16; }), 'screenshot reader: missing decimal points');
  ok(await pg.evaluate(() => scoreFmt(20, 60 / 61) !== '20' && scoreFmt(20, 1) === '20'), 'score never shows a false full mark');
  ok(!errs.length, 'no page errors ' + errs.join(';')); await b.close(); srv.close();
})();
