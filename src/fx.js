/* =========================================================
   fx.js — 攻撃演出(固定オーバーレイ層に描画)
   render() が作り直さない層なので、カード本体には一切触れない。

   1回の攻撃は4段構えでゆっくり見せる:
     ①構え   攻撃者が浮き上がり、技名の帯が出る      (0〜420ms)
     ②踏込み 対象の方向へ踏み込む                    (420〜780ms)
     ③射出   属性色の弾が尾を引いて飛ぶ              (700〜1180ms)
     ④着弾   閃光・振動・放射・ダメージ数値          (1180〜2100ms)
   ========================================================= */

const FX_WINDUP  = 420;   // 構え
const FX_LUNGE   = 360;   // 踏み込み
const FX_TRAVEL  = 480;   // 弾の飛翔
const FX_IMPACT  = 900;   // 着弾演出
const FX_TOTAL   = 2150;  // 1アクションの総尺
const FX_GAP     = 380;   // 連続イベントの間隔

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
  const accent = (ELEM[fx.elem] || {}).accent || '#111';

  /* ---- 陣形入れ替え ---- */
  if(fx.swap){
    fx.swap.forEach(s => {
      const p = centerOf(s.team, s.slot);
      if(p) p.el.animate([
        {transform:'rotate(0) scale(1)'},
        {transform:'rotate(-6deg) scale(1.07)', offset:.5},
        {transform:'rotate(0) scale(1)'}
      ], {duration:700, easing:'ease-in-out'});
    });
    const p = centerOf(fx.swap[0].team, fx.swap[0].slot);
    if(p){
      const tag = spawn('fx-banner', p.x, p.y - p.r.height / 2 - 12, '陣形入れ替え');
      tag.animate([
        {opacity:0, transform:'translate(-50%,-50%) scale(.85)'},
        {opacity:1, transform:'translate(-50%,-50%) scale(1)', offset:.2},
        {opacity:1, offset:.75},
        {opacity:0, transform:'translate(-50%,-120%) scale(1)'}
      ], {duration:1100, easing:'ease-out'});
      drop(tag, 1120);
    }
    return;
  }

  /* ---- ① 構え + ② 踏み込み ---- */
  if(a){
    const label = fx.attackerTag || fx.skillName || '';
    if(label){
      const banner = spawn('fx-banner', a.x, a.y - a.r.height / 2 - 12, label);
      banner.style.borderColor = accent;
      banner.animate([
        {opacity:0, transform:'translate(-50%,-50%) translateY(8px) scale(.9)'},
        {opacity:1, transform:'translate(-50%,-50%) translateY(0) scale(1)', offset:.18},
        {opacity:1, offset:.78},
        {opacity:0, transform:'translate(-50%,-50%) translateY(-10px)'}
      ], {duration:FX_TOTAL - 400, easing:'cubic-bezier(.2,.9,.3,1)'});
      drop(banner, FX_TOTAL - 380);
    }

    if(t){
      /* 攻撃者を囲む属性色のリング(誰が撃ったか) */
      const ring = spawn('fx-ringbox', a.x, a.y);
      ring.style.width = a.r.width + 'px';
      ring.style.height = a.r.height + 'px';
      ring.style.borderColor = accent;
      ring.animate([
        {opacity:0, transform:'translate(-50%,-50%) scale(1.12)'},
        {opacity:1, transform:'translate(-50%,-50%) scale(1)', offset:.25},
        {opacity:1, offset:.72},
        {opacity:0, transform:'translate(-50%,-50%) scale(1.06)'}
      ], {duration:FX_WINDUP + FX_LUNGE + FX_TRAVEL, easing:'ease-out'});
      drop(ring, FX_WINDUP + FX_LUNGE + FX_TRAVEL + 40);

      const dx = t.x - a.x, dy = t.y - a.y, len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      /* 浮き上がり → 引き → 踏み込み → 戻り */
      a.el.animate([
        {transform:'translate(0,0) scale(1)',                                              offset:0},
        {transform:`translate(0,-5px) scale(1.05)`,                                        offset:.19},
        {transform:`translate(${-ux*9}px,${-uy*9 - 4}px) scale(1.04)`,                     offset:.36},
        {transform:`translate(${ux*16}px,${uy*16}px) scale(1.09)`,                         offset:.52},
        {transform:`translate(${ux*10}px,${uy*10}px) scale(1.03)`,                         offset:.66},
        {transform:'translate(0,0) scale(1)',                                              offset:1}
      ], {duration:FX_WINDUP + FX_LUNGE + 260, easing:'cubic-bezier(.3,.85,.35,1)'});
    }
  }

  if(!t) return;
  const impactAt = (a && !fx.noProjectile) ? FX_WINDUP + FX_LUNGE + FX_TRAVEL - 120 : 120;

  /* ---- ③ 射出(尾を引く弾) ---- */
  if(a && !fx.noProjectile){
    const startAt = FX_WINDUP + FX_LUNGE - 140;
    const proj = spawn('fx-proj', 0, 0,
      `<svg viewBox="0 0 22 22"><g>
        <path d="M11 0 22 11 11 22 0 11Z" fill="${accent}" stroke="#111" stroke-width="2"/>
        <path d="M11 5 17 11 11 17 5 11Z" fill="#fff" opacity=".55"/>
       </g></svg>`);
    proj.style.opacity = '0';
    setTimeout(() => {
      proj.style.opacity = '';
      proj.animate([
        {transform:`translate(${a.x}px,${a.y}px) translate(-50%,-50%) rotate(0deg) scale(.4)`,   opacity:0},
        {transform:`translate(${a.x}px,${a.y}px) translate(-50%,-50%) rotate(70deg) scale(1.1)`, opacity:1, offset:.16},
        {transform:`translate(${t.x}px,${t.y}px) translate(-50%,-50%) rotate(430deg) scale(1)`,  opacity:1, offset:.88},
        {transform:`translate(${t.x}px,${t.y}px) translate(-50%,-50%) rotate(470deg) scale(1.8)`, opacity:0}
      ], {duration:FX_TRAVEL + 120, easing:'cubic-bezier(.35,.05,.5,1)'});
      /* 尾 */
      for(let i = 1; i <= 3; i++){
        const tr = spawn('fx-trail', 0, 0);
        tr.style.background = accent;
        tr.animate([
          {transform:`translate(${a.x}px,${a.y}px) translate(-50%,-50%) scale(${1 - i*.18})`, opacity:0},
          {transform:`translate(${a.x}px,${a.y}px) translate(-50%,-50%) scale(${1 - i*.18})`, opacity:.5, offset:.16},
          {transform:`translate(${t.x}px,${t.y}px) translate(-50%,-50%) scale(${.4 - i*.08})`, opacity:0}
        ], {duration:FX_TRAVEL + 120, delay:i * 55, easing:'cubic-bezier(.35,.05,.5,1)'});
        drop(tr, FX_TRAVEL + 300);
      }
      drop(proj, FX_TRAVEL + 200);
    }, startAt);
  }

  /* ---- ④ 着弾 ---- */
  setTimeout(() => {
    const tc = centerOf(fx.target.team, fx.target.slot);
    if(!tc) return;

    if(fx.targetKind === 'damage' || fx.targetKind === 'block'){
      const col = fx.targetKind === 'block' ? '#2a6ea0' : '#111';
      /* 閃光 */
      const flash = spawn('fx-flash', tc.x, tc.y);
      flash.style.width = tc.r.width + 'px';
      flash.style.height = tc.r.height + 'px';
      flash.animate([{opacity:.85},{opacity:0}], {duration:340, easing:'ease-out'});
      drop(flash, 360);
      /* 放射 */
      const burst = spawn('fx-burst', tc.x, tc.y,
        `<svg viewBox="0 0 100 100"><g stroke="${col}" stroke-width="6.5" stroke-linecap="round">
         <path d="M50 4v18M50 78v18M4 50h18M78 50h18M17 17l12 12M71 71l12 12M83 17l-12 12M29 71l-12 12"/></g></svg>`);
      burst.animate([
        {opacity:1, transform:'translate(-50%,-50%) scale(.3) rotate(0deg)'},
        {opacity:.9, transform:'translate(-50%,-50%) scale(.95) rotate(20deg)', offset:.45},
        {opacity:0, transform:'translate(-50%,-50%) scale(1.5) rotate(45deg)'}
      ], {duration:620, easing:'cubic-bezier(.2,.8,.3,1)'});
      drop(burst, 640);
    }

    if(fx.targetKind === 'damage'){
      tc.el.animate([
        {transform:'translate(0,0) rotate(0deg)'},
        {transform:'translate(-7px,3px) rotate(-1.6deg)', offset:.15},
        {transform:'translate(6px,-3px) rotate(1.4deg)',  offset:.32},
        {transform:'translate(-5px,-2px) rotate(-1deg)',  offset:.5},
        {transform:'translate(4px,2px) rotate(.7deg)',    offset:.68},
        {transform:'translate(-2px,1px) rotate(0deg)',    offset:.85},
        {transform:'translate(0,0) rotate(0deg)'}
      ], {duration:520, easing:'ease-out'});
    }

    /* ダメージ / 回復の数値 — 大きく、ゆっくり */
    if(fx.targetText){
      const n = spawn('fx-num ' + (fx.targetKind || 'neutral'), tc.x, tc.y - 4, fx.targetText);
      n.animate([
        {opacity:0, transform:'translate(-50%,-50%) scale(.4)'},
        {opacity:1, transform:'translate(-50%,-62%) scale(1.5)',  offset:.16},
        {opacity:1, transform:'translate(-50%,-72%) scale(1.12)', offset:.3},
        {opacity:1, transform:'translate(-50%,-108%) scale(1.05)', offset:.72},
        {opacity:0, transform:'translate(-50%,-165%) scale(.95)'}
      ], {duration:FX_IMPACT, easing:'cubic-bezier(.15,.9,.25,1)'});
      drop(n, FX_IMPACT + 40);
    }

    /* 属性相性 */
    if(fx.affText){
      const cls = fx.affText === '有利' ? 'fx-aff weak' : fx.affText === '無効' ? 'fx-aff null' : 'fx-aff resist';
      const e = spawn(cls, tc.x, tc.y - tc.r.height / 2 + 8, fx.affText);
      e.animate([
        {opacity:0, transform:'translate(-50%,-50%) scale(.5) rotate(-9deg)'},
        {opacity:1, transform:'translate(-50%,-50%) scale(1.14) rotate(-9deg)', offset:.2},
        {opacity:1, transform:'translate(-50%,-50%) scale(1) rotate(-9deg)', offset:.35},
        {opacity:1, offset:.75},
        {opacity:0, transform:'translate(-50%,-90%) rotate(-9deg)'}
      ], {duration:FX_IMPACT + 120, easing:'ease-out'});
      drop(e, FX_IMPACT + 160);
    }

    const chip = (text, dy, delay) => {
      const e = spawn('fx-chip', tc.x, tc.y + tc.r.height / 2 + dy, text);
      e.animate([
        {opacity:0, transform:'translate(-50%,-50%) scale(.7)'},
        {opacity:1, transform:'translate(-50%,-50%) scale(1)', offset:.22},
        {opacity:1, offset:.74},
        {opacity:0, transform:'translate(-50%,-130%)'}
      ], {duration:FX_IMPACT + 160, delay:delay || 0, easing:'ease-out'});
      drop(e, FX_IMPACT + 400);
    };
    if(fx.comboText)  chip(fx.comboText, -16, 60);
    if(fx.statusText) chip(fx.statusText, 2, 140);

    if(fx.defeat){
      const d = spawn('fx-ko', tc.x, tc.y, 'K.O.');
      d.animate([
        {opacity:0, transform:'translate(-50%,-50%) scale(.5) rotate(-14deg)'},
        {opacity:1, transform:'translate(-50%,-50%) scale(1.35) rotate(-14deg)', offset:.22},
        {opacity:1, transform:'translate(-50%,-50%) scale(1.1) rotate(-14deg)', offset:.4},
        {opacity:1, offset:.78},
        {opacity:0, transform:'translate(-50%,-70%) scale(1) rotate(-14deg)'}
      ], {duration:1200, easing:'ease-out'});
      drop(d, 1240);
      tc.el.animate([
        {opacity:1, transform:'scale(1) rotate(0deg)'},
        {opacity:.85, transform:'scale(1.05) rotate(0deg)', offset:.18},
        {opacity:.35, transform:'scale(.9) rotate(4deg)'}
      ], {duration:900, easing:'ease-out'});
    }
  }, impactAt);
}

function flushFx(){
  if(fxQueue.length === 0) return;
  const q = fxQueue;
  fxQueue = [];
  q.forEach((fx, i) => setTimeout(() => playFx(fx), i * FX_GAP));
}
