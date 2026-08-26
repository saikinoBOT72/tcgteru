/* =========================================================
   ui.js — カード描画 / 画面更新 / 起動
   ========================================================= */

/* ---- アート ------------------------------------------------
   カードは自前SVG(ART)か切り出し画像(CARD_DB.img)のどちらかを持つ。
   どちらでも同じ枠に object-fit:cover で嵌るので、外側の寸法は不変。
   ------------------------------------------------------------ */
function artHtml(id){
  const t = CARD_DB[id];
  if(t && t.img) return `<img class="art" src="${t.img}" alt="">`;
  return `<svg class="art"><use href="#art-${id}"/></svg>`;
}

/* ---- スキル効果の短縮表記(カード内は極小フォントなので簡潔に) ---- */
function skillDetail(s){
  const p = [];
  p.push('SP' + s.cost);
  if(s.power > 0) p.push((s.allEnemies ? '全体威' : '威') + s.power);
  /* 射程は既定と違うときだけ出す(前衛=手前 / 後衛=全域 が既定) */
  const hitsEnemy = !s.friendly && !s.targetDead;
  if(hitsEnemy && s.reach === 'any' && s.role === 'front') p.push('全域');
  if(hitsEnemy && s.reach === 'front' && s.role === 'back') p.push('手前');
  if(s.heal) p.push('回復' + s.heal);
  if(s.healAll) p.push('全体回復' + s.healAll);
  if(s.revive) p.push('蘇生' + Math.round(s.revive.hpPct * 100) + '%');
  if(s.hits) p.push('連撃' + Math.round(s.hits.chance * 100) + '%');
  if(s.pierce) p.push('貫通' + Math.round(s.pierce * 100) + '%');
  if(s.status) p.push(statusLabel(s.status.type) + Math.round(s.status.chance * 100) + '%');
  if(s.critStatus) p.push('会心+');
  if(s.stun) p.push('スタン');
  if(s.sealTarget) p.push('封印');
  if(s.swapEnemy) p.push('陣形かく乱');
  if(s.drainSP) p.push('敵SP-' + s.drainSP);
  if(s.gainSP) p.push('SP+' + s.gainSP);
  if(s.cleanse) p.push('治癒');
  if(s.buffSelf) p.push('自攻' + Math.round(s.buffSelf.amount * 100) + '%');
  if(s.buffAll) p.push('全攻' + Math.round(s.buffAll.amount * 100) + '%');
  if(s.buffTarget) p.push('攻' + Math.round(s.buffTarget.amount * 100) + '%');
  if(s.debuffAll) p.push('全敵攻-' + Math.round(s.debuffAll.amount * 100) + '%');
  if(s.debuffAtk) p.push('敵攻-' + Math.round(s.debuffAtk.amount * 100) + '%');
  if(s.reflectStatus) p.push('異常返し');
  if(s.friendlyFreeMove) p.push('移動無料');
  return p.join(' ');
}

function spHtml(tk){
  const turnInfo = tk === 'player'
    ? `<span class="turn-count">${Math.min(teams.player.turnCount, TURN_LIMIT)}/${TURN_LIMIT}T</span>` : '';
  return `<span>${tk === 'player' ? '自分SP' : '敵SP'}</span><span class="teamsp-value">${teams[tk].sp}</span>${turnInfo}`;
}

/* ---- スキル1行 ----
   skill が無い枠は空欄のまま描く(スキル数が3未満のカード用)。
   タグは枠の位置ではなく skill.role から出すので、前衛2/後衛1 でも
   前衛1/後衛2 でも正しく「前」「後」が並ぶ。 */
function skRow(skill, ctx, locked, lvNeed){
  if(!skill) return '<div class="sk empty"></div>';
  if(locked){
    return `<div class="sk locked">
      <span class="sk-tag">${lvNeed}</span>
      <span class="sk-body"><span class="sk-name">${skill.name}</span>
      <span class="sk-detail">Lv${lvNeed}で解放</span></span></div>`;
  }
  const usable = !!(ctx && ctx.usable);
  const tag = skill.role === 'front' ? '前' : '後';
  return `<div class="sk${usable ? ' usable' : ''}"${usable ? ` onclick="event.stopPropagation();activateSkill('${ctx.tk}','${ctx.sk}',${ctx.idx})"` : ''}>
    <span class="sk-tag">${tag}</span>
    <span class="sk-body"><span class="sk-name">${skill.name}</span><span class="sk-detail">${skillDetail(skill)}</span></span>
    ${usable ? '<span class="sk-go">▶</span>' : ''}
  </div>`;
}
function kingRow(k, lv){
  if(!kingActive(lv)){
    return `<div class="sk king locked"><span class="sk-tag">${MAX_LV}</span><span class="sk-body">
      <span class="sk-name">${k.name}</span><span class="sk-detail">Lv${MAX_LV}で解放</span></span></div>`;
  }
  return `<div class="sk king"><span class="sk-tag">王</span><span class="sk-body">
    <span class="sk-name">${k.name}</span><span class="sk-detail">${k.desc}</span></span></div>`;
}

