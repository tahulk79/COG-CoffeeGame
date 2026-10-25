import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const body=await fs.readFile(new URL('../docs/index.html',import.meta.url),'utf8');
try{for(const width of [320,390]){
 const page=await browser.newPage({viewport:{width,height:844}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://coffee.test/',r=>r.fulfill({body,contentType:'text/html'}));
 // Stub provider: this checks UI/lifecycle only, never claims real video playback.
 await page.route('https://www.youtube-nocookie.com/**',r=>{requests.push(r.request().url());return r.fulfill({body:'<button>Provider placeholder</button>',contentType:'text/html'});});
 await page.goto('https://coffee.test/');assert.equal(requests.length,0);
 await page.locator('#cafe-music-shortcut').click();assert.equal(await page.locator('.cafe-radio iframe').count(),1);
 assert.match(await page.locator('.cafe-radio iframe').getAttribute('src'),/embed\/m95-M7a59MI\?/);
 const box=await page.locator('.cafe-radio iframe').boundingBox();assert.ok(box.width>=200&&box.height>=200&&box.x>=0&&box.x+box.width<=width);
 await page.locator('[data-radio-close]').click();assert.equal(await page.locator('iframe').count(),0);
 await page.locator('#cafe-notebook').click();await page.locator('#cafe-sound-panel').evaluate(e=>e.open=true);
 await page.locator('#cafe-radio-open').click();assert.equal(await page.locator('.screen-library').evaluate(e=>e.open),false);assert.equal(await page.locator('.cafe-radio').isVisible(),true);
 await page.keyboard.press('Escape');assert.equal(await page.locator('iframe').count(),0);
 await page.locator('#cafe-notebook').click();await page.locator('#cafe-music').click();await page.waitForFunction(()=>document.querySelector('#cafe-music').getAttribute('aria-pressed')==='true');assert.equal(await page.locator('#cafe-music').getAttribute('aria-pressed'),'true');
 await page.locator('#cafe-radio-open').click();assert.equal(await page.locator('#cafe-music').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('.cafe-radio iframe').count(),1);
 await page.locator('#cafe-language').selectOption('en');assert.equal(await page.locator('iframe').count(),0);
 await page.locator('#cafe-music-shortcut').click();await page.waitForFunction(()=>document.querySelector('#cafe-music-shortcut').getAttribute('aria-pressed')==='true');assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.locator('#cafe-music-shortcut').getAttribute('aria-pressed'),'true');
 assert.deepEqual(errors,[]);await page.close();console.log(`${width}px: lazy video, visible player, close/Escape, notebook access, exclusive sources, language rerender and EN cozy default passed (YouTube stubbed)`);
}}finally{await browser.close();}
