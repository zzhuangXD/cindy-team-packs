import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PACK, createPouchPart, openPouchMouth, cardFaceGeometry, easeOutCubic, smooth } from './geometry.js';
import { cardArtwork, packArtwork, loadAvatar } from './textures.js';

const lerp = THREE.MathUtils.lerp;

export async function createScene(canvas, members, callbacks) {
  const renderer = new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.02;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(32,1,0.1,80);
  camera.position.set(0,0,10.2);camera.lookAt(0,0,0);
  const pmrem=new THREE.PMREMGenerator(renderer);
  const environment=new RoomEnvironment();
  const env=pmrem.fromScene(environment,0.04);
  scene.environment=env.texture; environment.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfffaf0,0x6c6470,2.6));
  const key=new THREE.DirectionalLight(0xffffff,3.3);key.position.set(-3,5,5);scene.add(key);
  const fill=new THREE.DirectionalLight(0xdbe3ff,2);fill.position.set(4,-1,3);scene.add(fill);
  const warm=new THREE.DirectionalLight(0xffcf99,1.6);warm.position.set(-4,-2,-2);scene.add(warm);

  await document.fonts.ready;
  const avatars=await Promise.all(members.map(m=>loadAvatar(m.avatar)));
  const print=packArtwork(members,avatars,renderer);
  const material=(map)=>new THREE.MeshPhysicalMaterial({map,metalnessMap:map,metalness:1,roughness:0.33,clearcoat:0.36,clearcoatRoughness:0.3,envMapIntensity:1.05,bumpMap:print.bump,bumpScale:0.0009});
  const frontMaterial=material(print.front),backMaterial=material(print.back);
  const edgeMaterial=new THREE.MeshStandardMaterial({color:0xc9c6c2,metalness:1,roughness:0.3});
  const packMaterials=[frontMaterial,backMaterial,edgeMaterial];
  const pouch=new THREE.Group(); scene.add(pouch);
  const body=new THREE.Mesh(createPouchPart(-PACK.height/2,PACK.tearY),packMaterials);pouch.add(body);
  const seal=new THREE.Mesh(createPouchPart(PACK.tearY,PACK.height/2),packMaterials);pouch.add(seal);
  const tearLine=new THREE.Mesh(new THREE.PlaneGeometry(PACK.width*0.92,0.008),new THREE.MeshBasicMaterial({color:0xe6f6a8,transparent:true,opacity:0}));
  tearLine.position.set(0,PACK.tearY,0.13);pouch.add(tearLine);

  const artworks=members.map((m,i)=>cardArtwork(m,avatars[i],renderer));
  const faceGeometry=cardFaceGeometry();
  const cards=artworks.map((art,i)=>{
    const group=new THREE.Group();group.userData.index=i;
    const edge=new THREE.Mesh(new RoundedBoxGeometry(2.14,2.99,0.035,3,0.08),new THREE.MeshPhysicalMaterial({color:0xc5bd9a,metalness:0.75,roughness:0.3}));group.add(edge);
    // The printed face keeps its original colour; the bevel and foil overlay catch light.
    const front=new THREE.Mesh(faceGeometry,new THREE.MeshBasicMaterial({map:art.front,toneMapped:false}));front.position.z=0.021;front.userData.index=i;group.add(front);
    const back=new THREE.Mesh(faceGeometry,new THREE.MeshBasicMaterial({map:art.back,toneMapped:false}));back.position.z=-0.021;back.rotation.y=Math.PI;back.userData.index=i;group.add(back);
    const coating=new THREE.Mesh(faceGeometry,new THREE.MeshPhysicalMaterial({color:0xffffff,transparent:true,opacity:0.045,metalness:0.5,roughness:0.28,clearcoat:1,clearcoatRoughness:0.2,depthWrite:false}));coating.position.z=0.023;coating.userData.index=i;group.add(coating);
    group.visible=false;scene.add(group);return group;
  });

  // A soft contact shadow remains independent of the bag's printed textures.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=256;shadowCanvas.height=128;
  const s=shadowCanvas.getContext('2d'),gradient=s.createRadialGradient(128,64,0,128,64,115);
  gradient.addColorStop(0,'rgba(48,39,57,0.22)');gradient.addColorStop(0.45,'rgba(48,39,57,0.09)');gradient.addColorStop(1,'rgba(48,39,57,0)');
  s.fillStyle=gradient;s.fillRect(0,0,256,128);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(4.2,1.3),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false,opacity:0.7}));
  shadow.position.set(0,-2.38,-0.6);scene.add(shadow);

  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let width=1,height=1,aspect=1,mobile=false;
  let phase='pack',selected=-1,flipped=false,flipTarget=0,flipCurrent=0;
  let progress=0,openingAt=0,collectionAt=0,now=0,lastTime=0,frameCount=0,fps=60;
  let drag=null,rotationX=-0.045,rotationY=-0.16,targetX=-0.045,targetY=-0.16,velocity=0;
  let viewX=0,viewY=0,viewTargetX=0,viewTargetY=0,hover=-1;
  let frameId=0,contextLost=false,disposed=false;

  function resize() {
    const r=canvas.getBoundingClientRect();width=r.width;height=r.height;aspect=width/height;mobile=width<700;
    renderer.setSize(width,height,false);camera.aspect=aspect;
    // The whole pack remains in view on narrow phones and short landscape screens.
    camera.position.z=mobile?Math.max(9.6,7.6/aspect):10.2;
    camera.updateProjectionMatrix();
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas.parentElement);observer.observe(canvas);resize();

  function hit(event,objects) {
    const r=canvas.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);
    return raycaster.intersectObjects(objects,true).find(h=>h.object.material?.visible!==false);
  }
  function setProgress(value) {
    if(phase!=='pack')return;
    progress=Math.max(0,Math.min(1,value));tearLine.material.opacity=progress;
    seal.rotation.z=-0.06*progress;seal.position.set(progress*0.025,progress*0.014,progress*0.025);
    callbacks.onProgress?.(progress);
    if(progress>=0.97)open();
  }
  function open() {
    if(phase!=='pack')return;
    phase='opening';progress=1;openingAt=performance.now()/1000;targetX=-0.01;targetY=0;velocity=0;
    if(drag&&canvas.hasPointerCapture(drag.id))canvas.releasePointerCapture(drag.id);
    drag=null;canvas.classList.remove('is-dragging');
    callbacks.onPhase?.(phase);
  }
  function inspect(index) {
    if(phase==='pack'||phase==='opening')return;
    selected=(index+members.length)%members.length;phase='inspect';flipped=false;flipTarget=0;flipCurrent=0;viewTargetX=0;viewTargetY=0;viewX=0;viewY=0;
    callbacks.onPhase?.(phase,selected);
  }
  function collection() {
    if(phase==='pack'||phase==='opening')return;
    selected=-1;phase='collection';collectionAt=performance.now()/1000;flipped=false;flipTarget=0;viewTargetX=0;viewTargetY=0;
    callbacks.onPhase?.(phase);
  }
  function reset() {
    phase='pack';selected=-1;progress=0;flipped=false;flipTarget=0;flipCurrent=0;
    targetX=-0.045;targetY=-0.16;rotationX=targetX;rotationY=targetY;velocity=0;viewTargetX=0;viewTargetY=0;drag=null;
    pouch.visible=true;pouch.scale.setScalar(1);pouch.position.set(0,0,0);seal.visible=true;seal.position.set(0,0,0);seal.rotation.set(0,0,0);
    for(const m of packMaterials){m.transparent=false;m.opacity=1;m.depthWrite=true;}
    openPouchMouth(body.geometry,0);tearLine.visible=true;tearLine.material.opacity=0;cards.forEach(c=>{c.visible=false;});
    callbacks.onProgress?.(0);callbacks.onPhase?.(phase);
  }
  function flip() {
    if(phase!=='inspect')return;
    flipped=!flipped;flipTarget=flipped?Math.PI:0;viewTargetX=0;viewTargetY=0;
    callbacks.onFlip?.(flipped);
  }

  function down(e) {
    if(phase==='opening'||e.button>0)return;
    const h=hit(e,phase==='pack'?[pouch]:cards.filter(c=>c.visible));if(!h)return;
    let kind=phase==='pack'?'rotate':phase==='inspect'?'inspect':'choose';
    if(phase==='pack'){
      const local=pouch.worldToLocal(h.point.clone());if(local.y>PACK.tearY-0.1)kind='tear';
    }
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastTime:performance.now(),moved:0,kind,index:h.object.userData.index??h.object.parent?.userData.index,startY:targetY,startX:targetX};
    canvas.setPointerCapture(e.pointerId);canvas.classList.add('is-dragging');e.preventDefault();
  }
  function move(e) {
    if(!drag){
      if(phase==='collection'){
        const h=hit(e,cards);hover=h?.object.userData.index??h?.object.parent?.userData.index??-1;
        canvas.style.cursor=hover>=0?'pointer':'default';
      }
      return;
    }
    if(e.pointerId!==drag.id)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    drag.moved=Math.max(drag.moved,Math.hypot(dx,dy));
    if(drag.kind==='tear')setProgress(dx/(Math.min(width*0.58,300)));
    if(drag.kind==='rotate'){
      targetY=drag.startY+dx*0.009;targetX=THREE.MathUtils.clamp(drag.startX+dy*0.005,-0.7,0.7);
      velocity=(e.clientX-drag.lastX)/Math.max(8,performance.now()-drag.lastTime)*0.075;
    }
    if(drag.kind==='inspect'){
      viewTargetY=THREE.MathUtils.clamp(dx*0.006,-0.8,0.8);viewTargetX=THREE.MathUtils.clamp(dy*0.004,-0.48,0.48);
    }
    drag.lastX=e.clientX;drag.lastTime=performance.now();
  }
  function end(e) {
    if(!drag||e.pointerId!==drag.id)return;
    const ended=drag;drag=null;
    if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    canvas.classList.remove('is-dragging');
    if(ended.kind==='tear'&&phase==='pack'&&progress<0.97)setProgress(0);
    if(ended.kind==='choose'&&ended.moved<12)inspect(ended.index);
    if(ended.kind==='inspect') {viewTargetX=0;viewTargetY=0;}
  }
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
  canvas.addEventListener('pointerleave',()=>{hover=-1;});
  canvas.addEventListener('keydown',e=>{
    if(phase==='pack'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
      e.preventDefault();targetY+=e.key==='ArrowRight'?0.22:e.key==='ArrowLeft'?-0.22:0;targetX=THREE.MathUtils.clamp(targetX+(e.key==='ArrowDown'?0.15:e.key==='ArrowUp'?-0.15:0),-0.7,0.7);
    }
    if(phase==='inspect'&&(e.key===' '||e.key==='Enter')){e.preventDefault();flip();}
  });
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;callbacks.onContextLost?.();});
  canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;callbacks.onContextRestored?.();});

  function fanPose(index) {
    const offset=index-1.5;
    return mobile?{x:offset*0.65,y:-Math.abs(offset)*0.08,z:(index*0.035),rz:-offset*0.13,scale:0.82}
      :{x:offset*1.95,y:0.17-Math.abs(offset)*0.15,z:index*0.045,rz:-offset*0.08,scale:1.02};
  }
  function animate(ms) {
    if(disposed)return;frameId=requestAnimationFrame(animate);if(document.hidden||contextLost)return;
    now=ms/1000;const dt=Math.min(0.05,Math.max(0.001,now-lastTime));lastTime=now;fps=lerp(fps,1/dt,0.03);frameCount++;
    const smoothing=1-Math.exp(-dt*10);
    if(phase==='pack'&&!drag){targetY+=velocity;velocity*=Math.exp(-dt*5);}
    rotationX=lerp(rotationX,targetX,smoothing);rotationY=lerp(rotationY,targetY,smoothing);
    if(phase==='pack'){
      pouch.rotation.set(rotationX,rotationY,0.025+(reduced.matches?0:Math.sin(now*0.56)*0.018));
      pouch.position.y=reduced.matches?0:Math.sin(now*1.1)*0.048;
    }
    if(phase==='opening'){
      const elapsed=(now-openingAt)*(reduced.matches?2.7:1);
      const tear=easeOutCubic(elapsed/0.65),extraction=smooth((elapsed-0.3)/1.05),spread=smooth((elapsed-1.15)/1.2),fade=smooth((elapsed-1.05)/0.8);
      pouch.rotation.set(lerp(rotationX,0,tear),lerp(rotationY,0,tear),lerp(0.025,-0.12,fade));
      pouch.position.y=-fade*1.2;pouch.scale.setScalar(1-fade*0.1);
      seal.position.set(tear*1.8,tear*1.5,tear*0.8);seal.rotation.set(tear*0.4,tear*0.9,-tear*0.8);
      seal.visible=fade<0.97;tearLine.visible=false;
      if(frameCount%3===0)openPouchMouth(body.geometry,tear);
      for(const m of packMaterials){m.transparent=true;m.opacity=1-fade;m.depthWrite=fade<0.2;}
      artworks.forEach((_,i)=>{
        const c=cards[i],p=fanPose(i),lift=smooth((elapsed-0.42-i*0.08)/0.7);
        c.visible=lift>0.01;const fromY=lerp(-0.12,1.55,lift);
        c.position.set(p.x*spread,lerp(fromY,p.y,spread),lerp(-0.06+i*0.027,0.9+p.z,extraction));
        c.rotation.set(0,lerp(-0.06,0,spread),p.rz*spread);c.scale.setScalar(lerp(0.9,p.scale,spread));
      });
      if(elapsed>=2.4){pouch.visible=false;phase='collection';collectionAt=now;callbacks.onPhase?.(phase);}
    }
    if(phase==='collection'){
      const entry=easeOutCubic((now-collectionAt)/0.4);
      cards.forEach((c,i)=>{
        const p=fanPose(i),lift=hover===i?0.14:0;
        c.visible=true;c.position.lerp(new THREE.Vector3(p.x,p.y+lift,p.z+0.5),smoothing);c.rotation.x=lerp(c.rotation.x,0,smoothing);c.rotation.y=lerp(c.rotation.y,0,smoothing);c.rotation.z=lerp(c.rotation.z,p.rz,smoothing);c.scale.setScalar(lerp(c.scale.x,p.scale*(hover===i?1.03:1),smoothing*entry));
      });
    }
    if(phase==='inspect'){
      viewX=lerp(viewX,viewTargetX,smoothing);viewY=lerp(viewY,viewTargetY,smoothing);flipCurrent=lerp(flipCurrent,flipTarget,smoothing);
      cards.forEach((c,i)=>{
        if(i===selected){
          c.visible=true;c.position.lerp(new THREE.Vector3(mobile?0:-0.9,mobile?0.1:0,1),smoothing);
          c.rotation.x=lerp(c.rotation.x,viewX,smoothing);c.rotation.y=flipCurrent+viewY;c.rotation.z=lerp(c.rotation.z,-0.025,smoothing);c.scale.setScalar(lerp(c.scale.x,mobile?1.17:1.24,smoothing));
        }else {c.visible=false;}
      });
    }
    shadow.material.opacity=lerp(shadow.material.opacity,phase==='pack'?0.62:phase==='opening'?0.4:phase==='inspect'?0.18:0.23,smoothing);
    renderer.render(scene,camera);
  }
  frameId=requestAnimationFrame(animate);

  function project(object) {
    const p=object.getWorldPosition(new THREE.Vector3()).project(camera),r=canvas.getBoundingClientRect();
    return {x:r.left+(p.x+1)/2*r.width,y:r.top+(1-p.y)/2*r.height};
  }
  return {
    open,inspect,collection,reset,flip,setProgress,
    state:()=>({phase,selected,flipped,progress,rotation:{x:rotationX,y:rotationY},cardOrientation:selected>=0?{x:cards[selected].rotation.x,y:cards[selected].rotation.y,z:cards[selected].rotation.z}:null,fps,frameCount,contextLost,avatars:avatars.map(Boolean),size:{width,height},cardCount:cards.length}),
    projectCard:index=>project(cards[index]),
    projectPack:()=>project(pouch),
    artwork:()=>artworks.map((a,i)=>({id:members[i].id,front:a.frontCanvas.toDataURL('image/png'),back:a.backCanvas.toDataURL('image/png')})),
    dispose(){disposed=true;cancelAnimationFrame(frameId);observer.disconnect();scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});env.dispose();renderer.dispose();},
  };
}
