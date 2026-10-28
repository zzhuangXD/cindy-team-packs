import * as THREE from 'three';

const INK = '#302e29';
const PAPER = '#f3f0e5';
const SANS = 'Arial, "PingFang SC", "Microsoft YaHei", sans-serif';

function canvas(width, height) {
  const element = document.createElement('canvas'); element.width = width; element.height = height;
  const ctx = element.getContext('2d');
  return { element, ctx };
}

function texture(element, renderer) {
  const tex = new THREE.CanvasTexture(element);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

function type(ctx, text, x, y, size, color = INK, weight = 500, align = 'left') {
  ctx.fillStyle = color; ctx.font = `${weight} ${size}px ${SANS}`; ctx.textAlign = align; ctx.fillText(text, x, y);
}

function rounded(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}

function star(ctx, x, y, radius, color, points = 8) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = color; ctx.lineWidth = radius * 0.21; ctx.lineCap = 'butt';
  for (let i = 0; i < points / 2; i++) {
    const a = i * Math.PI / (points / 2); ctx.beginPath(); ctx.moveTo(-Math.cos(a) * radius, -Math.sin(a) * radius); ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius); ctx.stroke();
  }
  ctx.restore();
}

function grain(ctx, w, h, alpha = 0.035) {
  // Stable seed makes the printed grain reproducible across resets.
  let n = 731; const random = () => { n = (n * 16807) % 2147483647; return n / 2147483647; };
  ctx.save(); ctx.fillStyle = INK; ctx.globalAlpha = alpha;
  for (let i = 0; i < w * h / 90; i++) ctx.fillRect(random() * w, random() * h, random() * 1.5 + 0.5, 1);
  ctx.restore();
}

function coverImage(ctx, img, x, y, width, height) {
  const scale = Math.max(width / img.width, height / img.height);
  const dw = img.width * scale, dh = img.height * scale;
  ctx.drawImage(img, x + (width - dw) / 2, y + (height - dh) / 2, dw, dh);
}

