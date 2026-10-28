import './style.css';
import { members } from './data.js';
import { createScene } from './scene.js';

const $ = id => document.getElementById(id);
let world, soundEnabled=false, audioContext=null, fallback=false, fallbackIndex=0, fallbackFlipped=false;
const controls={pack:$('pack-controls'),collection:$('collection-controls'),inspect:$('inspect-controls')};

function announce(text) { $('announcement').textContent=text; }

function playSound(type='open') {
  if(!soundEnabled)return;
  try {
    audioContext??=new (window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==='suspended')audioContext.resume();
    const time=audioContext.currentTime;
    if(type==='open'){
      const buffer=audioContext.createBuffer(1,audioContext.sampleRate*0.24,audioContext.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,1.4);
      const source=audioContext.createBufferSource();source.buffer=buffer;const filter=audioContext.createBiquadFilter();filter.type='highpass';filter.frequency.value=1300;const gain=audioContext.createGain();gain.gain.value=.1;source.connect(filter).connect(gain).connect(audioContext.destination);source.start(time);
      [440,554.37,659.25].forEach((frequency,i)=>tone(frequency,time+.14+i*.08,.22,.025));
    }else tone(type==='flip'?390:540,time,.085,.025);
  } catch { /* The visual interaction remains independent of optional audio. */ }
}
function tone(frequency,time,duration,volume) {
  const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency,time);gain.gain.setValueAtTime(volume,time);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);oscillator.connect(gain).connect(audioContext.destination);oscillator.start(time);oscillator.stop(time+duration);
}

function detail(index) {
  const m=members[index];
  $('member-detail').innerHTML=`<p class="eyebrow">${m.category} <span>— ${m.number} / 04</span></p><h2>${m.name}</h2><p class="member-role">${m.role}</p><hr class="detail-rule"><h3 class="member-headline">${m.headline}</h3><p class="member-description">${m.description}</p><div class="member-skills">${m.skills.map(s=>`<span>${s}</span>`).join('')}</div><p class="detail-bottom">DRAG TO INSPECT · FLIP TO DISCOVER</p>`;
  $('previous').setAttribute('aria-label',`上一位成员：${members[(index+3)%4].name}`);
  $('next').setAttribute('aria-label',`下一位成员：${members[(index+1)%4].name}`);
}

function onPhase(phase,index=-1) {
  $('experience').dataset.phase=phase;
  if(phase==='pack')$('experience-title').innerHTML='Meet the <br /><em>collective.</em>';
  if(phase==='collection')$('experience-title').innerHTML='All here. <em>All different.</em>';
  for(const [key,element]of Object.entries(controls))element.hidden=key!==phase;
  $('member-detail').hidden=phase!=='inspect';
  $('tear-track').hidden=phase!=='pack';
  $('rotation-label').textContent=phase==='collection'?'4 / 4 · YOUR COLLECTIVE':'360° OBJECT VIEW';
  $('opening-caption').textContent=phase==='opening'?'A LITTLE MAGIC, COMING YOUR WAY.':'';
  $('scene').setAttribute('aria-label',phase==='inspect'?`${members[index].name} 的 3D 成员卡，拖动查看；回车键翻面`:phase==='collection'?'四张 3D 成员卡，点击选中成员':'可交互的 3D 伙伴卡包，拖动旋转；沿顶部封口向右滑动开启');
  if(phase==='opening'){playSound('open');announce('正在拆开卡包，四位伙伴即将登场。');}
  if(phase==='collection'){announce('卡包已打开。选择 Muses、Hermes、Ruby 或 Hecate 查看成员卡。');}
  if(phase==='inspect'){fallbackIndex=index;fallbackFlipped=false;detail(index);$('flip-card').innerHTML='翻到背面 <span>⤾</span>';playSound('choose');announce(`正在查看 ${members[index].name}，${members[index].role}。`);}
}
function onProgress(value) {
  $('tear-track').style.setProperty('--progress',value);
  $('tear-track').setAttribute('aria-valuenow',Math.round(value*100));
  $('tear-track').setAttribute('aria-valuetext',value===0?'尚未拆封':`${Math.round(value*100)}%，继续向右滑动`);
}

members.forEach((m,index)=>{
  const button=document.createElement('button');button.className='member-tab';button.setAttribute('aria-label',`认识 ${m.name}`);
  const avatar=document.createElement('img');avatar.src=m.avatar;avatar.alt='';avatar.width=25;avatar.height=25;avatar.onerror=()=>{avatar.hidden=true;};
  button.append(avatar,document.createTextNode(m.name));const small=document.createElement('small');small.textContent=m.number;button.append(small);button.addEventListener('click',()=>{if(fallback){onPhase('inspect',index);renderFallback(index);}else world?.inspect(index);});$('member-tabs').append(button);
});

