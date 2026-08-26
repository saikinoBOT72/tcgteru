/* =========================================================
   ui.js — カード描画 / 画面更新 / 起動
   ========================================================= */

/* ---- スキル効果の短縮表記(カード内は極小フォントなので簡潔に) ---- */
function skillDetail(s){
  const p = [];
  p.push('SP' + s.cost);
  if(s.power > 0) p.push((s.allEnemies ? '全体威' : '威') + s.power);
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

/* ---- スキル1行(ctx がある時だけタップ可能になる) ---- */
function skRow(skill, tag, isKing, ctx){
  if(isKing){
    return `<div class="sk king"><span class="sk-tag">王</span><span class="sk-body">
      <span class="sk-name">${skill.name}</span><span class="sk-detail">${skill.desc}</span></span></div>`;
  }
  const usable = !!(ctx && ctx.usable);
  return `<div class="sk${usable ? ' usable' : ''}"${usable ? ` onclick="event.stopPropagation();activateSkill('${ctx.tk}','${ctx.sk}','${ctx.kind}')"` : ''}>
    <span class="sk-tag">${tag}</span>
    <span class="sk-body"><span class="sk-name">${skill.name}</span><span class="sk-detail">${skillDetail(skill)}</span></span>
    ${usable ? '<span class="sk-go">▶</span>' : ''}
  </div>`;
}

/* ---- カードの面(バトルも編成も同じ見た目を共有する) ----
   ctx = {tk, sk} を渡すとバトル用にタップ可能・状態バッジ付きになる。
   渡さなければ静的なカード表示。寸法とレイアウトはどちらも完全に同一。 */
function cardFaceHtml(c, role, ctx){
  const meta = ELEM[c.elem] || {};
  const rar = RARITY[c.rarity] || RARITY.N;

  const live = ctx && teams && state;
  const mk = (kind, roleMatch) => {
    if(!live) return null;
    const usable = ctx.tk === 'player' && state.turn === 'player' && !state.over
      && !state.pendingAction && !state.moveMode
      && roleMatch && c.alive && c.sealed <= 0 && teams.player.sp >= (kind === 'back' ? c.back.cost : c.front[kind === 'f0' ? 0 : 1].cost);
    return {tk:ctx.tk, sk:ctx.sk, kind, usable};
  };

  const canMove = live && ctx.tk === 'player' && state.turn === 'player' && !state.over
    && role !== 'king' && c.alive && !state.pendingAction && !state.moveMode
    && (teams.player.freeMove || teams.player.sp >= MOVE_COST);

  const st = [];
  if(live){
    if(c.status) st.push(`<span class="st ${c.status}">${statusLabel(c.status)}</span>`);
    if(c.sealed > 0) st.push(`<span class="st">封印</span>`);
    if(c.stunned > 0) st.push(`<span class="st">スタン</span>`);
    if(c.atkBuff > 0) st.push(`<span class="st up">攻+</span>`);
    if(c.atkBuff < 0) st.push(`<span class="st down">攻-</span>`);
  }

  return `<div class="c-accent" style="background:${rar.frame}"></div>
    <div class="c-head" style="background:linear-gradient(180deg,${meta.accent}22,${meta.accent}44)">
      <span class="c-elem" style="background:${meta.accent}">${meta.icon}</span>
      <span class="c-name">${c.name}</span>
      <span class="c-rarity" style="border-color:${rar.frame};color:${rar.frame}">${c.rarity}</span>
    </div>
    <div class="c-art"><svg class="art"><use href="#art-${c.tplId}"/></svg></div>
    <div class="c-stat">
      <span class="c-role${role === 'king' ? ' king' : ''}">${roleLabel(role)}</span>
      ${role !== 'king' ? `<span class="c-move${canMove ? ' usable' : ''}"${canMove ? ` onclick="event.stopPropagation();startMoveSource('${ctx.tk}','${ctx.sk}')"` : ''}>⇄</span>` : ''}
      <span class="c-hp">${c.hp}/${c.maxHp}</span>
    </div>
    <div class="c-hpbar"><i style="width:${Math.round(c.hp / c.maxHp * 100)}%"></i></div>
    <div class="c-skills">
      ${skRow(c.front[0], '前', false, mk('f0', role === 'front'))}
      ${skRow(c.front[1], '特', false, mk('f1', role === 'front'))}
      ${skRow(c.back, '後', false, mk('back', role === 'back'))}
      ${skRow(c.king, '王', true, null)}
    </div>
    ${st.length ? `<div class="c-status">${st.join('')}</div>` : ''}`;
}

function cardTile(tk, sk){
  const c = teams[tk].slots[sk];
  if(!c) return '';
  const role = roleOf(sk);

  let cls = 'card-tile';
  if(!c.alive) cls += ' dead';

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

  const verdict = state.winner === 'player' ? '🏆 あなたの勝利!'
                : state.winner === 'enemy'  ? '💀 敗北…'
                : '🤝 引き分け';
  document.getElementById('ovlRoot').innerHTML = state.over
    ? `<div class="ovl"><div class="ovl-card"><h2>${verdict}</h2>
       <div style="display:flex;gap:8px;justify-content:center;">
         <button onclick="startCpuBattle()">もう一度</button>
         <button onclick="showScreen('home')">ホームへ</button>
       </div></div></div>` : '';

  requestAnimationFrame(flushFx);
}

/* ---- アート/グラデーションの defs を組み立て ---- */
function buildArtDefs(){
  const grads = Object.keys(ELEM).map(e => {
    const m = ELEM[e];
    return `<radialGradient id="bg-${m.id}" cx="50%" cy="42%">
      <stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="${m.accent}59"/></radialGradient>`;
  }).join('');
  const syms = Object.keys(ART).map(id =>
    `<symbol id="art-${id}" viewBox="0 0 100 50" preserveAspectRatio="xMidYMid slice">${ART[id]}</symbol>`
  ).join('');
  document.getElementById('artDefs').innerHTML = `<defs>${grads}${syms}</defs>`;
}

/* =========================================================
   所持カード / デッキ
   ガチャ未実装のため、現状は全カード所持として扱う
   ========================================================= */
const SLOT_ORDER = ['frontL','frontR','backL','backR','king'];
const DEFAULT_DECK = ['karai','soda','kaki','natto','onigiri'];
const DECK_KEY = 'tcgteru.deck.v1';

function ownedCards(){ return CARD_IDS.slice(); }

let playerDeck = DEFAULT_DECK.slice();
let deckSelSlot = 0;   // 編成画面で選択中のスロット index

function loadDeck(){
  try{
    const raw = localStorage.getItem(DECK_KEY);
    if(raw){
      const a = JSON.parse(raw);
      if(Array.isArray(a) && a.length === 5 && a.every(id => CARD_DB[id])) return a;
    }
  }catch(e){ /* プライベートモード等では黙って既定デッキ */ }
  return DEFAULT_DECK.slice();
}
function saveDeck(){
  try{ localStorage.setItem(DECK_KEY, JSON.stringify(playerDeck)); }catch(e){}
}

function randomDeck(){
  const pool = ownedCards().slice();
  const out = [];
  for(let i = 0; i < 5; i++) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
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

/* ---- ホーム ---- */
function miniCardHtml(id){
  const c = CARD_DB[id];
  return `<div class="mini"><div class="mart"><svg><use href="#art-${id}"/></svg></div>
    <div class="mname">${c.name}</div></div>`;
}

function renderHome(){
  document.getElementById('screenHome').innerHTML = `
    <h1 class="home-title">食卓バトル</h1>
    <p class="home-sub">β — 陣形とSPで戦う食卓TCG</p>
    <div class="home-crest">${ELEMENTS.map(e => `<span style="background:${ELEM[e].accent}33">${ELEM[e].icon}</span>`).join('')}</div>
    <div class="home-menu">
      <button class="menu-btn primary" onclick="startCpuBattle()">
        <span class="mi">⚔️</span><span>CPUとバトル<span class="msub">今の編成でたたかう</span></span></button>
      <button class="menu-btn" onclick="showScreen('deck')">
        <span class="mi">🃏</span><span>デッキ編成<span class="msub">所持 ${ownedCards().length} 枚から5枚を配置</span></span></button>
      <button class="menu-btn" disabled>
        <span class="mi">🎰</span><span>ガチャ<span class="msub">準備中</span></span></button>
    </div>
    <div class="home-deck">
      <span class="home-deck-label">現在の編成</span>
      <div class="mini-row">${[0,1].map(i => miniCardHtml(playerDeck[i])).join('')}</div>
      <div class="mini-row">${[2,4,3].map(i => miniCardHtml(playerDeck[i])).join('')}</div>
    </div>`;
}

/* ---- デッキ編成 ---- */
function slotHtml(i){
  const id = playerDeck[i];
  const c = CARD_DB[id];
  const sel = deckSelSlot === i ? ' sel' : '';
  const role = roleLabel(roleOf(SLOT_ORDER[i]));
  return `<div class="slot${sel}" onclick="selectDeckSlot(${i})">
    <div class="srole">${role}</div>
    ${c ? `<div class="sart"><svg><use href="#art-${id}"/></svg></div><div class="sname">${c.name}</div>`
        : `<div class="sempty">未設定</div><div class="sname">—</div>`}
  </div>`;
}

function renderDeck(){
  const owned = ownedCards();
  const list = owned.map(id => {
    const at = playerDeck.indexOf(id);
    const inst = createCard(id);
    const role = at >= 0 ? roleOf(SLOT_ORDER[at]) : 'front';
    const placedCls = at >= 0 ? ' placed' : '';
    const tag = at >= 0 ? `<span class="placed-tag">${roleLabel(roleOf(SLOT_ORDER[at]))}</span>` : '';
    return `<div class="card-tile${placedCls}" onclick="assignCard('${id}')">
      ${cardFaceHtml(inst, role)}${tag}</div>`;
  }).join('');

  const selName = CARD_DB[playerDeck[deckSelSlot]] ? CARD_DB[playerDeck[deckSelSlot]].name : '未設定';
  document.getElementById('screenDeck').innerHTML = `
    <div class="deck-head">
      <button class="back-btn" onclick="showScreen('home')">← 戻る</button>
      <h2>デッキ編成</h2>
    </div>
    <div class="formation">
      <div class="form-row">${[0,1].map(slotHtml).join('')}</div>
      <div class="form-row">${[2,4,3].map(slotHtml).join('')}</div>
    </div>
    <div class="deck-hint">
      ${roleLabel(roleOf(SLOT_ORDER[deckSelSlot]))}枠(現在:${selName})に置くカードを下から選択
    </div>
    <div class="deck-list"><div class="deck-grid">${list}</div></div>
    <div class="deck-foot"><button class="end" onclick="startCpuBattle()">この編成でバトル</button></div>`;
}

function selectDeckSlot(i){ deckSelSlot = i; renderDeck(); }

function assignCard(id){
  const existing = playerDeck.indexOf(id);
  if(existing === deckSelSlot) return;
  if(existing >= 0){
    // 既に別枠にいるカードなら入れ替え(同じカードが2枚並ばないように)
    playerDeck[existing] = playerDeck[deckSelSlot];
  }
  playerDeck[deckSelSlot] = id;
  saveDeck();
  renderDeck();
}

/* ---- バトル開始 ---- */
function startCpuBattle(){
  document.getElementById('fxLayer').innerHTML = '';
  fxQueue = [];
  newBattle(playerDeck, randomDeck());
  startTurn('player');
  showScreen('battle');
}

function boot(){
  buildArtDefs();
  playerDeck = loadDeck();
  showScreen('home');
}

boot();