/* ---- カードの面(バトルも編成も同じ見た目を共有する) ----
   ctx = {tk, sk} を渡すとバトル用にタップ可能・状態バッジ付きになる。
   渡さなければ静的なカード表示。寸法とレイアウトはどちらも完全に同一。 */
function cardFaceHtml(c, role, ctx){
  const shownHp = c.shownHp === undefined ? c.hp : c.shownHp;
  const meta = ELEM[c.elem] || {};
  const rar = RARITY[c.rarity] || RARITY.N;
  const live = ctx && teams && state;

  const lv = c.lv || MAX_LV;
  const rows = [0,1,2].map(i => {
    const skill = c.skills ? c.skills[i] : null;
    if(!skill) return skRow(null, null);
    if(!skillUnlocked(lv, i)) return skRow(skill, null, true, unlockLv(i));
    let cx = null;
    if(live){
      const usable = ctx.tk === 'player' && state.turn === 'player' && !state.over
        && !state.pendingAction && !state.moveMode
        && c.alive && !c.locked
        && role === skill.role && teams.player.sp >= skill.cost;
      cx = {tk:ctx.tk, sk:ctx.sk, idx:i, usable};
    }
    return skRow(skill, cx);
  }).join('');

  const canMove = live && ctx.tk === 'player' && state.turn === 'player' && !state.over
    && role !== 'king' && c.alive && !state.pendingAction && !state.moveMode
    && (teams.player.freeMove || teams.player.sp >= MOVE_COST);

  /* 状態は「何が・どれだけ・あと何ターン」まで出す */
  const st = [];
  if(live){
    if(c.status){
      const sp = STATUS_SPEC[c.status];
      /* 何が・どれだけ・あと何ターンかまで出す */
      const eff = sp.dot > 0 ? `-${sp.dot}/T`
                : sp.lock    ? '行動不可'
                : `攻${Math.round((sp.atkMod - 1) * 100)}%`;
      st.push(`<span class="st ${c.status}">${sp.label} ${eff}<b>${c.statusTurns}T</b></span>`);
    }
    if(c.locked) st.push(`<span class="st seal">動けない</span>`);
    if(c.atkBuff > 0) st.push(`<span class="st up">攻+${Math.round(c.atkBuff*100)}%<b>${c.atkBuffTurns}T</b></span>`);
    if(c.atkBuff < 0) st.push(`<span class="st down">攻${Math.round(c.atkBuff*100)}%<b>${c.atkBuffTurns}T</b></span>`);
  }

  return `<div class="c-accent" style="background:${rar.frame}"></div>
    <div class="c-head" style="background:linear-gradient(180deg,${meta.accent}22,${meta.accent}44)">
      <span class="c-elem" style="background:${meta.accent}"><svg viewBox="0 0 24 24" fill="#fff" stroke="none">${meta.svg}</svg></span>
      <span class="c-name">${c.name}</span>
      <span class="c-rarity" style="border-color:${rar.frame};color:${rar.frame}">${c.rarity}</span>
    </div>
    <div class="c-art">${artHtml(c.tplId)}${(CARD_DB[c.tplId] || {}).beta ? '<span class="c-beta">仮</span>' : ''}<span class="c-lv">Lv${lv}</span></div>
    <div class="c-stat">
      <span class="c-role${role === 'king' ? ' king' : ''}">${roleLabel(role)}</span>
      ${role !== 'king' ? `<span class="c-move${canMove ? ' usable' : ''}"${canMove ? ` onclick="event.stopPropagation();startMoveSource('${ctx.tk}','${ctx.sk}')"` : ''}>⇄</span>` : ''}
      <span class="c-hp">${shownHp}/${c.maxHp}</span>
    </div>
    <div class="c-hpbar"><i style="width:${Math.round(shownHp / c.maxHp * 100)}%"></i></div>
    <div class="c-skills">${rows}${kingRow(c.king, lv)}</div>
    ${st.length ? `<div class="c-status">${st.join('')}</div>` : ''}`;
}

