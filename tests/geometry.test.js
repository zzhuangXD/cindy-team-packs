import test from 'node:test';
import assert from 'node:assert/strict';
import { PACK, createPouchPart, openPouchMouth, curlSeal } from '../src/geometry.js';
import { OPENING_DURATION, openingMotion } from '../src/motion.js';

test('both pouch parts are closed surfaces with finite positions and valid UVs',()=>{
  for(const [low,high] of [[-PACK.height/2,PACK.tearY],[PACK.tearY,PACK.height/2]]){
    const g=createPouchPart(low,high),p=g.attributes.position,uv=g.attributes.uv,index=g.index.array;
    assert.ok([...p.array].every(Number.isFinite));assert.ok([...g.attributes.normal.array].every(Number.isFinite));
    assert.ok([...uv.array].every(v=>v>=0&&v<=1));
    const edges=new Map();
    for(let i=0;i<index.length;i+=3)for(const [a,b]of [[index[i],index[i+1]],[index[i+1],index[i+2]],[index[i+2],index[i]]]){
      const key=a<b?`${a}:${b}`:`${b}:${a}`;edges.set(key,(edges.get(key)||0)+1);
    }
    assert.ok([...edges.values()].every(n=>n===2),'every mesh edge belongs to two triangles');
    assert.equal(g.groups.reduce((total,group)=>total+group.count,0),index.length);
    g.dispose();
  }
});

test('peeling curls only released foil and cancel restores the original seam',()=>{
  const geometry=createPouchPart(PACK.tearY,PACK.height/2),original=Float32Array.from(geometry.attributes.position.array);
  curlSeal(geometry,.5);const p=geometry.attributes.position;
  const left=[...Array(p.count).keys()].find(i=>original[i*3]<-PACK.width*.35);
  const right=[...Array(p.count).keys()].find(i=>original[i*3]>PACK.width*.35);
  assert.ok(p.getZ(left)>original[left*3+2]+.08);
  assert.equal(p.getZ(right),original[right*3+2]);
  assert.ok([...p.array].every(Number.isFinite));
  curlSeal(geometry,0);assert.deepEqual(p.array,original);geometry.dispose();
});

test('cards stay stacked through extraction, then fan in order and settle',()=>{
  assert.equal(openingMotion(.4).lift,0);
  for(let i=0;i<4;i++)assert.equal(openingMotion(1.4,i).fan,0);
  assert.ok(openingMotion(1.7,0).fan>openingMotion(1.7,3).fan);
  const start=openingMotion(1.45),mouthY=PACK.tearY-.07*start.tear-5.7*start.drop;
  const stackBottom=-.45+.9*start.lift-2.99*.92/2;
  assert.ok(mouthY<stackBottom,'wrapper mouth is below the card stack before fan-out');
  for(let i=0;i<4;i++)assert.equal(openingMotion(OPENING_DURATION,i).fan,1);
});

test('opening separates front and back of the mouth, then replay restores the exact mesh',()=>{
  const g=createPouchPart(-PACK.height/2,PACK.tearY),p=g.attributes.position;
  const original=Float32Array.from(p.array);
  const nearMouth=[...Array(p.count).keys()].filter(i=>p.getY(i)>PACK.tearY-0.01&&Math.abs(p.getX(i))<0.2);
  openPouchMouth(g,1);
  assert.ok(nearMouth.length>0);
  for(const i of nearMouth)assert.ok(Math.abs(p.getZ(i))-Math.abs(original[i*3+2])>0.17);
  openPouchMouth(g,0);assert.deepEqual(p.array,original);g.dispose();
});
