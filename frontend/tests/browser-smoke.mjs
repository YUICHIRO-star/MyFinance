const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import { checkCsvPreview, checkRefreshDuringPreview } from './csv-preview-smoke.mjs';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const screenshots=process.env.SMOKE_SCREENSHOT_DIR || path.resolve(__dirname,'../../docs/screenshots');
fs.mkdirSync(screenshots,{recursive:true});
const servers = [];
async function startServer(port, overrides = {}) {
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, FINANCE_USER: '', FINANCE_PASSWORD: '', GAS_WEB_APP_URL: '', GAS_API_TOKEN: '', OLLAMA_MODEL: '', ...overrides },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  servers.push(server);
  let log = '';
  server.stdout.on('data', (line) => { log += line; });
  server.stderr.on('data', (line) => { log += line; });
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(origin);
      if (response.status === (overrides.FINANCE_USER ? 401 : 200)) return origin;
    } catch { /* Server is still starting. */ }
    await new Promise((done) => setTimeout(done, 200));
  }
  throw Error('server unavailable: ' + log);
}
const stop=()=>servers.forEach((server) => server.kill('SIGTERM'));
(async()=>{
 const origin = await startServer(3089);
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-zygote']});
 const page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin,{waitUntil:'networkidle'});
 await page.screenshot({path:path.join(screenshots,'desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'入出金',exact:true}).click();
 await page.getByRole('textbox',{name:'明細を検索'}).fill('Amazon');
 if(await page.locator('tbody tr').count()!==2) throw Error('search failed');
 await page.getByRole('combobox',{name:'明細を絞り込む'}).selectOption('pending');
 if(await page.locator('tbody tr').count()!==1) throw Error('filter failed');
 await page.getByRole('button',{name:'資産・投資',exact:true}).click();
 if(await page.locator('tbody tr').count()!==3) throw Error('holdings failed');
 await page.getByRole('button',{name:'分析',exact:false}).first().click();
 await page.screenshot({path:path.join(screenshots,'insights.png'),fullPage:true});
 await page.getByRole('button',{name:'データ連携',exact:true}).click();
 await page.getByRole('button',{name:'暗号化して端末に保存',exact:true}).click();
 await page.getByLabel('パスフレーズ（12文字以上）').fill('browser-test-passphrase');
 await page.getByRole('button',{name:'暗号化して保存する',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 const saved=await page.evaluate(()=>localStorage.getItem('myfinance.encrypted-vault.v1'));
 if(!saved || saved.includes('三井住友')) throw Error('plaintext persisted');
 await page.reload({waitUntil:'networkidle'});
 await page.getByRole('button',{name:'開く',exact:true}).click();
 await page.getByLabel('パスフレーズ（12文字以上）').fill('browser-test-passphrase');
 await page.getByRole('button',{name:'復号して開く',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'金額を隠す',exact:true}).click();
 if((await page.locator('main').innerText()).includes('44,000')) throw Error('mask leaks insight amount');
 await page.getByRole('button',{name:'金額を表示',exact:true}).click();
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const mobile=await context.newPage(); mobile.on('pageerror',e=>errors.push(e.message));
 await mobile.goto(origin,{waitUntil:'networkidle'});
 await mobile.screenshot({path:path.join(screenshots,'mobile.png'),fullPage:true});
 for(const name of ['ホーム','入出金','資産・投資','データ連携']) {
  await mobile.getByRole('button',{name,exact:true}).click();
  if(await mobile.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)) throw Error('mobile overflow '+name);
 }
 await mobile.getByRole('button',{name:'ファイルを取り込む',exact:true}).click();
 const now='2026-09-17T06:00:00Z';
 await mobile.getByLabel('取込ファイル').setInputFiles({name:'accounts.csv',mimeType:'text/csv',buffer:Buffer.from(`id,name,kind,balance,asOf,estimated\nbank,取込銀行,bank,98765,${now},false\ncard,取込カード,card,,${now},false\n`)});
 await mobile.getByRole('dialog').getByText('新規2件・同内容0件', {exact:true}).waitFor();
 if (!(await mobile.locator('.mode-banner').innerText()).includes('DEMO')) throw Error('preview replaced demo');
 if (await mobile.getByRole('dialog').evaluate(el => el.scrollWidth > el.clientWidth)) throw Error('preview overflows on mobile');
 await mobile.getByRole('button',{name:'取り込む',exact:true}).click();
 await mobile.getByText('accounts.csv を取り込みました。',{exact:false}).first().waitFor();
 await mobile.getByRole('button',{name:'画面に戻る',exact:true}).click();
 await mobile.getByRole('button',{name:'ホーム',exact:true}).click();
 if((await mobile.locator('.mode-banner').innerText()).includes('DEMO')) throw Error('demo not replaced');
 if(!(await mobile.locator('main').innerText()).includes('98,765')) throw Error('import balance absent');
 if((await mobile.locator('main').innerText()).includes('三井住友銀行')) throw Error('mixed demo import');
 await checkCsvPreview(page, saved);
 const credentials = { username: 'fixture-user', password: 'browser-smoke-fixture-password' };
 const liveOrigin = await startServer(3090, {
   FINANCE_USER: credentials.username, FINANCE_PASSWORD: credentials.password,
   GAS_WEB_APP_URL: 'http://127.0.0.1:3090/unused-fixture',
 });
 await checkRefreshDuringPreview(browser, liveOrigin, credentials);
 if(errors.length) throw Error(JSON.stringify(errors));
 console.log(JSON.stringify({desktop:'1440px',mobile:'390px',checks:['navigation','search','status filter','holdings','encrypted save/reload/unlock','privacy mask','CSV preview/confirm/cancel','3 CSV kinds','atomic errors','2 new / 1 duplicate / JPY 2400','reselection and ledger refresh','JSON import','mobile overflow','zero page errors'],passed:true}));
 await browser.close(); stop();
})().catch(e=>{stop();console.error(e);process.exit(1)});
