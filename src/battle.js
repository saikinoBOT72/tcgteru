/* =========================================================
   battle.js — 盤面 / ダメージ計算 / スキル効果 / 王スキル
   ========================================================= */

const MOVE_COST = 1;
const SLOTS = ['frontL','frontR','backL','backR','king'];
/* 企画書TODO「勝利条件・バトル終了条件の細部」の確定版:
   30ターン経過で判定決着。王のHP割合 → 全体HP割合 の順に比較し、
   完全同値のときのみ引き分けとする。 */
const TURN_LIMIT = 30;

let teams, state;

function createCard(id){
  const t = CARD_DB[id];
  return {
    tplId:id, name:t.name, elem:t.elem, rarity:t.rarity, hp:t.hp, maxHp:t.hp,
    front:t.front, back:t.back, king:t.king,
    status:null, statusTurns:0, shield:0, alive:true,
    atkBuff:0, atkBuffTurns:0, sealed:0, stunned:0, freeMove:false
  };
}

function makeTeam(ids){
  return {
    fallenCount:0, sp:0, hitCount:0, turnCount:0, rampUp:0, freeMove:false,
    slots:{
      frontL:createCard(ids[0]), frontR:createCard(ids[1]),
      backL:createCard(ids[2]),  backR:createCard(ids[3]),
      king:createCard(ids[4])
    }
  };
}

function newBattle(playerIds, enemyIds){
  teams = {player:makeTeam(playerIds), enemy:makeTeam(enemyIds)};
  state = {turn:'player', over:false, winner:null,
           pendingAction:null, moveMode:false, moveSource:null};
}

function roleOf(k){ return k.startsWith('front') ? 'front' : (k === 'king' ? 'king' : 'back'); }
function roleLabel(r){ return r === 'front' ? '前衛' : r === 'king' ? '王' : '後衛'; }
function statusLabel(t){ return STATUS_LABEL[t] || t; }
function foe(tk){ return tk === 'player' ? 'enemy' : 'player'; }

function aliveSlots(tk, fn){
  const s = teams[tk].slots;
  return SLOTS.filter(k => s[k] && s[k].alive && (!fn || fn(k, s[k])));
}
function deadSlots(tk){
  const s = teams[tk].slots;
  return SLOTS.filter(k => s[k] && !s[k].alive);
}
function kingOf(tk){ const k = teams[tk].slots.king; return (k && k.alive) ? k : null; }
function kingTrig(tk, trigger){
  const k = kingOf(tk);
  return (k && k.king.trigger === trigger) ? k.king : null;
}
function isLastStand(tk){
  return aliveSlots(tk).length === 1 && !!kingOf(tk);
}
function isFullBoard(tk){ return aliveSlots(tk).length === 5; }

/* ---- 攻撃側の倍率 ---- */
function attackMult(tk, card){
  let m = 1 + (card.atkBuff || 0);
  const t = teams[tk];

  const rage = kingTrig(tk, 'rage');
  if(rage) m *= (1 + rage.value * t.fallenCount);

  const ramp = kingTrig(tk, 'rampUp');
  if(ramp) m *= (1 + Math.min(ramp.max, ramp.value * t.rampUp));

  const spMax = kingTrig(tk, 'spMax');
  if(spMax && t.sp >= spMax.need) m *= (1 + spMax.value);

  const full = kingTrig(tk, 'fullBoard');
  if(full && isFullBoard(tk)) m *= (1 + full.value);

  const last = kingTrig(tk, 'lastStand');
  if(last && isLastStand(tk)) m *= (1 + last.value);

  return m;
}

/* ---- 防御側の倍率 ---- */
function defendMult(tk, target, attacker){
  let m = 1;

  const nul = kingTrig(tk, 'elemNull');
  if(nul && attacker && attacker.elem === nul.elem) return 0;

  const guard = kingTrig(tk, 'frontGuard');
  if(guard){
    const fronts = ['frontL','frontR'].filter(k => teams[tk].slots[k] && teams[tk].slots[k].alive).length;
    if(fronts >= 2) m *= (1 - guard.value);
  }

  const last = kingTrig(tk, 'lastStand');
  if(last && isLastStand(tk)) m *= (1 - last.value * .5);

  const full = kingTrig(tk, 'fullBoard');
  if(full && isFullBoard(tk)) m *= (1 - full.value * .5);

  return m;
}