function cardTile(tk, sk){
  const c = teams[tk].slots[sk];
  if(!c) return '';
  const role = roleOf(sk);

  let cls = 'card-tile';
  if(c.shownAlive === false) cls += ' dead';

  const pa = state.pendingAction;
  let isTarget = false;
  if(pa){
    const vt = validTargets('player', pa.slotKey, pa.skill);
    isTarget = vt.teamKey === tk && vt.slots.includes(sk);
  }
  const isDest = state.moveMode && tk === 'player' && role !== 'king' && sk !== state.moveSource;
  const isSrc  = state.moveMode && tk === 'player' && sk === state.moveSource;

  if(isTarget || isDest) cls += ' clickable';
  if(isTarget) cls += ' targetable';
  if(isDest) cls += ' movedest';
  if(isSrc) cls += ' movesrc';

  let onclick = '';
  if(isTarget) onclick = `onclick="chooseTarget('${tk}','${sk}')"`;
  else if(isDest) onclick = `onclick="chooseMoveDest('${sk}')"`;

  return `<div class="${cls}" data-team="${tk}" data-slot="${sk}" ${onclick}>
    ${cardFaceHtml(c, role, {tk, sk})}
  </div>`;
}

function centerBarHtml(){
  if(state.over) return '';
  if(state.turn !== 'player') return '<span>敵のターン</span>';
  if(state.moveMode) return `<span>入れ替え先をタップ${teams.player.freeMove ? '(無料)' : ` (SP${MOVE_COST})`}</span><button class="cancel-chip" onclick="cancelSelection()">✕</button>`;
  if(state.pendingAction) return `<span>「${state.pendingAction.skill.name}」の対象をタップ</span><button class="cancel-chip" onclick="cancelSelection()">✕</button>`;
  return '<span class="midline"></span>';
}

function render(){
  document.getElementById('enemySP').innerHTML = spHtml('enemy');
  document.getElementById('enemyBack').innerHTML = ['backL','king','backR'].map(k => cardTile('enemy', k)).join('');
  document.getElementById('enemyFront').innerHTML = ['frontL','frontR'].map(k => cardTile('enemy', k)).join('');
  document.getElementById('playerFront').innerHTML = ['frontL','frontR'].map(k => cardTile('player', k)).join('');
  document.getElementById('playerBack').innerHTML = ['backL','king','backR'].map(k => cardTile('player', k)).join('');
  document.getElementById('playerSP').innerHTML = spHtml('player');
  document.getElementById('centerBar').innerHTML = centerBarHtml();

  document.getElementById('endTurnBtn').disabled = state.over || state.turn !== 'player';

  const vKind = state.winner === 'player' ? 'win' : state.winner === 'enemy' ? 'lose' : 'draw';
  const verdict = state.winner === 'player' ? 'あなたの勝利'
                : state.winner === 'enemy'  ? '敗北'
                : '引き分け';
  document.getElementById('ovlRoot').innerHTML = state.over
    ? `<div class="ovl"><div class="ovl-card ${vKind}"><h2>${verdict}</h2>
       <p class="sub">${teams.player.turnCount} turns</p>
       <div style="display:flex;gap:8px;justify-content:center;">
         <button onclick="startCpuBattle()">もう一度</button>
         <button onclick="showScreen('home')">ホームへ</button>
       </div></div></div>` : '';

  requestAnimationFrame(flushFx);
}

/* =========================================================
   所持カード / デッキ / Lv
   ガチャ未実装のため、現状は全カードを所持している扱い。
   ガチャで同じカードが被るとLvが上がる想定なので、それまでは
   編成画面のLvボタンで手動に上げ下げして挙動を確認できる。
   ========================================================= */
const SLOT_ORDER = ['frontL','frontR','backL','backR','king'];
/* 既定は正式カードのさいきの5枚(属性が1枚ずつ揃う) */
const DEFAULT_DECK = ['sfire','sice','sbolt','spoison','splain'];
const DECK_KEY = 'tcgteru.deck.v3';
const LV_KEY   = 'tcgteru.levels.v1';

function ownedCards(){ return CARD_IDS.slice(); }

let playerDeck = DEFAULT_DECK.slice();
let cardLevels = {};              // id -> 1..4
let deckSelSlot = 0;
let deckDetail = false;           // 一覧をカード現物で見るか

function lvOf(id){ return cardLevels[id] || MAX_LV; }