function wrap(ctx, text, x, y, maxWidth, lineHeight, maxLines = Infinity) {
  let line = '', count = 0;
  for (const character of text) {
    if (character === '\n' || ctx.measureText(line + character).width > maxWidth) {
      ctx.fillText(line, x, y); y += lineHeight; count++; line = character === '\n' ? '' : character;
      if (count >= maxLines) return y;
    } else line += character;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lineHeight;
}

function motif(ctx, member) {
  const { color, dark, accent, motif: kind } = member;
  ctx.save();
  if (kind === 'art') {
    ctx.translate(390, 430); ctx.rotate(-0.32);
    ctx.fillStyle = color; ctx.fillRect(-350, -260, 175, 560);
    ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(130, -95, 208, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(-230, 180); ctx.bezierCurveTo(-30, -270, 120, 310, 340, -100); ctx.stroke();
  } else if (kind === 'documents') {
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.translate(340, 450); ctx.rotate((i - 1.5) * 0.15);
      rounded(ctx, -230 + i * 8, -240 - i * 12, 435, 480, 15, i % 2 ? accent : color, dark);
      ctx.strokeStyle = dark; ctx.lineWidth = 3;
      for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.moveTo(-175, -130 + j * 48); ctx.lineTo(150 - j * 14, -130 + j * 48); ctx.stroke(); }
      ctx.restore();
    }
  } else if (kind === 'cat') {
    ctx.translate(400, 425);ctx.rotate(-0.1);ctx.fillStyle=color;
    for(let i=0;i<9;i++){const a=i*Math.PI*2/9;ctx.beginPath();ctx.ellipse(Math.cos(a)*255,Math.sin(a)*245,70,110,a,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle=accent;ctx.strokeStyle=dark;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(95,-160);ctx.lineTo(70,-280);ctx.lineTo(137,-236);ctx.lineTo(170,-320);ctx.lineTo(210,-240);ctx.lineTo(275,-282);ctx.lineTo(246,-153);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle=dark;ctx.beginPath();ctx.ellipse(-260,172,39,30,-.3,0,Math.PI*2);ctx.fill();
    for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(-298+i*32,129+(i===1?-9:0),13,0,Math.PI*2);ctx.fill();}
  } else {
    ctx.translate(400, 450); ctx.strokeStyle = color; ctx.lineWidth = 12;
    for (let i = 0; i < 3; i++) { ctx.save();ctx.rotate(i * Math.PI / 3);ctx.beginPath();ctx.ellipse(0,0,290,115,0,0,Math.PI*2);ctx.stroke();ctx.restore(); }
    ctx.fillStyle = accent; ctx.beginPath();ctx.arc(213,-125,40,0,Math.PI*2);ctx.fill();
    star(ctx,-210,180,55,dark);
  }
  ctx.restore();
}

export function cardArtwork(member, avatar, renderer) {
  const { element: front, ctx } = canvas(800, 1120);
  rounded(ctx, 0, 0, 800, 1120, 34, PAPER);
  rounded(ctx, 19, 19, 762, 1082, 24, null, member.dark);
  type(ctx, 'CINDY COLLECTIVE', 48, 77, 21, member.dark, 700);
  type(ctx, `Nº ${member.number} / 04`, 750, 77, 21, member.dark, 500, 'right');
  rounded(ctx, 43, 106, 714, 686, 10, member.light);
  ctx.save(); ctx.beginPath(); ctx.roundRect(43, 106, 714, 686, 10); ctx.clip();
  motif(ctx, member);
  // Original teammate portrait is placed intact inside a circular printed medallion.
  ctx.save(); ctx.translate(400, 443); ctx.rotate(member.motif === 'documents' ? 0.07 : -0.07);
  ctx.beginPath(); ctx.arc(0, 0, 231, 0, Math.PI * 2); ctx.fillStyle = PAPER; ctx.fill();
  ctx.lineWidth = 9; ctx.strokeStyle = member.dark; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 219, 0, Math.PI * 2); ctx.clip();
    if (avatar) coverImage(ctx, avatar, -219, -219, 438, 438);
  else { ctx.fillStyle = member.color; ctx.fillRect(-219,-219,438,438);type(ctx,member.name.slice(0,1),0,65,210,PAPER,700,'center'); }
  ctx.restore();
  ctx.save(); ctx.translate(611, 653); ctx.rotate(-0.18);
  rounded(ctx,-85,-38,170,76,38,member.accent,member.dark); type(ctx, 'ONE OF US', 0, 7, 21, member.dark, 700, 'center'); ctx.restore();
  type(ctx, member.category, 72, 155, 20, member.dark, 700);
  type(ctx, member.role, 72, 756, 24, member.dark, 500);
  ctx.restore();
  type(ctx, member.name, 45, 908, member.name.length > 6 ? 102 : 111, member.dark, 700);
  ctx.strokeStyle = member.dark; ctx.lineWidth = 2; ctx.beginPath();ctx.moveTo(45,935);ctx.lineTo(755,935);ctx.stroke();
  type(ctx, member.headline.replace('\n',''), 48, 990, 28, member.dark, 500);
  type(ctx, `SERIES 001 — ${member.category}`, 48, 1060, 17, member.dark, 500);
  star(ctx,719,1048,23,member.color);
  grain(ctx,800,1120);

  const { element: back, ctx: b } = canvas(800, 1120);
  rounded(b,0,0,800,1120,34,member.dark);
  rounded(b,19,19,762,1082,24,null,member.light);
  type(b,'CINDY & FRIENDS',49,79,23,member.light,700);
  type(b,`FIELD NOTES / ${member.number}`,750,79,19,member.light,500,'right');
  star(b,120,195,61,member.accent);
  type(b,member.name,48,354,88,PAPER,700);
  type(b,member.role,52,413,30,member.light,500);
  b.strokeStyle=member.light;b.lineWidth=1;b.beginPath();b.moveTo(50,459);b.lineTo(750,459);b.stroke();
  b.font=`500 42px ${SANS}`;b.fillStyle=member.accent;b.textAlign='left';wrap(b,member.headline,50,533,690,60);
  b.font=`400 29px ${SANS}`;b.fillStyle=PAPER;wrap(b,member.description,50,700,688,47,5);
  member.skills.forEach((skill,i)=>{rounded(b,50+i*235,910,218,54,27,null,member.light);type(b,skill,159+i*235,947,23,PAPER,500,'center');});
  type(b,'DIFFERENT GIFTS. SHARED POSSIBILITIES.',50,1049,18,member.light,500);
  grain(b,800,1120,0.07);
  return { front: texture(front,renderer), back: texture(back,renderer), frontCanvas:front, backCanvas:back };
}

