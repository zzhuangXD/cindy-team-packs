import { webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const url=process.env.DEMO_URL||'http://127.0.0.1:4174';
const browser=await webkit.launch({headless:true});const reports=[];
try{
  for(const [name,viewport]of [['webkit-phone',{width:390,height:844}],['webkit-landscape',{width:844,height:390}]]){
    const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(url,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__PACK__?.ready,{timeout:25000});
    assert.deepEqual((await page.evaluate(()=>window.__PACK__.state())).avatars,[true,true,true,true]);
    const point=await page.evaluate(()=>window.__PACK__.projectPack());await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+100,point.y+20,{steps:12});await page.mouse.up();await page.waitForTimeout(400);assert.ok(Math.abs((await page.evaluate(()=>window.__PACK__.state())).rotation.y)>.3);
    const slider=page.getByRole('slider',{name:'向右滑动拆开卡包'});await slider.evaluate(el=>el.scrollIntoView({block:'nearest'}));
    const r=await slider.evaluate(el=>{const b=el.querySelector('.tear-knob').getBoundingClientRect(),m=new DOMMatrix(getComputedStyle(el).transform);return{x:b.x+b.width/2,y:b.y+b.height/2,dx:m.a*(el.clientWidth-30),dy:m.b*(el.clientWidth-30)};});
    await page.mouse.move(r.x,r.y);await page.mouse.down();await page.mouse.move(r.x+r.dx,r.y+r.dy,{steps:18});await page.mouse.up();
    await page.waitForFunction(()=>window.__PACK__.state().phase==='collection',{timeout:10000});await page.getByRole('button',{name:'认识 Ruby',exact:true}).tap();await page.waitForTimeout(500);assert.equal((await page.evaluate(()=>window.__PACK__.state())).selected,2);await page.getByRole('button',{name:'翻到背面'}).tap();await page.waitForTimeout(800);assert.equal((await page.evaluate(()=>window.__PACK__.state())).flipped,true);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`artifacts/screenshots/${name}.png`,fullPage:true});
    await page.getByRole('button',{name:'返回全员'}).tap();await page.getByRole('button',{name:'再拆一包'}).tap();assert.equal((await page.evaluate(()=>window.__PACK__.state())).phase,'pack');
    assert.deepEqual(errors,[]);const state=await page.evaluate(()=>window.__PACK__.state());reports.push({name,viewport,state,passed:true});console.log(`${name}: PASS · rotate, tear, tap, flip, replay, layout`);await context.close();
  }
  await fs.writeFile('artifacts/webkit-report.json',JSON.stringify({url,checkedAt:new Date().toISOString(),reports},null,2));
}finally{await browser.close();}