/* ---- ダメージ計算(属性相性を含む) ---- */
function computeDamage(atkTk, atkCard, defTk, defCard, base){
  const aff = affinityMult(atkCard.elem, defCard.elem);
  let d = base * attackMult(atkTk, atkCard) * aff * defendMult(defTk, defCard, atkCard);

  const sb = kingTrig(atkTk, 'statusBonus');
  if(sb && defCard.status) d += sb.value;

  return {dmg: Math.max(0, Math.round(d)), aff};
}

/* ---- ダメージ適用(耐える/カウンター/撃破) ---- */
function dealDamage(atkTk, atkCard, defTk, defSlot, base, fx){
  const defCard = teams[defTk].slots[defSlot];
  if(!defCard || !defCard.alive) return 0;

  const {dmg, aff} = computeDamage(atkTk, atkCard, defTk, defCard, base);

  if(dmg > 0 && defCard.shield > 0){
    defCard.shield--;
    queueFx({target:{team:defTk, slot:defSlot}, targetText:'GUARD', targetKind:'block', noProjectile:!fx});
    return 0;
  }

  let applied = dmg;
  // 王スキル「耐える」: 前衛の致死ダメージをHP1で耐える(1体1回)
  const endure = kingTrig(defTk, 'endure');
  if(endure && roleOf(defSlot) === 'front' && !defCard.endured && applied >= defCard.hp && defCard.hp > 1){
    applied = defCard.hp - 1;
    defCard.endured = true;
    queueFx({target:{team:defTk, slot:defSlot}, targetText:'耐えた!', targetKind:'block', noProjectile:true});
  }

  defCard.hp = Math.max(0, defCard.hp - applied);
  teams[defTk].hitCount++;

  if(fx){
    fx.targetText = '-' + applied;
    fx.targetKind = 'damage';
    if(aff >= 2) fx.affText = '弱点!';
    else if(aff === 0) fx.affText = '無効';
    else if(aff < 1) fx.affText = '半減';
  }

  if(defCard.hp <= 0) killCard(defTk, defSlot);
  else checkCounter(defTk, atkTk);

  return applied;
}

/* ---- 王スキル「カウンター」 ---- */
function checkCounter(defTk, atkTk){
  const c = kingTrig(defTk, 'counter');
  if(!c) return;
  if(teams[defTk].hitCount > 0 && teams[defTk].hitCount % c.need === 0){
    aliveSlots(atkTk).forEach(k => {
      const t = teams[atkTk].slots[k];
      t.hp = Math.max(0, t.hp - c.value);
      queueFx({target:{team:atkTk, slot:k}, targetText:'-' + c.value, targetKind:'damage', noProjectile:true});
      if(t.hp <= 0) killCard(atkTk, k);
    });
  }
}

function killCard(tk, sk){
  const c = teams[tk].slots[sk];
  if(!c || !c.alive) return;
  c.alive = false;
  teams[tk].fallenCount++;
  queueFx({target:{team:tk, slot:sk}, defeat:true});
  if(sk === 'king') endGame(foe(tk));
}

function endGame(w){ state.over = true; state.winner = w; }

/* ---- 時間切れ判定 ---- */
function hpRatio(tk){
  let cur = 0, max = 0;
  SLOTS.forEach(k => { const c = teams[tk].slots[k]; if(c){ cur += c.alive ? c.hp : 0; max += c.maxHp; } });
  return max ? cur / max : 0;
}
function kingRatio(tk){
  const k = teams[tk].slots.king;
  return (k && k.alive) ? k.hp / k.maxHp : 0;
}
function judgeTimeUp(){
  const pk = kingRatio('player'), ek = kingRatio('enemy');
  if(pk !== ek){ endGame(pk > ek ? 'player' : 'enemy'); return; }
  const ph = hpRatio('player'), eh = hpRatio('enemy');
  if(ph !== eh){ endGame(ph > eh ? 'player' : 'enemy'); return; }
  state.over = true; state.winner = 'draw';
}

/* ---- 状態異常付与(王スキル連動あり) ---- */
function inflictStatus(atkTk, defTk, defSlot, type, fx){
  const c = teams[defTk].slots[defSlot];
  if(!c || !c.alive) return;
  c.status = type;
  c.statusTurns = type === 'burn' ? 2 : type === 'poison' ? 3 : 1;
  if(fx) fx.statusText = statusLabel(type) + '!';

  // 王スキル: 味方が状態異常を付与したとき追加ダメージ
  const on = kingTrig(atkTk, 'onStatusInflict');
  if(on){
    c.hp = Math.max(0, c.hp - on.value);
    queueFx({target:{team:defTk, slot:defSlot}, targetText:'-' + on.value, targetKind:'damage', noProjectile:true});
    if(c.hp <= 0) killCard(defTk, defSlot);
  }
  // 王スキル: 味方の状態異常を自動治療
  const cl = kingTrig(defTk, 'autoCleanse');
  if(cl && c.alive){
    c.status = null; c.statusTurns = 0;
    queueFx({target:{team:defTk, slot:defSlot}, targetText:'治癒', targetKind:'buff', noProjectile:true});
  }
}