export function packArtwork(members, avatars, renderer) {
  const { element: front, ctx } = canvas(1056, 1616);
  const base = ctx.createLinearGradient(0, 0, 1056, 1616);
  base.addColorStop(0,'#b6b2c7');base.addColorStop(0.3,'#ddd4d4');base.addColorStop(0.6,'#b8bdc6');base.addColorStop(1,'#c0c9b0');ctx.fillStyle=base;ctx.fillRect(0,0,1056,1616);
  // Thin bands and registration marks read as print on the foil, not floating UI.
  ctx.fillStyle=INK;ctx.fillRect(0,138,1056,3);ctx.fillRect(0,1468,1056,3);
  type(ctx,'CINDY COLLECTIVE',78,217,29,INK,700);
  type(ctx,'VOL. 01',976,217,27,INK,500,'right');
  type(ctx,'GOOD COMPANY,',79,305,26,INK,500);
  type(ctx,'GREAT POSSIBILITIES.',79,344,26,INK,500);
  type(ctx,'cindy',57,560,230,INK,800);
  ctx.save();ctx.translate(80,742);ctx.rotate(-0.075);ctx.fillStyle=INK;ctx.font='italic 154px Georgia, serif';ctx.fillText('& friends',0,0);ctx.restore();
  star(ctx,528,956,155,INK);
  ctx.save();ctx.translate(775,1020);ctx.rotate(-0.2);rounded(ctx,-106,-52,212,104,50,'#d9ef99',INK);type(ctx,'4 GOOD',0,-4,25,INK,700,'center');type(ctx,'MINDS',0,30,25,INK,700,'center');ctx.restore();
  const xs = [148, 398, 648, 898];
  members.forEach((m,i)=>{
    const x=xs[i];ctx.save();ctx.beginPath();ctx.arc(x,1272,81,0,Math.PI*2);ctx.fillStyle=m.light;ctx.fill();ctx.clip();
    if(avatars[i])coverImage(ctx,avatars[i],x-81,1191,162,162);ctx.restore();
    ctx.lineWidth=3;ctx.strokeStyle=INK;ctx.beginPath();ctx.arc(x,1272,81,0,Math.PI*2);ctx.stroke();
    type(ctx,m.name,x,1390,25,INK,600,'center');
  });
  type(ctx,'4 MEMBER CARDS • ONE SHARED WORLD',528,1442,24,INK,500,'center');
  type(ctx,'TEAR HERE  →  →  →',528,120,21,INK,600,'center');
  grain(ctx,1056,1616,0.035);

  const { element: back, ctx:b } = canvas(1056,1616);
  b.fillStyle='#b8c0be';b.fillRect(0,0,1056,1616);
  type(b,'HELLO,',80,341,139,INK,800);type(b,'WE ARE',80,488,139,INK,800);type(b,'YOUR PEOPLE.',80,635,114,INK,800);
  type(b,'一个卡包，四位伙伴。',83,784,40,INK,500);
  type(b,'不同的擅长，一起把想法变成可能。',83,853,30,INK,400);
  members.forEach((m,i)=>{const y=1000+i*71;type(b,m.number,84,y,24,INK,400);type(b,m.name,170,y,38,INK,700);type(b,m.role,970,y,23,INK,400,'right');});
  let seed=39;for(let i=0;i<90;i++){seed=(seed*16807)%2147483647;const w=seed%4+1;if(i%3)b.fillStyle=INK;else b.fillStyle='#b8c0be';b.fillRect(83+i*5,1370,w,95);}
  type(b,'COLLECTIVE ORIGINALS / 2026',970,1457,21,INK,500,'right');
  b.strokeStyle='#8f9894';b.lineWidth=12;b.beginPath();b.moveTo(528,0);b.lineTo(528,160);b.moveTo(528,1510);b.lineTo(528,1616);b.stroke();
  grain(b,1056,1616,0.04);
  const {element: bump,ctx:bc}=canvas(256,512);
  bc.fillStyle='#808080';bc.fillRect(0,0,256,512);
  for(let y=0;y<512;y+=3){bc.strokeStyle=y%9===0?'#939393':'#777777';bc.lineWidth=1;bc.beginPath();bc.moveTo(0,y);bc.lineTo(256,y);bc.stroke();}
  return {front:texture(front,renderer),back:texture(back,renderer),bump:new THREE.CanvasTexture(bump)};
}

export function loadAvatar(url) {
  return new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=url;});
}