$('sound').addEventListener('click',()=>{
  soundEnabled=!soundEnabled;$('sound').setAttribute('aria-pressed',String(soundEnabled));$('sound').setAttribute('aria-label',soundEnabled?'关闭音效':'开启音效');$('sound-label').textContent=soundEnabled?'SOUND ON':'SOUND OFF';if(soundEnabled)playSound('choose');
});
$('open-pack').addEventListener('click',()=>world?.open());
$('replay').addEventListener('click',()=>{world?.reset();$('tear-track').focus({preventScroll:true});});
$('back-to-team').addEventListener('click',()=>{if(fallback){$('fallback').hidden=true;onPhase('collection');}else world?.collection();});
$('flip-card').addEventListener('click',()=>{if(fallback){fallbackFlipped=!fallbackFlipped;renderFallback(fallbackIndex);$('flip-card').innerHTML=`${fallbackFlipped?'翻回正面':'翻到背面'} <span>⤾</span>`;}else world?.flip();});
function navigate(direction){if(fallback){fallbackIndex=(fallbackIndex+direction+4)%4;onPhase('inspect',fallbackIndex);renderFallback(fallbackIndex);}else world?.inspect(world.state().selected+direction);}
$('previous').addEventListener('click',()=>navigate(-1));
$('next').addEventListener('click',()=>navigate(1));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&world?.state().phase==='inspect')world.collection();});

let tearing=null;
const track=$('tear-track');
track.addEventListener('pointerenter',()=>world?.holdSeal(true));
track.addEventListener('pointerleave',()=>{if(!tearing)world?.holdSeal(false);});
track.addEventListener('focus',()=>world?.holdSeal(true));
track.addEventListener('blur',()=>world?.holdSeal(false));
track.addEventListener('pointerdown',e=>{
  if(world?.state().phase!=='pack'||e.button>0)return;
  world.holdSeal(true);
  const matrix=new DOMMatrix(getComputedStyle(track).transform);
  tearing={id:e.pointerId,x:e.clientX,y:e.clientY,start:world.state().progress,cos:matrix.a,sin:matrix.b,distance:track.clientWidth-34};track.setPointerCapture(e.pointerId);e.preventDefault();
});
track.addEventListener('pointermove',e=>{
  if(!tearing||tearing.id!==e.pointerId)return;
  const movement=(e.clientX-tearing.x)*tearing.cos+(e.clientY-tearing.y)*tearing.sin;
  world?.setProgress(tearing.start+movement/tearing.distance);
});
function endTear(e) {
  if(!tearing||e.pointerId!==tearing.id)return;
  tearing=null;if(track.hasPointerCapture(e.pointerId))track.releasePointerCapture(e.pointerId);
  if(world?.state().phase==='pack')world.setProgress(0);
  world?.holdSeal(false);
}
track.addEventListener('pointerup',endTear);track.addEventListener('pointercancel',endTear);
track.addEventListener('keydown',e=>{
  if(!world||world.state().phase!=='pack')return;
  if(['ArrowRight','ArrowLeft','End','Home','Enter',' '].includes(e.key)){
    e.preventDefault();world.setProgress(e.key==='End'||e.key==='Enter'||e.key===' '?1:e.key==='Home'?0:world.state().progress+(e.key==='ArrowRight'?.1:-.1));
  }
});

function renderFallback(index) {
  $('fallback').hidden=false;$('fallback').replaceChildren();
  if(fallbackFlipped){const p=document.createElement('p');p.textContent=members[index].description;$('fallback').append(p);}
  else {const image=document.createElement('img');image.src=members[index].avatar;image.alt=members[index].name;image.style.cssText='width:160px;height:160px;border-radius:50%;object-fit:cover;';$('fallback').append(image);}
}
$('fallback-open').addEventListener('click',()=>{fallback=true;$('fallback').hidden=true;onPhase('collection');});

try {
  world=await createScene($('scene'),members,{
    onPhase,onProgress,
    onSealProjection({left,top,width,angle,dragging}){
      track.style.left=`${left}px`;track.style.top=`${top}px`;track.style.width=`${width}px`;track.style.transform=`rotate(${angle}rad)`;track.style.visibility=dragging?'hidden':'';
    },
    onOpeningStage(stage){$('opening-caption').textContent={tear:'撕开封边，一点点期待。',extract:'把好伙伴，从包装里请出来。',fan:'四位伙伴，依次登场。'}[stage];},
    onFlip(flipped){$('flip-card').innerHTML=`${flipped?'翻回正面':'翻到背面'} <span>⤾</span>`;playSound('flip');announce(flipped?'已翻到卡片背面。':'已翻回卡片正面。');},
    onContextLost(){ $('loading').classList.remove('is-ready');$('loading').lastElementChild.textContent='画面正在恢复，稍等一下'; },
    onContextRestored(){ $('loading').classList.add('is-ready'); },
  });
  window.__PACK__={ready:true,version:'2.0',state:world.state,projectCard:world.projectCard,projectPack:world.projectPack,artwork:world.artwork};
  $('loading').classList.add('is-ready');onPhase('pack');
}catch(error){
  console.warn('3D view unavailable:',error.message);fallback=true;$('loading').hidden=true;$('fallback').hidden=false;controls.pack.hidden=true;
  window.__PACK__={ready:false,fallback:true};
}