function loadState(){
  try{
    const raw = localStorage.getItem(DECK_KEY);
    if(raw){
      const a = JSON.parse(raw);
      if(Array.isArray(a) && a.length === 5 && a.every(id => CARD_DB[id])) playerDeck = a;
    }
  }catch(e){}
  try{
    const raw = localStorage.getItem(LV_KEY);
    if(raw){
      const o = JSON.parse(raw);
      if(o && typeof o === 'object'){
        Object.keys(o).forEach(k => {
          if(CARD_DB[k]) cardLevels[k] = Math.min(MAX_LV, Math.max(1, o[k] | 0));
        });
      }
    }
  }catch(e){}
}
function saveState(){
  try{ localStorage.setItem(DECK_KEY, JSON.stringify(playerDeck)); }catch(e){}
  try{ localStorage.setItem(LV_KEY, JSON.stringify(cardLevels)); }catch(e){}
}

/* 出撃編成を {id, lv} の形にして渡す */
function deckEntries(){ return playerDeck.map(id => ({id, lv:lvOf(id)})); }

function randomDeck(){
  const pool = ownedCards().slice();
  const out = [];
  for(let i = 0; i < 5; i++){
    const id = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    out.push({id, lv:MAX_LV});
  }
  return out;
}

/* =========================================================
   画面切り替え
   ========================================================= */
let currentScreen = 'home';

function showScreen(name){
  currentScreen = name;
  ['Home','Deck','Battle'].forEach(s => {
    document.getElementById('screen' + s).classList.toggle('active', s.toLowerCase() === name);
  });
  if(name === 'home') renderHome();
  if(name === 'deck') renderDeck();
  if(name === 'battle') render();
}

/* 属性の丸アイコン(絵文字は使わず自前SVG) */
function elemDot(e, size){
  const m = ELEM[e];
  return `<span class="edot" style="background:${m.accent};width:${size}px;height:${size}px">
    <svg viewBox="0 0 24 24" fill="#fff" stroke="none">${m.svg}</svg></span>`;
}

/* ---- ホーム ---- */
function miniCardHtml(id){
  const c = CARD_DB[id];
  return `<div class="mini"><div class="mart">${artHtml(id)}${c.beta ? '<span class="mbeta">仮</span>' : ''}</div>
    <div class="mname">${c.name}</div><div class="mlv">Lv${lvOf(id)}</div></div>`;
}

function renderHome(){
  document.getElementById('screenHome').innerHTML = `
    <h1 class="home-title">食卓バトル</h1>
    <p class="home-sub">陣形とSPで戦う食卓TCG</p>
    <div class="home-crest">${ELEMENTS.map(e => elemDot(e, 30)).join('')}</div>
    <div class="home-menu">
      <button class="menu-btn primary" onclick="startCpuBattle()">
        CPUとバトル<span class="msub">今の編成でたたかう</span></button>
      <button class="menu-btn" onclick="showScreen('deck')">
        デッキ編成<span class="msub">所持 ${ownedCards().length} 枚から5枚を配置</span></button>
      <button class="menu-btn" disabled>
        ガチャ<span class="msub">準備中 — 被るとカードのLvが上がる予定</span></button>
    </div>
    <div class="home-deck">
      <span class="home-deck-label">現在の編成</span>
      <div class="mini-row">${[0,1].map(i => miniCardHtml(playerDeck[i])).join('')}</div>
      <div class="mini-row">${[2,4,3].map(i => miniCardHtml(playerDeck[i])).join('')}</div>
    </div>`;
}

/* ---- デッキ編成 --------------------------------------------
   操作は2ステップだけ:
     ① 上の陣形で「変えたい枠」をタップ
     ② 下の一覧で「入れるカード」をタップ
   置いたら選択が自動で次の枠へ進むので、上から順にタップし続ける
   だけで5枠が埋まる。既に別の枠にいるカードを選ぶと入れ替わる。
   ------------------------------------------------------------ */
const DECK_STEP_LABEL = ['前衛 左', '前衛 右', '後衛 左', '後衛 右', '王'];

function slotHtml(i){
  const id = playerDeck[i];
  const c = CARD_DB[id];
  const sel = deckSelSlot === i ? ' sel' : '';
  return `<div class="slot${sel}" onclick="selectDeckSlot(${i})">
    <div class="srole">${DECK_STEP_LABEL[i]}</div>
    ${c ? `<div class="sart">${artHtml(id)}${c.beta ? '<span class="mbeta">仮</span>' : ''}</div>
           <div class="sname">${c.name}</div><div class="slv">Lv${lvOf(id)}</div>`
        : `<div class="sempty">未設定</div><div class="sname">—</div><div class="slv">—</div>`}
    ${sel ? '<span class="sel-flag">ここ</span>' : ''}
  </div>`;
}