/* ---- ターゲット候補 ---- */
function validTargets(tk, slotKey, skill){
  if(skill.targetDead) return {teamKey:tk, slots:deadSlots(tk)};
  if(skill.friendly)   return {teamKey:tk, slots:aliveSlots(tk)};
  const opp = foe(tk);
  if(roleOf(slotKey) === 'front'){
    const f = aliveSlots(opp, k => roleOf(k) === 'front');
    if(f.length > 0) return {teamKey:opp, slots:f};
    return {teamKey:opp, slots:aliveSlots(opp, k => roleOf(k) !== 'front')};
  }
  return {teamKey:opp, slots:aliveSlots(opp)};
}

function skillOf(card, slotKey, kind){
  if(kind === 'back') return card.back;
  return card.front[kind === 'f0' ? 0 : 1];
}
function canUse(slotKey, kind){
  const r = roleOf(slotKey);
  if(kind === 'back') return r === 'back';
  return r === 'front';
}

/* =========================================================
   スキル実行
   ========================================================= */
function executeSkill(atkTk, slotKey, skill, tTk, tSlot){
  const team = teams[atkTk];
  const card = team.slots[slotKey];
  if(!card || !card.alive || team.sp < skill.cost) return;

  if(card.sealed > 0){
    queueFx({attacker:{team:atkTk, slot:slotKey}, attackerTag:'スキル封印中'});
    return;
  }
  if(card.status === 'freeze'){
    team.sp -= skill.cost; card.status = null;
    queueFx({attacker:{team:atkTk, slot:slotKey}, attackerTag:'凍結で動けない'});
    clearSelection(); render(); return;
  }
  if(card.stunned > 0){
    team.sp -= skill.cost; card.stunned--;
    queueFx({attacker:{team:atkTk, slot:slotKey}, attackerTag:'スタンで動けない'});
    clearSelection(); render(); return;
  }

  team.sp -= skill.cost;

  if(card.status === 'paralyze'){
    card.status = null;
    if(Math.random() < .5){
      queueFx({attacker:{team:atkTk, slot:slotKey}, attackerTag:'しびれて失敗'});
      clearSelection(); render(); return;
    }
  }

  const target = teams[tTk].slots[tSlot];
  const fx = {attacker:{team:atkTk, slot:slotKey}, target:{team:tTk, slot:tSlot},
              skillName:skill.name, elem:card.elem};

  /* ---------- 味方向け ---------- */
  if(skill.friendly || skill.targetDead){
    const parts = [];
    if(skill.revive && target && !target.alive){
      target.alive = true;
      target.hp = Math.max(1, Math.round(target.maxHp * skill.revive.hpPct));
      target.status = null; target.shield = 0;
      teams[tTk].fallenCount = Math.max(0, teams[tTk].fallenCount - 1);
      parts.push('復活!');
    }
    if(skill.heal && target && target.alive){
      const before = target.hp;
      target.hp = Math.min(target.maxHp, target.hp + skill.heal);
      parts.push('+' + (target.hp - before));
    }
    if(skill.healAll){
      aliveSlots(atkTk).forEach(k => {
        const c = team.slots[k];
        const b = c.hp; c.hp = Math.min(c.maxHp, c.hp + skill.healAll);
        if(c.hp > b && k !== tSlot) queueFx({target:{team:atkTk, slot:k}, targetText:'+' + (c.hp - b), targetKind:'buff', noProjectile:true});
      });
      const b2 = target ? target.hp : 0;
      parts.push('全体回復');
    }
    if(skill.shield && target && target.alive){ target.shield += skill.shield; parts.push('盾+' + skill.shield); }
    if(skill.cleanse && target && target.status){ target.status = null; target.statusTurns = 0; parts.push('治癒'); }
    if(skill.gainSP){ team.sp += skill.gainSP; parts.push('SP+' + skill.gainSP); }
    if(skill.buffAll){
      aliveSlots(atkTk).forEach(k => {
        team.slots[k].atkBuff = skill.buffAll.amount;
        team.slots[k].atkBuffTurns = skill.buffAll.turns;
      });
      parts.push('攻+' + Math.round(skill.buffAll.amount * 100) + '%');
    }
    if(skill.friendlyFreeMove){ team.freeMove = true; parts.push('移動無料'); }

    fx.targetText = parts.join(' ') || '—';
    fx.targetKind = 'buff';
    queueFx(fx);
    clearSelection(); render(); return;
  }

  /* ---------- 敵向け ---------- */
  if(skill.buffSelf){ card.atkBuff = skill.buffSelf.amount; card.atkBuffTurns = skill.buffSelf.turns + 1; }
  if(skill.selfShield){ card.shield += skill.selfShield; }

  if(skill.power > 0 && target){
    const dealt = dealDamage(atkTk, card, tTk, tSlot, skill.power, fx);

    // 確率連撃(外れるまで連鎖)
    if(skill.hits && dealt > 0){
      let extra = 0;
      while(Math.random() < skill.hits.chance && extra < 4 && target.alive){
        extra++;
        dealDamage(atkTk, card, tTk, tSlot, skill.power, null);
        queueFx({target:{team:tTk, slot:tSlot}, targetText:'追撃!', targetKind:'damage', noProjectile:true});
      }
      if(extra) fx.comboText = (extra + 1) + 'HIT';
    }

    // 貫通(後衛/王へ漏れる)
    if(skill.pierce && roleOf(tSlot) === 'front'){
      aliveSlots(tTk, k => roleOf(k) !== 'front').forEach(k => {
        dealDamage(atkTk, card, tTk, k, Math.round(skill.power * skill.pierce), null);
        queueFx({target:{team:tTk, slot:k}, targetText:'貫通', targetKind:'damage', noProjectile:true});
      });
    }

    if(skill.drainSP) teams[tTk].sp = Math.max(0, teams[tTk].sp - skill.drainSP);

    if(skill.status && target.alive){
      const chance = skill.critStatus ? Math.min(1, skill.status.chance + .25) : skill.status.chance;
      if(Math.random() < chance) inflictStatus(atkTk, tTk, tSlot, skill.status.type, fx);
    }
    if(skill.stun && target.alive){ target.stunned = 1; fx.statusText = 'スタン!'; }
    if(skill.sealTarget && target.alive){ target.sealed = 2; fx.statusText = '封印!'; }
    if(skill.debuffAtk && target.alive){
      target.atkBuff = -skill.debuffAtk.amount;
      target.atkBuffTurns = skill.debuffAtk.turns;
      fx.statusText = '攻ダウン';
    }
    if(skill.reflectStatus && card.status && target.alive){
      inflictStatus(atkTk, tTk, tSlot, card.status, fx);
      card.status = null; card.statusTurns = 0;
    }
    if(skill.swapEnemy){
      const s = teams[tTk].slots;
      const a = roleOf(tSlot) === 'front' ? tSlot : 'frontL';
      const b = roleOf(tSlot) === 'front' ? 'backL' : tSlot;
      if(roleOf(a) !== 'king' && roleOf(b) !== 'king'){
        const t = s[a]; s[a] = s[b]; s[b] = t;
        queueFx({swap:[{team:tTk, slot:a}, {team:tTk, slot:b}]});
      }
    }
  }

  queueFx(fx);
  clearSelection();
  render();
}

