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

function createCard(id, lv){
  const t = CARD_DB[id];
  return {
    tplId:id, name:t.name, elem:t.elem, rarity:t.rarity, hp:t.hp, maxHp:t.hp,
    /* 表示用の写し。演出が着弾した瞬間に hp/alive から更新される。
       これがないと「殴る前にHPが減っている」画になる */
    shownHp:t.hp, shownAlive:true,
    lv: Math.min(MAX_LV, Math.max(1, lv || 1)),
    skills:t.skills, king:t.king,
    status:null, statusTurns:0, alive:true, usedThisTurn:{},
    /* locked = 行動封じ系の状態異常で「今ターンは動けない」 */
    locked:false, lockedBy:'',
    atkBuff:0, atkBuffTurns:0, freeMove:false
  };
}

/* ids は id文字列、または {id, lv} を混在で受け取れる */
function makeTeam(ids){
  const g = i => {
    const e = ids[i];
    return (e && typeof e === 'object') ? createCard(e.id, e.lv) : createCard(e, MAX_LV);
  };
  return {
    fallenCount:0, sp:0, hitCount:0, turnCount:0, rampUp:0, freeMove:false,
    slots:{ frontL:g(0), frontR:g(1), backL:g(2), backR:g(3), king:g(4) }
  };
}

/* ---- 後攻補正 ----------------------------------------------
   毎ターンSP+1の共有プール制では、先攻が常に一手先にSPを使える
   ぶんだけ有利になる(補正なしのミラー400戦で先攻55.8%)。
   後攻側は初期SPを1持った状態で始めることで、初手のSP差を消す。
   ------------------------------------------------------------ */
const SECOND_PLAYER_SP = 1;