/* 一覧のコンパクトタイル(既定表示) */
function pickTileHtml(id){
  const c = CARD_DB[id];
  const at = playerDeck.indexOf(id);
  const rar = RARITY[c.rarity] || RARITY.N;
  return `<div class="pick${at >= 0 ? ' placed' : ''}" onclick="assignCard('${id}')">
    <div class="part">${artHtml(id)}${c.beta ? '<span class="mbeta">仮</span>' : ''}
      ${at >= 0 ? `<span class="pat">${DECK_STEP_LABEL[at]}</span>` : ''}</div>
    <div class="pname">${c.name}</div>
    <div class="pfoot">
      ${elemDot(c.elem, 15)}
      <span class="prar" style="color:${rar.frame};border-color:${rar.frame}">${c.rarity}</span>
      <button class="plv" onclick="event.stopPropagation();cycleLv('${id}')">Lv${lvOf(id)}</button>
    </div>
  </div>`;
}

/* 一覧の詳細表示(カード現物。スキル調整の確認用) */
function pickCardHtml(id){
  const at = playerDeck.indexOf(id);
  const inst = createCard(id, lvOf(id));
  const role = at >= 0 ? roleOf(SLOT_ORDER[at]) : 'front';
  return `<div class="deck-item">
    <div class="card-tile${at >= 0 ? ' placed' : ''}" onclick="assignCard('${id}')">
      ${cardFaceHtml(inst, role)}
      ${at >= 0 ? `<span class="placed-tag">${DECK_STEP_LABEL[at]}</span>` : ''}
    </div>
    <button class="plv wide" onclick="event.stopPropagation();cycleLv('${id}')">Lv${lvOf(id)} ▸</button>
  </div>`;
}

function renderDeck(){
  const list = deckDetail
    ? `<div class="deck-grid">${ownedCards().map(pickCardHtml).join('')}</div>`
    : `<div class="pick-grid">${ownedCards().map(pickTileHtml).join('')}</div>`;

  document.getElementById('screenDeck').innerHTML = `
    <div class="deck-head">
      <button class="back-btn" onclick="showScreen('home')">← 戻る</button>
      <h2>デッキ編成</h2>
      <button class="back-btn" onclick="toggleDeckDetail()">${deckDetail ? '一覧で見る' : 'カードで見る'}</button>
    </div>

    <div class="step"><b>1</b>変えたい枠をえらぶ</div>
    <div class="formation">
      <div class="form-row">${[0,1].map(slotHtml).join('')}</div>
      <div class="form-row">${[2,4,3].map(slotHtml).join('')}</div>
    </div>

    <div class="step"><b>2</b>「${DECK_STEP_LABEL[deckSelSlot]}」に入れるカードをえらぶ</div>
    <div class="deck-list">${list}</div>

    <div class="deck-foot"><button class="end" onclick="startCpuBattle()">この編成でバトル</button></div>`;
}

function selectDeckSlot(i){ deckSelSlot = i; renderDeck(); }
function toggleDeckDetail(){ deckDetail = !deckDetail; renderDeck(); }

/* Lvはガチャ実装までの確認用。タップで 1→2→3→4→1 と回す */
function cycleLv(id){
  cardLevels[id] = lvOf(id) >= MAX_LV ? 1 : lvOf(id) + 1;
  saveState();
  renderDeck();
}

function assignCard(id){
  const existing = playerDeck.indexOf(id);
  if(existing !== deckSelSlot){
    /* 既に別の枠にいるカードなら、その枠と中身を交換する */
    if(existing >= 0) playerDeck[existing] = playerDeck[deckSelSlot];
    playerDeck[deckSelSlot] = id;
    saveState();
  }
  deckSelSlot = (deckSelSlot + 1) % SLOT_ORDER.length;   // 次の枠へ自動で進む
  renderDeck();
}

/* ---- アート/グラデーションの defs ---- */
function buildArtDefs(){
  const grads = Object.keys(ELEM).map(e => {
    const m = ELEM[e];
    return `<radialGradient id="bg-${m.id}" cx="50%" cy="42%">
      <stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="${m.accent}52"/></radialGradient>`;
  }).join('');
  const syms = Object.keys(ART).map(id =>
    `<symbol id="art-${id}" viewBox="0 0 100 50" preserveAspectRatio="xMidYMid slice">${ART[id]}</symbol>`
  ).join('');
  document.getElementById('artDefs').innerHTML = `<defs>${grads}${syms}</defs>`;
}

/* ---- バトル開始 / 起動 ---- */
function startCpuBattle(){
  document.getElementById('fxLayer').innerHTML = '';
  fxQueue = [];
  newBattle(deckEntries(), randomDeck());
  startTurn('player');
  showScreen('battle');
}

function boot(){
  buildArtDefs();
  loadState();
  showScreen('home');
}

boot();