/* =========================================================
   ターン処理
   ========================================================= */
function startTurn(tk){
  const team = teams[tk];
  team.sp += 1;
  team.turnCount++;
  team.rampUp = team.turnCount;

  if(team.turnCount > TURN_LIMIT){ judgeTimeUp(); return; }

  SLOTS.forEach(k => {
    const c = team.slots[k];
    if(!c || !c.alive) return;

    if(c.atkBuffTurns > 0){
      c.atkBuffTurns--;
      if(c.atkBuffTurns <= 0) c.atkBuff = 0;
    }
    if(c.sealed > 0) c.sealed--;

    if(c.status === 'burn' || c.status === 'poison'){
      const d = c.status === 'burn' ? 2 : 3;
      c.hp = Math.max(0, c.hp - d);
      queueFx({target:{team:tk, slot:k}, targetText:'-' + d, targetKind:'damage', noProjectile:true});
      c.statusTurns--;
      if(c.statusTurns <= 0) c.status = null;
      if(c.hp <= 0) killCard(tk, k);
    }
  });
  if(state.over) return;

  const king = kingOf(tk);
  if(king){
    const th = kingTrig(tk, 'turnHeal');
    if(th && king.hp < king.maxHp){
      const b = king.hp; king.hp = Math.min(king.maxHp, king.hp + th.value);
      queueFx({target:{team:tk, slot:'king'}, targetText:'+' + (king.hp - b), targetKind:'buff', noProjectile:true});
    }
    const bh = kingTrig(tk, 'backHeal');
    if(bh){
      const backs = ['backL','backR'].filter(k => team.slots[k] && team.slots[k].alive).length;
      if(backs >= 2 && king.hp < king.maxHp){
        const b = king.hp; king.hp = Math.min(king.maxHp, king.hp + bh.value);
        queueFx({target:{team:tk, slot:'king'}, targetText:'+' + (king.hp - b), targetKind:'buff', noProjectile:true});
      }
    }
  }
}

