import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PACK, createPouchPart, openPouchMouth, curlSeal, cardFaceGeometry, easeOutCubic, smooth } from './geometry.js';
import { cardArtwork, packArtwork, loadAvatar } from './textures.js';
import { OPENING_DURATION, openingMotion } from './motion.js';

const lerp = THREE.MathUtils.lerp;

export async function createScene(canvas, members, callbacks) {
  const renderer = new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.1;
  renderer.localClippingEnabled=true;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(32,1,0.1,80);
  camera.position.set(0,0,10.2);camera.lookAt(0,0,0);
  const pmrem=new THREE.PMREMGenerator(renderer);
  const environment=new THREE.Scene();environment.background=new THREE.Color('#13121b');
  function softbox(width,height,position,strength,color=[1,1,1]){
    const material=new THREE.MeshBasicMaterial({color:new THREE.Color(...color).multiplyScalar(strength),side:THREE.DoubleSide,toneMapped:false});
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);panel.position.set(...position);panel.lookAt(0,0,0);environment.add(panel);
  }
  // Narrow white softboxes and dark surroundings produce long, moving foil reflections.
  softbox(1.5,8,[-4.2,1,4.5],7,[1,.96,.92]);
  softbox(.65,7,[4.5,.4,2.5],5.5,[.9,.94,1]);
  softbox(6,1.4,[0,5,1.5],4.8);
  softbox(4,5,[.5,0,7],.65,[1,.85,.9]);
  const env=pmrem.fromScene(environment,.025);
  scene.environment=env.texture;environment.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfff6ea,0x34293e,.85));
  const key=new THREE.DirectionalLight(0xfff5ee,2.1);key.position.set(-3,5,5);scene.add(key);
  const fill=new THREE.DirectionalLight(0xdce4ff,.45);fill.position.set(4,-1,3);scene.add(fill);

  await document.fonts.ready;
  const avatars=await Promise.all(members.map(m=>loadAvatar(m.avatar)));
  const print=packArtwork(members,avatars,renderer);
  const material=(finish)=>new THREE.MeshPhysicalMaterial({...finish,metalness:1,roughness:.5,clearcoat:.8,clearcoatRoughness:.21,envMapIntensity:1.4,bumpMap:print.bump,bumpScale:.002,anisotropy:.15,anisotropyRotation:Math.PI/2});
  const frontMaterial=material(print.front),backMaterial=material(print.back);
  const edgeMaterial=new THREE.MeshStandardMaterial({color:0xa58b98,metalness:1,roughness:.3});
  const closureMaterial=new THREE.MeshStandardMaterial({color:0x8c7683,metalness:1,roughness:.3});
  const packMaterials=[frontMaterial,backMaterial,edgeMaterial,closureMaterial];
  const pouch=new THREE.Group(); scene.add(pouch);
  const body=new THREE.Mesh(createPouchPart(-PACK.height/2,PACK.tearY),packMaterials);pouch.add(body);
  const seal=new THREE.Mesh(createPouchPart(PACK.tearY,PACK.height/2),packMaterials);pouch.add(seal);
  const tearLine=new THREE.Mesh(new THREE.PlaneGeometry(PACK.width*.94,.008),new THREE.MeshBasicMaterial({color:0xf6c7da,transparent:true,opacity:0,toneMapped:false}));
  tearLine.position.set(-PACK.width*.47,PACK.tearY,.18);tearLine.geometry.translate(PACK.width*.47,0,0);pouch.add(tearLine);

  const mouthClip=new THREE.Plane(new THREE.Vector3(0,1,0),10000);
  const artworks=members.map((m,i)=>cardArtwork(m,avatars[i],renderer));
  const faceGeometry=cardFaceGeometry();
  const cards=artworks.map((art,i)=>{
    const group=new THREE.Group();group.userData.index=i;
    const edge=new THREE.Mesh(new RoundedBoxGeometry(2.14,2.99,0.035,3,0.08),new THREE.MeshPhysicalMaterial({color:0xc5bd9a,metalness:0.75,roughness:0.3}));group.add(edge);
    // The printed face keeps its original colour; the bevel and foil overlay catch light.
    const front=new THREE.Mesh(faceGeometry,new THREE.MeshBasicMaterial({map:art.front,toneMapped:false}));front.position.z=0.021;front.userData.index=i;group.add(front);
    const back=new THREE.Mesh(faceGeometry,new THREE.MeshBasicMaterial({map:art.back,toneMapped:false}));back.position.z=-0.021;back.rotation.y=Math.PI;back.userData.index=i;group.add(back);
    const coating=new THREE.Mesh(faceGeometry,new THREE.MeshPhysicalMaterial({color:0xffffff,transparent:true,opacity:0.045,metalness:0.5,roughness:0.28,clearcoat:1,clearcoatRoughness:0.2,depthWrite:false}));coating.position.z=0.023;coating.userData.index=i;group.add(coating);
    group.traverse(o=>{if(o.material)o.material.clippingPlanes=[mouthClip];});
    group.visible=false;scene.add(group);return group;
  });

  // A soft contact shadow remains independent of the bag's printed textures.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=256;shadowCanvas.height=128;
  const s=shadowCanvas.getContext('2d'),gradient=s.createRadialGradient(128,64,0,128,64,115);
  gradient.addColorStop(0,'rgba(48,39,57,0.22)');gradient.addColorStop(0.45,'rgba(48,39,57,0.09)');gradient.addColorStop(1,'rgba(48,39,57,0)');
  s.fillStyle=gradient;s.fillRect(0,0,256,128);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(4.2,1.3),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false,opacity:0.7}));
  shadow.position.set(0,-2.65,-.6);scene.add(shadow);

  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let width=1,height=1,aspect=1,mobile=false;
  let phase='pack',selected=-1,flipped=false,flipTarget=0,flipCurrent=0;
  let progress=0,openingAt=0,openingProgress=0,collectionAt=0,now=0,lastTime=0,frameCount=0,fps=60;
  let drag=null,rotationX=-0.035,rotationY=-0.22,targetX=-0.035,targetY=-0.22,velocity=0;
  let viewX=0,viewY=0,viewTargetX=0,viewTargetY=0,hover=-1;
  let frameId=0,contextLost=false,disposed=false,openingStage='',sealHeld=false,idleTime=0;

  function resize() {
    const r=canvas.getBoundingClientRect();width=r.width;height=r.height;aspect=width/height;mobile=width<700;
    renderer.setSize(width,height,false);camera.aspect=aspect;
    // The whole pack remains in view on narrow phones and short landscape screens.
    camera.position.z=mobile?Math.max(9.6,7.6/aspect):10.2;
    camera.updateProjectionMatrix();camera.updateMatrixWorld();
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas.parentElement);observer.observe(canvas);resize();

  function hit(event,objects) {
    const r=canvas.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);
    return raycaster.intersectObjects(objects,true).find(h=>h.object.material?.visible!==false);
  }
  function setProgress(value) {
    if(phase!=='pack')return;
    progress=Math.max(0,Math.min(1,value));tearLine.material.opacity=.8;tearLine.scale.x=progress;
    curlSeal(seal.geometry,progress);openPouchMouth(body.geometry,progress*.16);
    closureMaterial.visible=progress<.02;
    callbacks.onProgress?.(progress);
    if(progress>=0.97)open();
  }
  function holdSeal(held) {
    sealHeld=held;
    if(held&&phase==='pack'){targetX=rotationX;targetY=rotationY;velocity=0;}
  }
  function open() {
    if(phase!=='pack')return;
    phase='opening';openingStage='';openingProgress=progress;progress=1;openingAt=performance.now()/1000;targetX=-0.01;targetY=0;velocity=0;
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
    phase='pack';selected=-1;progress=0;flipped=false;flipTarget=0;flipCurrent=0;sealHeld=false;idleTime=0;mouthClip.set(new THREE.Vector3(0,1,0),10000);
    targetX=-0.035;targetY=-0.22;rotationX=targetX;rotationY=targetY;velocity=0;viewTargetX=0;viewTargetY=0;drag=null;
    pouch.visible=true;pouch.scale.setScalar(1);pouch.position.set(0,0,0);seal.visible=true;seal.position.set(0,0,0);seal.rotation.set(0,0,0);
    for(const m of packMaterials){m.transparent=false;m.opacity=1;m.depthWrite=true;}
    openPouchMouth(body.geometry,0);curlSeal(seal.geometry,0);closureMaterial.visible=true;tearLine.visible=true;tearLine.scale.x=0;tearLine.material.opacity=0;cards.forEach(c=>{c.visible=false;});
    callbacks.onProgress?.(0);callbacks.onPhase?.(phase);
  }
  function flip() {
    if(phase!=='inspect')return;
    flipped=!flipped;flipTarget=flipped?Math.PI:0;viewTargetX=0;viewTargetY=0;
    callbacks.onFlip?.(flipped);
  }

  function down(e) {
    if(phase==='opening'||e.button>0)return;
    sealHeld=false;
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
      velocity=THREE.MathUtils.clamp((e.clientX-drag.lastX)/Math.max(8,performance.now()-drag.lastTime)*1.8,-3.8,3.8);
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
    return mobile?{x:offset*.62,y:.08-Math.abs(offset)*.16,z:index*.22,rz:-offset*.16,ry:offset*.035,scale:.82}
      :{x:offset*1.96,y:.2-Math.abs(offset)*.2,z:index*.22,rz:-offset*.105,ry:offset*.03,scale:1.0};
  }
  function projectSeal() {
    if(!callbacks.onSealProjection)return;
    pouch.updateMatrixWorld();
    const a=new THREE.Vector3(-PACK.width*.45,PACK.tearY+.08,.12).applyMatrix4(pouch.matrixWorld).project(camera);
    const b=new THREE.Vector3(PACK.width*.45,PACK.tearY+.08,.12).applyMatrix4(pouch.matrixWorld).project(camera);
    const ax=(a.x+1)*width/2,ay=(1-a.y)*height/2,bx=(b.x+1)*width/2,by=(1-b.y)*height/2;
    let angle=Math.atan2(by-ay,bx-ax);if(angle>Math.PI/2)angle-=Math.PI;if(angle<-Math.PI/2)angle+=Math.PI;
    const trackWidth=Math.max(164,Math.min(320,Math.hypot(bx-ax,by-ay)-12));
    callbacks.onSealProjection({left:Math.round((ax+bx)/2-trackWidth/2),top:Math.round((ay+by)/2-19),width:Math.round(trackWidth),angle:Math.round(angle*180/Math.PI*2)/2*Math.PI/180,dragging:drag?.kind==='rotate'});
  }
  function animate(ms) {
    if(disposed)return;frameId=requestAnimationFrame(animate);if(document.hidden||contextLost)return;
    now=ms/1000;const dt=Math.min(0.05,Math.max(0.001,now-lastTime));lastTime=now;fps=lerp(fps,1/dt,0.03);frameCount++;
    const smoothing=1-Math.exp(-dt*10);
    if(phase==='pack'&&!drag&&!sealHeld){targetY+=velocity*dt;velocity*=Math.exp(-dt*5);idleTime+=dt;}
    rotationX=lerp(rotationX,targetX,smoothing);rotationY=lerp(rotationY,targetY,smoothing);
    if(phase==='pack'){
      pouch.rotation.set(rotationX,rotationY,-.095+(reduced.matches?0:Math.sin(idleTime*.56)*.012));
      pouch.position.y=reduced.matches?0:Math.sin(idleTime*1.1)*0.048;
      projectSeal();
    }
    if(phase==='opening'){
      const elapsed=(now-openingAt)*(reduced.matches?3.4:1);
      const m=openingMotion(elapsed);
      const stage=elapsed<.58?'tear':elapsed<1.45?'extract':'fan';
      if(stage!==openingStage){openingStage=stage;callbacks.onOpeningStage?.(stage);}
      pouch.rotation.set(lerp(rotationX,-.035,m.tear)+m.drop*.16,lerp(rotationY,0,m.tear),-.095-m.drop*.11);
      pouch.position.set(Math.sin(elapsed*13)*Math.exp(-elapsed*4)*.035,-.07*m.tear-5.7*m.drop,0);
      pouch.updateMatrixWorld();mouthClip.set(new THREE.Vector3(0,1,0),-PACK.tearY).applyMatrix4(pouch.matrixWorld);
      seal.position.set(-7*Math.pow(m.peel,1.8),1.2*m.peel,.5*m.peel);seal.rotation.set(-.3*m.peel,.7*m.peel,.48*m.peel);
      seal.visible=elapsed<1.2;tearLine.visible=false;closureMaterial.visible=false;
      if(frameCount%2===0){openPouchMouth(body.geometry,m.mouth);curlSeal(seal.geometry,lerp(openingProgress,1,m.tear));}
      artworks.forEach((_,i)=>{
        const c=cards[i],p=fanPose(i),motion=openingMotion(elapsed,i),offset=i-1.5;
        const liftY=lerp(-.45,.45,motion.lift),stackZ=-.0675+i*.045;
        c.visible=elapsed>.35;
        // Shared depth expansion prevents intersecting cards while x/y/roll remain staggered.
        c.position.set(lerp(offset*.009,p.x,motion.fan),lerp(liftY,p.y,motion.fan)+Math.sin(motion.fanTime*Math.PI)*.14,lerp(stackZ,p.z+.35,m.fanDepth));
        const stackRoll=-.095*(1-smooth((elapsed-.9)/.5));
        c.rotation.set(Math.sin(m.fanTime*Math.PI)*.014,p.ry*m.fanDepth,stackRoll+p.rz*motion.fan);
        c.scale.setScalar(lerp(.88,p.scale,m.fanDepth));
      });
      if(elapsed>=OPENING_DURATION){pouch.visible=false;mouthClip.set(new THREE.Vector3(0,1,0),10000);phase='collection';collectionAt=now;callbacks.onPhase?.(phase);}
    }
    if(phase==='collection'){
      const entry=easeOutCubic((now-collectionAt)/0.4);
      cards.forEach((c,i)=>{
        const p=fanPose(i),lift=hover===i?.18:0;
        c.visible=true;c.position.lerp(new THREE.Vector3(p.x,p.y+lift,p.z+.35),smoothing);c.rotation.x=lerp(c.rotation.x,hover===i?-.025:0,smoothing);c.rotation.y=lerp(c.rotation.y,hover===i?0:p.ry,smoothing);c.rotation.z=lerp(c.rotation.z,hover===i?p.rz*.7:p.rz,smoothing);c.scale.setScalar(lerp(c.scale.x,p.scale*(hover===i?1.035:1),smoothing*entry));
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
    shadow.material.opacity=lerp(shadow.material.opacity,phase==='pack'?.45:phase==='opening'?.15:phase==='inspect'?.14:.23,smoothing);
    renderer.render(scene,camera);
  }
  frameId=requestAnimationFrame(animate);

  function project(object) {
    const p=object.getWorldPosition(new THREE.Vector3()).project(camera),r=canvas.getBoundingClientRect();
    return {x:r.left+(p.x+1)/2*r.width,y:r.top+(1-p.y)/2*r.height};
  }
  return {
    open,inspect,collection,reset,flip,setProgress,holdSeal,
    state:()=>({phase,selected,flipped,progress,rotation:{x:rotationX,y:rotationY},cardOrientation:selected>=0?{x:cards[selected].rotation.x,y:cards[selected].rotation.y,z:cards[selected].rotation.z}:null,openingStage,package:{y:pouch.position.y,opacity:frontMaterial.opacity},cards:cards.map(c=>({visible:c.visible,x:c.position.x,y:c.position.y,z:c.position.z,rotationZ:c.rotation.z})),fps,frameCount,contextLost,avatars:avatars.map(Boolean),size:{width,height},cardCount:cards.length}),
    projectCard:index=>project(cards[index]),
    projectPack:()=>project(pouch),
    artwork:()=>artworks.map((a,i)=>({id:members[i].id,front:a.frontCanvas.toDataURL('image/png'),back:a.backCanvas.toDataURL('image/png')})),
    dispose(){disposed=true;cancelAnimationFrame(frameId);observer.disconnect();scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});env.dispose();renderer.dispose();},
  };
}
