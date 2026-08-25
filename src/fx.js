/* =========================================================
   fx.js — 攻撃エフェクト(固定オーバーレイ層に描画)
   render() が作り直さない層なので、カード本体には一切触れない
   ========================================================= */

let fxQueue = [];
function queueFx(fx){ fxQueue.push(fx); }

function centerOf(team, slot){
  const el = document.querySelector(`[data-team="${team}"][data-slot="${slot}"]`);
  if(!el) return null;
  const r = el.getBoundingClientRect();
  return {x:r.left + r.width / 2, y:r.top + r.height / 2, el, r};
}

function spawn(cls, x, y, html){
  const d = document.createElement('div');
  d.className = cls;
  d.style.left = x + 'px';
  d.style.top = y + 'px';
  if(html) d.innerHTML = html;
  document.getElementById('fxLayer').appendChild(d);
  return d;
}
function drop(el, ms){ setTimeout(() => el.remove(), ms); }

function playFx(fx){
  const a = fx.attacker ? centerOf(fx.attacker.team, fx.attacker.slot) : null;
  const t = fx.target   ? centerOf(fx.target.team,   fx.target.slot)   : null;
  const accent = (ELEM[fx.elem] || {}).accent || '#000';

  /* 陣形入れ替え */
  if(fx.swap){
    fx.swap.forEach(s => {
      const p = centerOf(s.team, s.slot);
      if(p) p.el.animate([{transform:'rotate(0) scale(1)'},{transform:'rotate(-4deg) scale(1.06)'},{transform:'rotate(0) scale(1)'}],{duration:420, easing:'ease-out'});
    });
    const p = centerOf(fx.swap[0].team, fx.swap[0].slot);
    if(p){
      const tag = spawn('fx-tag', p.x, p.y - p.r.height / 2 - 8, '⇄ 入れ替え');
      tag.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.8)'},{opacity:1,transform:'translate(-50%,-50%) scale(1)'},{opacity:1},{opacity:0,transform:'translate(-50%,-140%) scale(1)'}],{duration:800, easing:'ease-out'});
      drop(tag, 820);
    }
    return;
  }

  /* 攻撃者: 技名タグ + 属性リング + 踏み込み */
  if(a){
    const label = fx.attackerTag || fx.skillName || '';
    if(label){
      const tag = spawn('fx-tag', a.x, a.y - a.r.height / 2 - 8, label);
      tag.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.75)'},{opacity:1,transform:'translate(-50%,-50%) scale(1)',offset:.2},{opacity:1,offset:.7},{opacity:0}],{duration:900, easing:'ease-out'});
      drop(tag, 920);
    }
    if(t){
      const ring = spawn('fx-ringbox', a.x, a.y);
      ring.style.width = a.r.width + 'px';
      ring.style.height = a.r.height + 'px';
      ring.style.borderColor = accent;
      ring.animate([{opacity:0,transform:'translate(-50%,-50%) scale(1)'},{opacity:1,transform:'translate(-50%,-50%) scale(1.05)',offset:.25},{opacity:1,offset:.6},{opacity:0,transform:'translate(-50%,-50%) scale(1)'}],{duration:560, easing:'ease-out'});
      drop(ring, 580);

      const dx = t.x - a.x, dy = t.y - a.y, len = Math.hypot(dx, dy) || 1;
      const ux = dx / len * 11, uy = dy / len * 11;
      a.el.animate([
        {transform:'translate(0,0) scale(1)'},
        {transform:`translate(${-ux * .45}px,${-uy * .45}px) scale(.98)`, offset:.22},
        {transform:`translate(${ux}px,${uy}px) scale(1.05)`, offset:.5},
        {transform:'translate(0,0) scale(1)'}
      ], {duration:520, easing:'cubic-bezier(.34,1.3,.5,1)'});
    }
  }

  if(!t) return;
  const impactDelay = (a && !fx.noProjectile) ? 230 : 0;

  /* 属性色の弾 */
  if(a && !fx.noProjectile){
    const proj = spawn('fx-proj', 0, 0,
      `<svg viewBox="0 0 16 16"><path d="M8 0 L16 8 L8 16 L0 8 Z" fill="${accent}" stroke="#000" stroke-width="1.6"/></svg>`);
    proj.animate([
      {transform:`translate(${a.x}px,${a.y}px) translate(-50%,-50%) rotate(0deg) scale(.5)`, opacity:0},
      {transform:`translate(${a.x}px,${a.y}px) translate(-50%,-50%) rotate(60deg) scale(1)`, opacity:1, offset:.18},
      {transform:`translate(${t.x}px,${t.y}px) translate(-50%,-50%) rotate(300deg) scale(1)`, opacity:1, offset:.92},
      {transform:`translate(${t.x}px,${t.y}px) translate(-50%,-50%) rotate(340deg) scale(1.6)`, opacity:0}
    ], {duration:340, easing:'cubic-bezier(.5,0,.7,1)'});
    drop(proj, 360);
  }

  setTimeout(() => {
    const tc = centerOf(fx.target.team, fx.target.slot);
    if(!tc) return;

    if(fx.targetKind === 'damage' || fx.targetKind === 'block'){
      const col = fx.targetKind === 'block' ? '#2a6ea0' : '#000';
      const burst = spawn('fx-burst', tc.x, tc.y,
        `<svg viewBox="0 0 100 100"><g stroke="${col}" stroke-width="7" stroke-linecap="round">
         <path d="M50 6 v16 M50 78 v16 M6 50 h16 M78 50 h16 M19 19 l11 11 M70 70 l11 11 M81 19 l-11 11 M30 70 l-11 11"/></g></svg>`);
      burst.animate([{opacity:1,transform:'translate(-50%,-50%) scale(.35) rotate(0deg)'},{opacity:0,transform:'translate(-50%,-50%) scale(1.25) rotate(35deg)'}],{duration:420, easing:'ease-out'});
      drop(burst, 440);
    }

    if(fx.targetKind === 'damage'){
      tc.el.animate([
        {transform:'translate(0,0)'},{transform:'translate(-5px,2px)'},{transform:'translate(5px,-2px)'},
        {transform:'translate(-4px,-1px)'},{transform:'translate(3px,1px)'},{transform:'translate(0,0)'}
      ], {duration:300, easing:'ease-out'});
    }

    if(fx.targetText){
      const n = spawn('fx-num ' + (fx.targetKind || 'neutral'), tc.x, tc.y - 6, fx.targetText);
      n.animate([
        {opacity:0, transform:'translate(-50%,-50%) scale(.5)'},
        {opacity:1, transform:'translate(-50%,-70%) scale(1.35)', offset:.22},
        {opacity:1, transform:'translate(-50%,-95%) scale(1)', offset:.6},
        {opacity:0, transform:'translate(-50%,-155%) scale(.95)'}
      ], {duration:900, easing:'cubic-bezier(.2,.9,.3,1)'});
      drop(n, 920);
    }

    /* 属性相性(弱点!/半減/無効) */
    if(fx.affText){
      const cls = fx.affText === '弱点!' ? 'fx-aff weak' : fx.affText === '無効' ? 'fx-aff null' : 'fx-aff resist';
      const e = spawn(cls, tc.x, tc.y - tc.r.height / 2 + 6, fx.affText);
      e.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.6) rotate(-8deg)'},{opacity:1,transform:'translate(-50%,-50%) scale(1.1) rotate(-8deg)',offset:.25},{opacity:1,offset:.7},{opacity:0}],{duration:950, easing:'ease-out'});
      drop(e, 970);
    }
    if(fx.comboText){
      const e = spawn('fx-tag', tc.x, tc.y + tc.r.height / 2 - 16, fx.comboText);
      e.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.7)'},{opacity:1,transform:'translate(-50%,-50%) scale(1)',offset:.25},{opacity:1,offset:.7},{opacity:0}],{duration:900, easing:'ease-out'});
      drop(e, 920);
    }
    if(fx.statusText){
      const s = spawn('fx-tag', tc.x, tc.y + tc.r.height / 2 - 4, fx.statusText);
      s.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.8)'},{opacity:1,transform:'translate(-50%,-50%) scale(1)',offset:.25},{opacity:1,offset:.7},{opacity:0,transform:'translate(-50%,-110%)'}],{duration:1000, easing:'ease-out'});
      drop(s, 1020);
    }
    if(fx.defeat){
      const d = spawn('fx-tag', tc.x, tc.y, 'K.O.');
      d.style.fontSize = '13px';
      d.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.6) rotate(-12deg)'},{opacity:1,transform:'translate(-50%,-50%) scale(1.2) rotate(-12deg)',offset:.3},{opacity:1,offset:.75},{opacity:0}],{duration:950, easing:'ease-out'});
      drop(d, 970);
      tc.el.animate([{opacity:1,transform:'scale(1)'},{opacity:.35,transform:'scale(.9) rotate(3deg)'}],{duration:500, easing:'ease-out'});
    }
  }, impactDelay);
}

function flushFx(){
  if(fxQueue.length === 0) return;
  const q = fxQueue;
  fxQueue = [];
  q.forEach((fx, i) => setTimeout(() => playFx(fx), i * 260));
}
