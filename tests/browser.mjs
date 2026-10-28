import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const url=process.env.DEMO_URL||'http://127.0.0.1:4174';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const reports=[];
await fs.mkdir('artifacts/screenshots',{recursive:true});

async function gesture(page,mobile,from,to,{cancel=false,hold=false}={}){
  if(mobile){
    const client=await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y}]});
    for(let i=1;i<=14;i++){await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/14,y:from.y+(to.y-from.y)*i/14}]});await page.waitForTimeout(12);}
    if(hold)await page.waitForTimeout(400);
    const during=await page.evaluate(()=>window.__PACK__.state());
    await client.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await client.detach();return during;
  }
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:14});
  if(hold)await page.waitForTimeout(400);
  const during=await page.evaluate(()=>window.__PACK__.state());await page.mouse.up();return during;
}
async function layout(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');}
async function sealGesture(page,mobile,partial=false){
  const slider=page.getByRole('slider',{name:'向右滑动拆开卡包'});
  await slider.evaluate(el=>el.scrollIntoView({block:'nearest'}));
  const pose=await slider.evaluate(el=>{const r=el.querySelector('.tear-knob').getBoundingClientRect(),m=new DOMMatrix(getComputedStyle(el).transform);return{x:r.x+r.width/2,y:r.y+r.height/2,dx:m.a*(el.clientWidth-30),dy:m.b*(el.clientWidth-30)};});
  const portion=partial?.35:1;
  return gesture(page,mobile,pose,{x:pose.x+pose.dx*portion,y:pose.y+pose.dy*portion},{cancel:partial&&mobile});
}

try{
  for(const [name,viewport,mobile]of [['desktop',{width:1440,height:1000},false],['phone',{width:390,height:844},true],['small-phone',{width:320,height:568},true],['landscape',{width:844,height:390},true]]){
    const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
    const page=await context.newPage(),errors=[],failedRequests=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>failedRequests.push(r.url()));
    await page.goto(url,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__PACK__?.ready,{timeout:25000});await page.waitForTimeout(600);
    const initial=await page.evaluate(()=>window.__PACK__.state());assert.equal(initial.phase,'pack');assert.deepEqual(initial.avatars,[true,true,true,true]);assert.equal(initial.cardCount,4);await layout(page);
    assert.equal(await page.evaluate(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0)),true,'all teammate avatars loaded');
    await page.screenshot({path:`artifacts/screenshots/${name}-pack.png`,fullPage:true});
    const point=await page.evaluate(()=>window.__PACK__.projectPack());
    await gesture(page,mobile,point,{x:point.x+Math.min(125,viewport.width*.26),y:point.y+15});await page.waitForTimeout(300);
    const rotated=await page.evaluate(()=>window.__PACK__.state());assert.ok(Math.abs(rotated.rotation.y-initial.rotation.y)>.35,'drag rotates actual 3D pack');
    const slider=page.getByRole('slider',{name:'向右滑动拆开卡包'});await slider.evaluate(el=>el.scrollIntoView({block:'nearest'}));
    await sealGesture(page,mobile,true);await page.waitForTimeout(100);
    assert.equal((await page.evaluate(()=>window.__PACK__.state())).phase,'pack');assert.equal(await slider.getAttribute('aria-valuenow'),'0','incomplete tear resets');
    await sealGesture(page,mobile);
    await page.waitForFunction(()=>window.__PACK__.state().phase==='collection',{timeout:10000});await page.waitForTimeout(600);await layout(page);
    await page.screenshot({path:`artifacts/screenshots/${name}-collection.png`,fullPage:true});
    const cardPoint=await page.evaluate(()=>window.__PACK__.projectCard(3));
    if(mobile)await page.touchscreen.tap(cardPoint.x,cardPoint.y);else await page.mouse.click(cardPoint.x,cardPoint.y);
    await page.waitForFunction(()=>window.__PACK__.state().phase==='inspect');assert.equal((await page.evaluate(()=>window.__PACK__.state())).selected,3,'clicking 3D card opens Hecate');
    await page.waitForTimeout(700);await layout(page);
    const beforeInspect=await page.evaluate(()=>window.__PACK__.state().cardOrientation);
    const inspectPoint=await page.evaluate(()=>window.__PACK__.projectCard(3));
    const during=await gesture(page,mobile,inspectPoint,{x:inspectPoint.x+60,y:inspectPoint.y+20},{hold:true});
    assert.ok(Math.abs(during.cardOrientation.y-beforeInspect.y)>.15,'card responds to inspection drag');
    if(mobile&&viewport.width<700){
      await page.evaluate(()=>window.scrollTo(0,0));
      await gesture(page,true,{x:12,y:Math.min(430,viewport.height-35)},{x:12,y:140});await page.waitForTimeout(250);
      assert.ok(await page.evaluate(()=>scrollY>50),'phone can scroll vertically through the canvas area');
    }
    await page.getByRole('button',{name:'翻到背面'}).click();await page.waitForTimeout(750);
    assert.equal((await page.evaluate(()=>window.__PACK__.state())).flipped,true);assert.ok((await page.evaluate(()=>window.__PACK__.state())).cardOrientation.y>2.7);
    await page.screenshot({path:`artifacts/screenshots/${name}-back.png`,fullPage:true});
    await page.getByRole('button',{name:'翻回正面'}).click();
    await page.getByRole('button',{name:'下一位成员：Muses'}).click();assert.equal((await page.evaluate(()=>window.__PACK__.state())).selected,0);
    await page.getByRole('button',{name:'上一位成员：Hecate'}).click();assert.equal((await page.evaluate(()=>window.__PACK__.state())).selected,3);
    await page.getByRole('button',{name:'返回全员'}).click();
    for(const [index,name]of ['Muses','Hermes','Ruby','Hecate'].entries()){
      await page.getByRole('button',{name:`认识 ${name}`,exact:true}).click();assert.equal((await page.evaluate(()=>window.__PACK__.state())).selected,index);await page.waitForTimeout(350);await layout(page);
      assert.equal(await page.locator('#member-detail h2').textContent(),name);
      if(name==='Ruby')assert.match(await page.locator('#member-detail').textContent(),/阿比西尼亚/);
      await page.screenshot({path:`artifacts/screenshots/${name.toLowerCase()}-${mobile?'mobile':'desktop'}-${viewport.width}.png`,fullPage:true});
      await page.getByRole('button',{name:'返回全员'}).click();
    }
    await page.getByRole('button',{name:'再拆一包'}).click();assert.equal((await page.evaluate(()=>window.__PACK__.state())).phase,'pack');assert.equal((await page.evaluate(()=>window.__PACK__.state())).progress,0);
    await slider.focus();await page.keyboard.press('End');await page.waitForFunction(()=>window.__PACK__.state().phase==='collection',{timeout:10000});
    await page.getByRole('button',{name:'开启音效'}).click();assert.equal(await page.getByRole('button',{name:'关闭音效'}).getAttribute('aria-pressed'),'true');await page.getByRole('button',{name:'关闭音效'}).click();
    assert.deepEqual(errors,[],`${name}: browser errors`);assert.deepEqual(failedRequests,[],`${name}: failed requests`);
    const state=await page.evaluate(()=>window.__PACK__.state());reports.push({name,viewport,mobile,state,errors,passed:true});console.log(`${name}: PASS · real drag / tear / cancel / select / flip / members / replay / keyboard / layout · ${state.fps.toFixed(1)}fps`);await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();await page.goto(url,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__PACK__?.ready);await page.getByRole('button',{name:'直接拆开'}).click();await page.waitForFunction(()=>window.__PACK__.state().phase==='collection',{timeout:2500});reports.push({name:'reduced-motion',passed:true});await context.close();
  await fs.writeFile('artifacts/browser-report.json',JSON.stringify({url,checkedAt:new Date().toISOString(),reports},null,2));
}finally{await browser.close();}
