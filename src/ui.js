/* =========================================================
   ui.js — カード描画 / 画面更新 / 起動
   ========================================================= */

/* ---- スキル効果の短縮表記(カード内は極小フォントなので簡潔に) ---- */
function skillDetail(s){
  const p = [];
  p.push('SP' + s.cost);
  if(s.power > 0) p.push('威' + s.power);
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
  if(s.shield) p.push('盾+' + s.shield);
  if(s.selfShield) p.push('自盾+' + s.selfShield);
  if(s.cleanse) p.push('治癒');
  if(s.buffSelf) p.push('自攻+' + Math.round(s.buffSelf.amount * 100) + '%');
  if(s.buffAll) p.push('全攻+' + Math.round(s.buffAll.amount * 100) + '%');
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

function skRow(tk, sk, kind, skill, tag, roleMatch, isKing){
  if(isKing){
    return `<div class="sk king"><span class="sk-tag">王</span><span class="sk-body">
      <span class="sk-name">${skill.name}</span><span class="sk-detail">${skill.desc}</span></span></div>`;
  }
  const c = teams[tk].slots[sk];
  const usable = tk === 'player' && state.turn === 'player' && !state.over
    && !state.pendingAction && !state.moveMode
    && roleMatch && c.alive && c.sealed <= 0 && teams.player.sp >= skill.cost;
  return `<div class="sk${usable ? ' usable' : ''}"${usable ? ` onclick="event.stopPropagation();activateSkill('${tk}','${sk}','${kind}')"` : ''}>
    <span class="sk-tag">${tag}</span>
    <span class="sk-body"><span class="sk-name">${skill.name}</span><span class="sk-detail">${skillDetail(skill)}</span></span>
    ${usable ? '<span class="sk-go">▶</span>' : ''}
  </div>`;
}

function cardTile(tk, sk){
  const c = teams[tk].slots[sk];
  if(!c) return '';
  const role = roleOf(sk);
  const meta = ELEM[c.elem] || {};
  const rar = RARITY[c.rarity] || RARITY.N;

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

  const canMove = tk === 'player' && state.turn === 'player' && !state.over && role !== 'king' && c.alive
    && !state.pendingAction && !state.moveMode
    && (teams.player.freeMove || teams.player.sp >= MOVE_COST);

  const st = [];
  if(c.status) st.push(`<span class="st ${c.status}">${statusLabel(c.status)}</span>`);
  if(c.shield > 0) st.push(`<span class="st">盾${c.shield}</span>`);
  if(c.sealed > 0) st.push(`<span class="st">封印</span>`);
  if(c.stunned > 0) st.push(`<span class="st">スタン</span>`);
  if(c.atkBuff > 0) st.push(`<span class="st up">攻+</span>`);
  if(c.atkBuff < 0) st.push(`<span class="st down">攻-</span>`);

  return `<div class="${cls}" data-team="${tk}" data-slot="${sk}" ${onclick}>
    <div class="c-accent" style="background:${rar.frame}"></div>
    <div class="c-head" style="background:linear-gradient(180deg,${meta.accent}22,${meta.accent}44)">
      <span class="c-elem" style="background:${meta.accent}">${meta.icon}</span>
      <span class="c-name">${c.name}</span>
      <span class="c-rarity" style="border-color:${rar.frame};color:${rar.frame}">${c.rarity}</span>
    </div>
    <div class="c-art"><svg class="art"><use href="#art-${c.tplId}"/></svg></div>
    <div class="c-stat">
      <span class="c-role${role === 'king' ? ' king' : ''}">${roleLabel(role)}</span>
      ${role !== 'king' ? `<span class="c-move${canMove ? ' usable' : ''}"${canMove ? ` onclick="event.stopPropagation();startMoveSource('${tk}','${sk}')"` : ''}>⇄</span>` : ''}
      <span class="c-hp">${c.hp}/${c.maxHp}</span>
    </div>
    <div class="c-hpbar"><i style="width:${Math.round(c.hp / c.maxHp * 100)}%"></i></div>
    <div class="c-skills">
      ${skRow(tk, sk, 'f0', c.front[0], '前', role === 'front')}
      ${skRow(tk, sk, 'f1', c.front[1], '特', role === 'front')}
      ${skRow(tk, sk, 'back', c.back, '後', role === 'back')}
      ${skRow(tk, sk, null, c.king, '王', false, true)}
    </div>
    ${st.length ? `<div class="c-status">${st.join('')}</div>` : ''}
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
       <button onclick="resetGame()">もう一度たたかう</button></div></div>` : '';

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

/* ---- 起動 / リセット ---- */
const DEFAULT_PLAYER = ['karai','soda','kaki','natto','onigiri'];
const DEFAULT_ENEMY  = ['natto','onigiri','karai','soda','kaki'];

function resetGame(){
  document.getElementById('fxLayer').innerHTML = '';
  fxQueue = [];
  newBattle(DEFAULT_PLAYER, DEFAULT_ENEMY);
  startTurn('player');
  render();
}

function boot(){
  buildArtDefs();
  resetGame();
}

boot();