function newBattle(playerIds, enemyIds, first){
  teams = {player:makeTeam(playerIds), enemy:makeTeam(enemyIds)};
  const f = first || 'player';
  teams[foe(f)].sp = SECOND_PLAYER_SP;
  state = {turn:f, over:false, winner:null,
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
/* 王スキルは Lv4 に到達したカードだけが発動する(4つ目の解放枠) */
function kingTrig(tk, trigger){
  const k = kingOf(tk);
  return (k && kingActive(k.lv) && k.king.trigger === trigger) ? k.king : null;
}
function isLastStand(tk){
  return aliveSlots(tk).length === 1 && !!kingOf(tk);
}
function isFullBoard(tk){ return aliveSlots(tk).length === 5; }

/* ---- 攻撃側の倍率 ---- */
function attackMult(tk, card){
  let m = 1 + (card.atkBuff || 0);
  const t = teams[tk];

  /* 弱体系の状態異常(麻痺など)は与ダメージに倍率で効く */
  const spec = STATUS_SPEC[card.status];
  if(spec && spec.atkMod !== 1) m *= spec.atkMod;

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
    if(aff === 0) fx.affText = '無効';
    else if(aff > 1) fx.affText = '有利';
    else if(aff < 1) fx.affText = '軽減';
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
  const spec = STATUS_SPEC[type];
  if(!spec) return;
  c.status = type;
  c.statusTurns = spec.turns;
  if(fx) fx.statusText = spec.label + '!';

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

/* ---- 遮蔽ルール ----------------------------------------
   前衛はそれぞれ「斜め後ろ2枚」を覆っている。
     frontL が塞ぐ: backL / king
     frontR が塞ぐ: king / backR
   前衛枠が空く(倒れる)と、その枠が覆っていた2枚が露出して
   前衛スキルの標的に入る。王は左右どちらの穴からも露出する。
   露出した枠に移動でカードを入れ直せば、また覆われる。
   -------------------------------------------------------- */
const FRONT_COVER = {frontL:['backL','king'], frontR:['king','backR']};

function exposedSlots(tk){
  const s = teams[tk].slots;
  const out = [];
  Object.keys(FRONT_COVER).forEach(f => {
    const fc = s[f];
    if(fc && fc.alive) return;               // その前衛枠は埋まっている
    FRONT_COVER[f].forEach(k => {
      if(s[k] && s[k].alive && out.indexOf(k) < 0) out.push(k);
    });
  });
  return out;
}

/* ---- ターゲット候補 ---- */
function validTargets(tk, slotKey, skill){
  if(skill.targetDead) return {teamKey:tk, slots:deadSlots(tk)};
  if(skill.friendly)   return {teamKey:tk, slots:aliveSlots(tk)};
  const opp = foe(tk);
  /* 狙える範囲は role ではなく reach で決まる。
     'front' なら遮蔽に従い、'any' なら遮蔽を無視して誰でも。 */
  if(skill.reach === 'front'){
    const fronts = aliveSlots(opp, k => roleOf(k) === 'front');
    return {teamKey:opp, slots: fronts.concat(exposedSlots(opp))};
  }
  return {teamKey:opp, slots:aliveSlots(opp)};
}

function skillAt(card, idx){ return card.skills ? card.skills[idx] : null; }
function canUse(slotKey, skill){ return !!skill && roleOf(slotKey) === skill.role; }

/* その枠から今使えるスキルを [{idx, skill}] で返す */
function usableSkills(tk, slotKey){
  const c = teams[tk].slots[slotKey];
  if(!c || !c.alive || c.locked) return [];
  return (c.skills || []).map((sk, idx) => ({idx, skill:sk}))
    .filter(o => skillUnlocked(c.lv, o.idx) && canUse(slotKey, o.skill)
             && !(o.skill.oncePerTurn && c.usedThisTurn[o.idx]));
}

/* =========================================================
   スキル実行
   ========================================================= */
function executeSkill(atkTk, slotKey, skill, tTk, tSlot){
  const team = teams[atkTk];
  const card = team.slots[slotKey];
  if(!card || !card.alive || team.sp < skill.cost) return;

  /* 行動封じ中は動けない。代償(チームSP-1)はターン開始時に
     すでに支払っているので、ここではSPを二重に取らない。 */
  if(card.locked){
    queueFx({attacker:{team:atkTk, slot:slotKey},
             attackerTag:(card.lockedBy || '行動不能') + 'で動けない'});
    clearSelection(); render(); return;
  }

  team.sp -= skill.cost;
  if(skill.oncePerTurn){
    const ix = (card.skills || []).indexOf(skill);
    if(ix >= 0) card.usedThisTurn[ix] = true;
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
      target.status = null;
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
    if(skill.cleanse && target && target.status){ target.status = null; target.statusTurns = 0; parts.push('治癒'); }
    if(skill.gainSP){ team.sp += skill.gainSP; parts.push('SP+' + skill.gainSP); }
    if(skill.buffAll){
      aliveSlots(atkTk).forEach(k => {
        team.slots[k].atkBuff = skill.buffAll.amount;
        team.slots[k].atkBuffTurns = skill.buffAll.turns;
      });
      parts.push('攻+' + Math.round(skill.buffAll.amount * 100) + '%');
    }
    if(skill.buffTarget && target && target.alive){
      target.atkBuff = skill.buffTarget.amount;
      target.atkBuffTurns = skill.buffTarget.turns;
      parts.push('攻+' + Math.round(skill.buffTarget.amount * 100) + '%');
    }
    if(skill.friendlyFreeMove){ team.freeMove = true; parts.push('移動無料'); }

    fx.targetText = parts.join(' ') || '—';
    fx.targetKind = 'buff';
    queueFx(fx);
    applySelfDamage(atkTk, slotKey, skill, fx);
    clearSelection(); render(); return;
  }

  /* ---------- 敵向け ---------- */
  if(skill.buffSelf){ card.atkBuff = skill.buffSelf.amount; card.atkBuffTurns = skill.buffSelf.turns + 1; }

  if(skill.power > 0 && target){
    if(skill.allEnemies){
      /* 全体攻撃: reach で届く範囲の全員に同威力
         (reach:'any' なら敵全員、'front' なら前衛と露出枠だけを薙ぐ) */
      validTargets(atkTk, slotKey, skill).slots.forEach(k => {
        const isMain = k === tSlot;
        dealDamage(atkTk, card, tTk, k, skill.power, isMain ? fx : null);
        if(!isMain) queueFx({target:{team:tTk, slot:k}, targetText:'-' + skill.power, targetKind:'damage', noProjectile:true});
      });
      fx.comboText = '全体';
    } else {
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
    }
  }

  /* 威力0の妨害スキルでも下の効果は必ず通す */
  if(skill.drainSP){
    teams[tTk].sp = Math.max(0, teams[tTk].sp - skill.drainSP);
    if(!fx.statusText) fx.statusText = '敵SP-' + skill.drainSP;
  }
  if(skill.status && target && target.alive){
    const chance = skill.critStatus ? Math.min(1, skill.status.chance + .25) : skill.status.chance;
    if(Math.random() < chance) inflictStatus(atkTk, tTk, tSlot, skill.status.type, fx);
  }
  if(skill.stun && target && target.alive) inflictStatus(atkTk, tTk, tSlot, 'stun', fx);
  if(skill.sealTarget && target && target.alive) inflictStatus(atkTk, tTk, tSlot, 'seal', fx);
  if(skill.debuffAtk && target && target.alive){
    target.atkBuff = -skill.debuffAtk.amount;
    target.atkBuffTurns = skill.debuffAtk.turns;
    fx.statusText = '攻ダウン';
  }
  if(skill.debuffAll){
    validTargets(atkTk, slotKey, skill).slots.forEach(k => {
      const c2 = teams[tTk].slots[k];
      c2.atkBuff = -skill.debuffAll.amount;
      c2.atkBuffTurns = skill.debuffAll.turns;
      if(k !== tSlot) queueFx({target:{team:tTk, slot:k}, targetText:'攻ダウン', targetKind:'block', noProjectile:true});
    });
    fx.statusText = '全体攻ダウン';
  }
  if(skill.reflectStatus && card.status && target && target.alive){
    inflictStatus(atkTk, tTk, tSlot, card.status, fx);
    card.status = null; card.statusTurns = 0;
  }
  if(skill.gainSP){ team.sp += skill.gainSP; }
  if(skill.swapEnemy){
    const s2 = teams[tTk].slots;
    const a = roleOf(tSlot) === 'front' ? tSlot : 'frontL';
    const b = roleOf(tSlot) === 'front' ? 'backL' : tSlot;
    if(roleOf(a) !== 'king' && roleOf(b) !== 'king'){
      const t2 = s2[a]; s2[a] = s2[b]; s2[b] = t2;
      queueFx({swap:[{team:tTk, slot:a}, {team:tTk, slot:b}]});
    }
  }

  queueFx(fx);
  applySelfDamage(atkTk, slotKey, skill, fx);
  clearSelection();
  render();
}

/* =========================================================
   ターン処理
   ========================================================= */
function startTurn(tk){
  const team = teams[tk];
  /* 前のターンの演出は出切っているので、表示を実データに合わせ直す */
  SLOTS.forEach(k => { const c = team.slots[k]; if(c){ c.shownHp = c.hp; c.shownAlive = c.alive; } });
  team.sp += 1;
  team.turnCount++;
  team.rampUp = team.turnCount;

  if(team.turnCount > TURN_LIMIT){ judgeTimeUp(); return; }

  SLOTS.forEach(k => {
    const c = team.slots[k];
    if(!c) return;
    c.usedThisTurn = {};            // 「1ターン1回」制限をリセット
    c.locked = false; c.lockedBy = '';
    if(!c.alive) return;

    if(c.atkBuffTurns > 0){
      c.atkBuffTurns--;
      if(c.atkBuffTurns <= 0) c.atkBuff = 0;
    }

    /* 状態異常は全て STATUS_SPEC の1つの表から処理する */
    const spec = STATUS_SPEC[c.status];
    if(!spec) return;

    if(spec.dot > 0){
      c.hp = Math.max(0, c.hp - spec.dot);
      queueFx({target:{team:tk, slot:k}, targetText:'-' + spec.dot,
               targetKind:'damage', noProjectile:true});
    }
    if(spec.lock){
      c.locked = true; c.lockedBy = spec.label;
      team.sp = Math.max(0, team.sp - LOCK_SP_DRAIN);
      queueFx({target:{team:tk, slot:k}, targetText:spec.label + ' SP-' + LOCK_SP_DRAIN,
               targetKind:'block', noProjectile:true});
    }

    c.statusTurns--;
    if(c.statusTurns <= 0){ c.status = null; c.statusTurns = 0; }
    if(c.hp <= 0) killCard(tk, k);
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

/* ---- 反動ダメージ --------------------------------------------
   SP回復スキルの代償。共有SP制では「毎ターン +1 SP」は
   「毎ターン 1アクション増える」とほぼ同義で、単純攻撃1回ぶん
   (約17ダメージ)よりずっと重い。数値を削るだけでは釣り合わない
   ので、SPは自分のHPで買わせる。自滅もありうる。
   ---------------------------------------------------------------- */
function applySelfDamage(tk, slotKey, skill, fx){
  if(!skill.selfDamage) return;
  const c = teams[tk].slots[slotKey];
  if(!c || !c.alive) return;
  c.hp = Math.max(0, c.hp - skill.selfDamage);
  queueFx({target:{team:tk, slot:slotKey}, targetText:'-' + skill.selfDamage,
           targetKind:'damage', noProjectile:true});
  if(c.hp <= 0) killCard(tk, slotKey);
}

function clearSelection(){ state.pendingAction = null; state.moveMode = false; state.moveSource = null; }

function onEndTurn(){
  if(state.over || state.turn !== 'player') return;
  clearSelection();
  state.turn = 'enemy';
  startTurn('enemy');
  render();
  if(!state.over) setTimeout(aiStep, 1100);
}

function backToPlayer(){ state.turn = 'player'; startTurn('player'); render(); }

/* ---- 敵AI ---- */
function aiStep(){
  if(state.over) return;
  const t = teams.enemy;
  if(t.sp < 1){ backToPlayer(); return; }

  /* 今のSPで実際に撃てる手だけを候補にする */
  const options = [];
  aliveSlots('enemy', k => roleOf(k) !== 'king').forEach(k => {
    usableSkills('enemy', k).forEach(o => {
      if(t.sp < o.skill.cost) return;
      if(validTargets('enemy', k, o.skill).slots.length === 0) return;
      options.push({slotKey:k, skill:o.skill});
    });
  });
  if(options.length === 0){ backToPlayer(); return; }

  /* 重撃(SP2以上)はSPに余裕があるときだけ優先的に選ぶ */
  const heavy = options.filter(o => o.skill.cost >= 2);
  const pool = (heavy.length && t.sp >= 3 && Math.random() < .6) ? heavy : options;
  const {slotKey, skill} = pool[Math.floor(Math.random() * pool.length)];
  const c = t.slots[slotKey];

  const vt = validTargets('enemy', slotKey, skill);

  // 弱点を突ける相手を優先
  let best = vt.slots[0], bestScore = -1;
  vt.slots.forEach(k => {
    const tc = teams[vt.teamKey].slots[k];
    let sc = skill.friendly || skill.targetDead
      ? (tc.maxHp - tc.hp)
      : affinityMult(c.elem, tc.elem) * 10 - tc.hp * .1;
    if(!skill.friendly && !skill.targetDead && k === 'king') sc += 8;  // 露出した王は好機
    sc += Math.random() * 2;
    if(sc > bestScore){ bestScore = sc; best = k; }
  });

  executeSkill('enemy', slotKey, skill, vt.teamKey, best);
  if(!state.over) setTimeout(aiStep, FX_TOTAL + 250);
  else render();
}

/* ---- プレイヤー操作 ---- */
function activateSkill(tk, sk, idx){
  if(state.over || state.turn !== 'player' || tk !== 'player') return;
  if(state.pendingAction || state.moveMode) return;
  const c = teams.player.slots[sk];
  if(!c || !c.alive || c.locked) return;
  const skill = skillAt(c, +idx);
  if(!skillUnlocked(c.lv, +idx)) return;
  if(!canUse(sk, skill)) return;
  if(skill.oncePerTurn && c.usedThisTurn[+idx]) return;
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
