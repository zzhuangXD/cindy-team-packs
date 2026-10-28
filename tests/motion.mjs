import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const url=process.env.DEMO_URL||'http://127.0.0.1:4174';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const reports=[];await fs.mkdir('artifacts/motion',{recursive:true});
try{
  for(const [name,viewport]of [['desktop',{width:1440,height:1000}],['phone',{width:390,height:844}]]){
    const page=await browser.newPage({viewport,isMobile:name==='phone',hasTouch:name==='phone'});
    await page.goto(url,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__PACK__?.ready);
    assert.equal(await page.evaluate(()=>window.__PACK__.version),'2.0');
    await page.clock.install({time:new Date('2026-10-29T10:00:00Z')});
    await page.clock.pauseAt(new Date('2026-10-29T10:00:01Z'));
    await page.screenshot({path:`artifacts/motion/${name}-pack.png`,fullPage:true});
    await page.getByRole('button',{name:'直接拆开'}).click();
    const samples=[];let previous=0;
    for(const ms of [250,700,1200,1750,2300,3200]){
      await page.clock.runFor(ms-previous);previous=ms;
      const state=await page.evaluate(()=>window.__PACK__.state());samples.push({ms,...state});
      assert.equal(state.package.opacity,1,'foil remains opaque while the wrapper falls');
      if(ms===1200){assert.equal(state.phase,'opening');assert.ok(state.package.y<-1.5);assert.ok(state.cards.every(c=>Math.abs(c.x)<.02),'cards are still stacked during extraction');}
      if(ms===1750)assert.ok(Math.abs(state.cards[0].x)>Math.abs(state.cards[3].x),'left card leads the staggered fan');
      await page.screenshot({path:`artifacts/motion/${name}-${ms}.png`,fullPage:true});
    }
    assert.equal(samples.at(-1).phase,'collection');
    assert.ok(samples.at(-1).cards.every(c=>c.visible));
    assert.equal(samples[0].size.height,samples.at(-1).size.height,'canvas keeps a stable height through unwrapping');
    const slider=page.getByRole('slider',{name:'向右滑动拆开卡包'});
    await page.getByRole('button',{name:'再拆一包'}).click();await page.clock.runFor(250);
    const sceneRect=await page.locator('#scene').boundingBox(),sealRect=await slider.boundingBox();
    assert.ok(sealRect.y>sceneRect.y&&sealRect.y<sceneRect.y+sceneRect.height*.3,'tear handle follows the actual top seal');
    reports.push({name,viewport,samples,passed:true});console.log(`${name}: PASS · peel / opaque wrapper drop / stacked extraction / stagger / stable canvas / seal handle`);await page.close();
  }
  await fs.writeFile('artifacts/motion-report.json',JSON.stringify({url,reports},null,2));
}finally{await browser.close();}