function clearSelection(){ state.pendingAction = null; state.moveMode = false; state.moveSource = null; }

function onEndTurn(){
  if(state.over || state.turn !== 'player') return;
  clearSelection();
  state.turn = 'enemy';
  startTurn('enemy');
  render();
  if(!state.over) setTimeout(aiStep, 650);
}

function backToPlayer(){ state.turn = 'player'; startTurn('player'); render(); }

/* ---- 敵AI ---- */
function aiStep(){
  if(state.over) return;
  const t = teams.enemy;
  if(t.sp < 1){ backToPlayer(); return; }

  const actable = aliveSlots('enemy', k => roleOf(k) !== 'king' && t.slots[k].sealed <= 0);
  if(actable.length === 0){ backToPlayer(); return; }

  const slotKey = actable[Math.floor(Math.random() * actable.length)];
  const c = t.slots[slotKey];
  const r = roleOf(slotKey);
  const skill = r === 'front' ? (Math.random() < .4 ? c.front[1] : c.front[0]) : c.back;
  if(t.sp < skill.cost){ backToPlayer(); return; }

  const vt = validTargets('enemy', slotKey, skill);
  if(vt.slots.length === 0){ setTimeout(aiStep, 350); return; }

  // 弱点を突ける相手を優先
  let best = vt.slots[0], bestScore = -1;
  vt.slots.forEach(k => {
    const tc = teams[vt.teamKey].slots[k];
    let sc = skill.friendly || skill.targetDead
      ? (tc.maxHp - tc.hp)
      : affinityMult(c.elem, tc.elem) * 10 - tc.hp * .1;
    sc += Math.random() * 2;
    if(sc > bestScore){ bestScore = sc; best = k; }
  });

  executeSkill('enemy', slotKey, skill, vt.teamKey, best);
  if(!state.over) setTimeout(aiStep, 1000);
  else render();
}

/* ---- プレイヤー操作 ---- */
function activateSkill(tk, sk, kind){
  if(state.over || state.turn !== 'player' || tk !== 'player') return;
  if(state.pendingAction || state.moveMode) return;
  const c = teams.player.slots[sk];
  if(!c || !c.alive || c.sealed > 0) return;
  if(!canUse(sk, kind)) return;
  const skill = skillOf(c, sk, kind);
  if(teams.player.sp < skill.cost) return;
  if(validTargets('player', sk, skill).slots.length === 0) return;
  state.pendingAction = {slotKey:sk, skill};
  render();
}

function chooseTarget(tk, sk){
  if(!state.pendingAction) return;
  const {slotKey, skill} = state.pendingAction;
  const vt = validTargets('player', slotKey, skill);
  if(tk !== vt.teamKey || !vt.slots.includes(sk)) return;
  executeSkill('player', slotKey, skill, vt.teamKey, sk);
}

function startMoveSource(tk, sk){
  if(state.over || state.turn !== 'player' || tk !== 'player') return;
  if(state.pendingAction || state.moveMode) return;
  const c = teams.player.slots[sk];
  if(!c || !c.alive || roleOf(sk) === 'king') return;
  if(!teams.player.freeMove && teams.player.sp < MOVE_COST) return;
  state.moveMode = true; state.moveSource = sk;
  render();
}

function chooseMoveDest(sk){
  if(!state.moveMode) return;
  const src = state.moveSource;
  if(roleOf(sk) === 'king' || roleOf(src) === 'king') return;
  if(teams.player.freeMove) teams.player.freeMove = false;
  else if(teams.player.sp >= MOVE_COST) teams.player.sp -= MOVE_COST;
  else { clearSelection(); render(); return; }
  const s = teams.player.slots;
  const t = s[src]; s[src] = s[sk]; s[sk] = t;
  queueFx({swap:[{team:'player', slot:src}, {team:'player', slot:sk}]});
  clearSelection();
  render();
}

function cancelSelection(){ clearSelection(); render(); }
