/* =========================================================
   data.js — 属性 / レアリティ / Lv / カードアート / カードDB
   ========================================================= */

const ELEMENTS = ['炎', '氷', '毒', '雷', '無'];

/* 属性アイコンは絵文字を使わず、すべて自前のSVGグリフで描く */
const ELEM = {
  '炎': {accent:'#d1462f', id:'fire',
    svg:'<path d="M12 2c1.2 4.2-2.8 5.2-2.8 9a2.8 2.8 0 0 0 5.6 0c0-1-.8-1.9-.8-2.8 2 1.1 3.9 3.2 3.9 6A7.9 7.9 0 0 1 4 14.2C4 8.6 10.6 7.8 12 2z"/>'},
  '氷': {accent:'#2f7fae', id:'ice',
    svg:'<g stroke="currentColor" stroke-width="1.9" stroke-linecap="round" fill="none"><path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/><path d="M12 6.4 9.9 4.6M12 6.4l2.1-1.8M12 17.6l-2.1 1.8M12 17.6l2.1 1.8"/></g>'},
  '毒': {accent:'#7b40b5', id:'poison',
    svg:'<path d="M12 2.6c3.4 4.4 6.2 7.2 6.2 10.6a6.2 6.2 0 0 1-12.4 0C5.8 9.8 8.6 7 12 2.6z"/><circle cx="9.7" cy="13" r="1.5" fill="#fff"/><circle cx="14.3" cy="13" r="1.5" fill="#fff"/>'},
  '雷': {accent:'#b8901a', id:'bolt',
    svg:'<path d="M13.4 2 4.6 13.4h5.2L8.9 22l9.1-11.9h-5.3z"/>'},
  '無': {accent:'#71807a', id:'none',
    svg:'<circle cx="12" cy="12" r="7.6" fill="none" stroke="currentColor" stroke-width="2.4"/>'}
};

/* ---- 属性相性表 --------------------------------------------
   4すくみ: 炎→氷→毒→雷→炎 が有利(1.2倍)
   逆流しと同属性は軽減(0.8倍)、無は攻守とも常に等倍
   0倍(無効)は基礎相性では使わず、王スキル専用の枠
   ------------------------------------------------------------ */
const AFFINITY = {
  '炎': {'炎':0.8, '氷':1.2, '毒':1.0, '雷':0.8, '無':1.0},
  '氷': {'炎':0.8, '氷':0.8, '毒':1.2, '雷':1.0, '無':1.0},
  '毒': {'炎':1.0, '氷':0.8, '毒':0.8, '雷':1.2, '無':1.0},
  '雷': {'炎':1.2, '氷':1.0, '毒':0.8, '雷':0.8, '無':1.0},
  '無': {'炎':1.0, '氷':1.0, '毒':1.0, '雷':1.0, '無':1.0}
};
function affinityMult(a, d){
  const row = AFFINITY[a];
  return row && row[d] !== undefined ? row[d] : 1.0;
}

const RARITY = {
  N : {label:'N',  rank:0, frame:'#71807a', gachaWeight:74},
  R : {label:'R',  rank:1, frame:'#2f6ba8', gachaWeight:20},
  SR: {label:'SR', rank:2, frame:'#b8901a', gachaWeight:5},
  UR: {label:'UR', rank:3, frame:'#8331ad', gachaWeight:1}
};

/* ---- 状態異常の価値表 ----------------------------------------
   全ての状態異常を「与ダメージ換算で 14〜16」に揃えてある。
   共有SP制では『1体の行動を潰す』だけでは他のカードで代替できて
   しまうため、行動封じ系は SP も 1 奪って初めて 1 アクション分の
   価値になる。効果は次の3系統だけに整理した:

     ① 継続ダメージ … dot × turns
        やけど 7×2 = 14 / 毒 4×4 = 16
     ② 行動封じ     … lock。ターン開始時に「そのカードは今ターン
        行動不可」+ チームSP-1。1アクション ≒ 16 相当
        凍結 / スタン / 封印
     ③ 弱体         … atkMod。そのカードの与ダメージに倍率
        麻痺 0.55倍 ×2T ≒ 2回分の半減 ≒ 15 相当

   カード側の付与確率は「威力 + 確率 × 実効価値 ≒ 同コストの
   単純攻撃 + 少し」になるよう data 側で決めている。
   ---------------------------------------------------------------- */
const STATUS_SPEC = {
  burn    : {label:'やけど', turns:2, dot:7, lock:false, atkMod:1   },
  poison  : {label:'毒',     turns:4, dot:4, lock:false, atkMod:1   },
  freeze  : {label:'凍結',   turns:1, dot:0, lock:true,  atkMod:1   },
  stun    : {label:'スタン', turns:1, dot:0, lock:true,  atkMod:1   },
  seal    : {label:'封印',   turns:1, dot:0, lock:true,  atkMod:1   },
  paralyze: {label:'麻痺',   turns:2, dot:0, lock:false, atkMod:.55 }
};
/* 行動封じが奪うチームSP */
const LOCK_SP_DRAIN = 1;

const STATUS_LABEL = {};
Object.keys(STATUS_SPEC).forEach(k => { STATUS_LABEL[k] = STATUS_SPEC[k].label; });

/* =========================================================
   Lv システム
   Lv1..4。ガチャで同じカードが被るとLvが上がる(ガチャ未実装)。
   カードは必ず「通常スキル3つ + 王スキル1つ = 計4つ」を持ち、
   上から順に解放される:
     Lv1 … スキル1(必ず前衛スキル)
     Lv2 … スキル2 まで
     Lv3 … スキル3 まで
     Lv4 … 王スキルも起動する
   ========================================================= */
const MAX_LV = 4;
/* n番目(0始まり)のスキルが解放されるLv。王スキルは index 3 相当 */
function unlockLv(idx){ return idx + 1; }
function skillUnlocked(lv, idx){ return lv >= unlockLv(idx); }
function kingActive(lv){ return lv >= MAX_LV; }

/* =========================================================
   スキル定義ヘルパ
   role  = どの枠に置かれている時に使えるか(前衛枠 / 後衛枠)
   reach = 誰を狙えるか。role とは独立
     'front' … 手前のみ(相手の前衛と、前衛が倒れて露出した枠)
     'any'   … 遮蔽を無視して誰でも
   ========================================================= */
function F(o){ return Object.assign({role:'front', reach:'front', cost:1}, o); }
function B(o){ return Object.assign({role:'back',  reach:'any',   cost:1}, o); }
function mkSkill(o){ return Object.assign({role:'front', reach:'front', cost:1}, o); }

/* =========================================================
   カードアート(viewBox 0 0 100 50 / 絵文字は一切使わない)

   26枚を1枚ずつベタ書きすると保守できないので、丸い体・顔・足と
   いった部品を関数にして組み合わせる。座標は translate(50 27) を
   掛けたあとのローカル座標(x は概ね -48..48、y は -27..23)。
   ========================================================= */
const A = {
  bg: id => `<rect width="100" height="50" fill="url(#bg-${id})"/>`,

  /* 目(白いハイライト付き) */
  eyes: (y, sp, r) =>
    `<ellipse cx="${-sp}" cy="${y}" rx="${r}" ry="${r * 1.18}" fill="#1a1a1a"/>` +
    `<ellipse cx="${sp}" cy="${y}" rx="${r}" ry="${r * 1.18}" fill="#1a1a1a"/>` +
    `<circle cx="${-sp - r * .3}" cy="${y - r * .5}" r="${r * .36}" fill="#fff"/>` +
    `<circle cx="${sp - r * .3}" cy="${y - r * .5}" r="${r * .36}" fill="#fff"/>`,

  /* 半月の笑い口 */
  smile: (y, w) =>
    `<path d="M${-w} ${y}q${w} ${w * .8} ${w * 2} 0" fill="none" stroke="#1a1a1a" stroke-width="1.9" stroke-linecap="round"/>`,

  /* 頬 */
  blush: (y, x, c) =>
    `<ellipse cx="${-x}" cy="${y}" rx="3.1" ry="1.9" fill="${c}" opacity=".7"/>` +
    `<ellipse cx="${x}" cy="${y}" rx="3.1" ry="1.9" fill="${c}" opacity=".7"/>`,

  /* 足 */
  feet: (fill, line, y, x) =>
    `<ellipse cx="${-x}" cy="${y}" rx="5.4" ry="3.2" fill="${fill}" stroke="${line}" stroke-width="1.9"/>` +
    `<ellipse cx="${x}" cy="${y}" rx="5.4" ry="3.2" fill="${fill}" stroke="${line}" stroke-width="1.9"/>`,

  /* 短い手 */
  arms: (fill, line, y, x) =>
    `<ellipse cx="${-x}" cy="${y}" rx="4.2" ry="3.2" fill="${fill}" stroke="${line}" stroke-width="1.8"/>` +
    `<ellipse cx="${x}" cy="${y}" rx="4.2" ry="3.2" fill="${fill}" stroke="${line}" stroke-width="1.8"/>`,

  /* ねこ耳 */
  catEars: (fill, line, y, x) =>
    `<path d="M${-x - 5} ${y + 4}L${-x - 1} ${y - 6} ${-x + 5} ${y + 2}z" fill="${fill}" stroke="${line}" stroke-width="1.9" stroke-linejoin="round"/>` +
    `<path d="M${x - 5} ${y + 2}L${x + 1} ${y - 6} ${x + 5} ${y + 4}z" fill="${fill}" stroke="${line}" stroke-width="1.9" stroke-linejoin="round"/>`,

  /* ひげ */
  whiskers: y =>
    `<g stroke="#1a1a1a" stroke-width="1.1" stroke-linecap="round" opacity=".8">` +
    `<path d="M-9 ${y}h-8M-9 ${y + 3}l-7 2M9 ${y}h8M9 ${y + 3}l7 2"/></g>`,

  /* 炎 */
  flame: (x, y, sc, c1, c2) =>
    `<g transform="translate(${x} ${y}) scale(${sc})">` +
    `<path d="M0 0c3-6-3-8-1-14 4 3 3 6 6 8 2-2 1-4 1-6 4 4 6 8 6 12a6 6 0 0 1-12 0z" fill="${c1}" stroke="${c2}" stroke-width="1.6"/></g>`,

  /* 稲妻 */
  bolt: (x, y, sc) =>
    `<g transform="translate(${x} ${y}) scale(${sc})">` +
    `<path d="M2 -11-6 1h4.6l-2 9 8-12H2z" fill="#ffe14d" stroke="#8a6a10" stroke-width="1.5" stroke-linejoin="round"/></g>`,

  /* 湯気 */
  steam: (x, y, sc) =>
    `<g transform="translate(${x} ${y}) scale(${sc})" stroke="#f0f4f6" stroke-width="2.2" fill="none" opacity=".85" stroke-linecap="round">` +
    `<path d="M-6 0q4-5 0-9M0 2q4-5 0-10M6 0q4-5 0-9"/></g>`,

  /* 泡 */
  bubbles: (x, y, c) =>
    `<g fill="${c}" stroke="#3b2a52" stroke-width="1" opacity=".9">` +
    `<circle cx="${x - 6}" cy="${y + 3}" r="3"/><circle cx="${x + 1}" cy="${y - 3}" r="2.2"/>` +
    `<circle cx="${x + 7}" cy="${y + 2}" r="2.6"/></g>`
};

/* まるい体のキャラを1発で組み立てる(カービィ系・ねこ系の土台) */
function puff(bgId, body, line, opt){
  const o = opt || {};
  const r = o.r || 14;
  return A.bg(bgId) + (o.back || '') + `<g transform="translate(50 26)">`
    + A.feet(o.foot || body, line, r * .95, r * .6)
    + A.arms(body, line, 1, r + 1.5)
    + `<circle cx="0" cy="0" r="${r}" fill="${body}" stroke="${line}" stroke-width="2.4"/>`
    + (o.skin || '')
    + A.blush(3, r * .62, o.blushColor || '#f6a8c0')
    + A.eyes(-3.5, 4.4, 2.5)
    + A.smile(4.2, 3.2)
    + (o.front || '')
    + `</g>`;
}

/* きのこ体(さいきの族の土台) */
function shroom(bgId, cap, capLine, spots){
  return A.bg(bgId) + `<g transform="translate(50 28)">`
    + `<path d="M-8.5 -2q-2.5 10-1.5 13h20q1-3-1.5-13z" fill="#f4ecd8" stroke="#8a7550" stroke-width="2"/>`
    + `<path d="M-21 -2q0-17 21-17t21 17z" fill="${cap}" stroke="${capLine}" stroke-width="2.4"/>`
    + (spots || '')
    + A.eyes(4.5, 4.2, 2.3)
    + A.smile(10, 3)
    + `</g>`;
}

const ART = {
/* ---------------- さいきの族 ---------------- */
sfire: shroom('fire', '#e2582f', '#8c2a12',
  `<g fill="#ffd28a" stroke="#8c2a12" stroke-width=".9"><circle cx="-11" cy="-8" r="3.2"/><circle cx="2" cy="-11" r="2.4"/><circle cx="12" cy="-6" r="2.7"/></g>`
  + A.flame(-1, -27, .8, '#ffb24d', '#b8501a')),

sice: shroom('ice', '#3d9ed4', '#1d5b83',
  `<g fill="#eaf7ff" stroke="#1d5b83" stroke-width=".9"><circle cx="-11" cy="-8" r="3.2"/><circle cx="2" cy="-11" r="2.4"/><circle cx="12" cy="-6" r="2.7"/></g>`
  + `<g stroke="#eaf7ff" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".9"><path d="M-26 -14v6M-29 -11h6M27 -6v6M24 -3h6"/></g>`),

sbolt: shroom('bolt', '#e8c22c', '#7d6208',
  `<g fill="#fff6c8" stroke="#7d6208" stroke-width=".9"><circle cx="-11" cy="-8" r="3.2"/><circle cx="2" cy="-11" r="2.4"/><circle cx="12" cy="-6" r="2.7"/></g>`
  + A.bolt(0, -24, .85)),

spoison: shroom('poison', '#7b40b5', '#42206a',
  `<g fill="#e9d8ff" stroke="#42206a" stroke-width=".9"><circle cx="-11" cy="-8" r="3.2"/><circle cx="2" cy="-11" r="2.4"/><circle cx="12" cy="-6" r="2.7"/></g>`
  + A.bubbles(0, -25, '#b7f24d')),

splain: shroom('none', '#8e9a94', '#3f4a45',
  `<g fill="#eef2f0" stroke="#3f4a45" stroke-width=".9"><circle cx="-11" cy="-8" r="3.2"/><circle cx="2" cy="-11" r="2.4"/><circle cx="12" cy="-6" r="2.7"/></g>`),

/* ---------------- カービィ系(まるい体) ---------------- */
kfire: puff('fire', '#f2a0bd', '#a3465f', {front: A.flame(-1, -23, .95, '#ffb24d', '#b8501a')}),

kice: puff('ice', '#bfe6f7', '#2f7fae', {
  front: `<path d="M-9 -13-1 -24 8 -13z" fill="#eaf7ff" stroke="#2f7fae" stroke-width="1.9" stroke-linejoin="round"/>`
       + `<g stroke="#eaf7ff" stroke-width="1.5" stroke-linecap="round" opacity=".9"><path d="M-24 -8v5M-26.5 -5.5h5M25 4v5M22.5 6.5h5"/></g>`}),

kspark: puff('bolt', '#f7dd6a', '#8a6a10', {
  front: A.bolt(0, -21, 1)
       + `<g stroke="#fff6c8" stroke-width="1.6" fill="none" opacity=".85"><path d="M-17-11q-4 4-1 8M17-11q4 4 1 8"/></g>`}),

kpoison: puff('poison', '#a877d8', '#4a2270', {
  blushColor: '#c9f26a',
  front: A.bubbles(0, -22, '#b7f24d')}),

kstone: puff('none', '#9b968c', '#4c4842', {
  r: 15, blushColor: '#c7bfae',
  skin: `<g stroke="#4c4842" stroke-width="1.5" fill="none" opacity=".65"><path d="M-13 -5 -6 -8 -3 -2M6 -10l4 5 6-2M-4 8l5-4 5 5"/></g>`}),

carkirby: puff('bolt', '#f2a0bd', '#a3465f', {
  r: 12,
  front: `<path d="M-13 -12q13-8 26 0" fill="none" stroke="#8ec9e8" stroke-width="3.2" stroke-linecap="round"/>`,
  back: `<g transform="translate(50 26)"><circle cx="-11" cy="14" r="5.4" fill="#3a3a3a" stroke="#161616" stroke-width="2"/><circle cx="11" cy="14" r="5.4" fill="#3a3a3a" stroke="#161616" stroke-width="2"/><circle cx="-11" cy="14" r="1.8" fill="#cfcfcf"/><circle cx="11" cy="14" r="1.8" fill="#cfcfcf"/><rect x="-17" y="7" width="34" height="6" rx="2.5" fill="#c9556f" stroke="#7d2b3d" stroke-width="1.8"/></g>`}),

/* ---------------- ねこ系 ---------------- */
happycat: puff('ice', '#fbf3e4', '#8a7550', {
  r: 13, foot: '#fbf3e4',
  front: A.catEars('#fbf3e4', '#8a7550', -12, 8) + A.whiskers(1)
       + `<circle cx="14" cy="-9" r="4.6" fill="#f2cf5c" stroke="#8a6a10" stroke-width="1.6"/>`
       + `<path d="M14 -11v4M12.4 -9h3.2" stroke="#8a6a10" stroke-width="1.1"/>`}),

sniper: puff('ice', '#8fa3b8', '#3c4d5e', {
  r: 12, blushColor: '#b9c9d8',
  front: A.catEars('#8fa3b8', '#3c4d5e', -11, 7.5) + A.whiskers(1),
  back: `<g transform="translate(50 26)"><rect x="8" y="-3" width="30" height="4.6" rx="1.8" fill="#4a4a4a" stroke="#1e1e1e" stroke-width="1.6"/>`
      + `<circle cx="32" cy="-9" r="6.4" fill="none" stroke="#c0392b" stroke-width="1.8"/>`
      + `<path d="M32 -16v14M25 -9h14" stroke="#c0392b" stroke-width="1.4"/></g>`}),

spidercat: puff('poison', '#5b4a75', '#2b2140', {
  r: 12, blushColor: '#9a7fc4',
  front: A.catEars('#5b4a75', '#2b2140', -11, 7.5) + A.whiskers(1),
  back: `<g transform="translate(50 26)" stroke="#2b2140" stroke-width="2" fill="none" stroke-linecap="round">`
      + `<path d="M-11 2-24 -6-27 -12M-11 6-25 6-29 2M11 2 24 -6 27 -12M11 6 25 6 29 2"/></g>`
      + `<g stroke="#cbb9e8" stroke-width="1" fill="none" opacity=".55"><path d="M0 0 100 0M0 8q22 8 44 0M0 16q22 8 44 0" transform="translate(0 2)"/></g>`}),

nyancat: puff('bolt', '#9fb6c9', '#3f5164', {
  r: 10, foot: '#9fb6c9',
  back: `<g opacity=".95"><rect x="0" y="16" width="34" height="4" fill="#e0403c"/><rect x="0" y="20" width="34" height="4" fill="#ef8b3c"/>`
      + `<rect x="0" y="24" width="34" height="4" fill="#f2d24a"/><rect x="0" y="28" width="34" height="4" fill="#5aab54"/>`
      + `<rect x="0" y="32" width="34" height="4" fill="#3f7fc2"/><rect x="0" y="36" width="34" height="4" fill="#8b4fc0"/></g>`,
  skin: `<rect x="-15" y="-7" width="30" height="15" rx="2.5" fill="#f2c9a0" stroke="#a8763c" stroke-width="2"/>`
      + `<rect x="-11" y="-4" width="22" height="9" rx="2" fill="#f28fb0"/>`
      + `<g fill="#e0403c"><circle cx="-6" cy="-1" r="1.1"/><circle cx="1" cy="2" r="1.1"/><circle cx="7" cy="-1" r="1.1"/></g>`,
  front: A.catEars('#9fb6c9', '#3f5164', -11, 6.5) + A.whiskers(1)}),

/* ---------------- 単発もの ---------------- */
waddle: puff('none', '#e08a3c', '#8a4a12', {
  r: 13, blushColor: '#f7b98a',
  front: `<rect x="-15" y="-11" width="30" height="4.6" rx="2" fill="#3f7fc2" stroke="#1e4a76" stroke-width="1.6"/>`,
  back: `<g transform="translate(50 26)"><rect x="20" y="-19" width="3" height="34" rx="1.4" fill="#a8763c" stroke="#5c3f1a" stroke-width="1.5"/>`
      + `<path d="M21.5 -25 27 -17h-11z" fill="#cfd6da" stroke="#5c6870" stroke-width="1.5" stroke-linejoin="round"/></g>`}),

shacho: puff('none', '#efd7b8', '#8a6a48', {
  r: 13,
  skin: `<path d="M-13 -8q4-7 13-7t13 7q-6-3-13-3t-13 3z" fill="#4a4a4a" stroke="#1e1e1e" stroke-width="1.6"/>`,
  front: `<g fill="none" stroke="#2b2b2b" stroke-width="1.7"><circle cx="-4.4" cy="-3.5" r="4"/><circle cx="4.4" cy="-3.5" r="4"/><path d="M-.4 -3.5h.8"/></g>`
       + `<path d="M0 9 -3.4 12.5 0 22 3.4 12.5z" fill="#c0392b" stroke="#7a1f16" stroke-width="1.6" stroke-linejoin="round"/>`}),

shadow: puff('bolt', '#2e2e38', '#0d0d12', {
  r: 13, foot: '#c0392b', blushColor: '#5a2a2a',
  skin: `<path d="M-14 -6-24 -14-11 -12zM14 -6 24 -14 11 -12zM0 -14-3 -25 4 -13z" fill="#2e2e38" stroke="#0d0d12" stroke-width="1.8" stroke-linejoin="round"/>`
      + `<path d="M-11 -9q5-3 11-3t11 3" fill="none" stroke="#c0392b" stroke-width="2" stroke-linecap="round"/>`,
  front: `<ellipse cx="-4.4" cy="-3.5" rx="2.6" ry="3" fill="#e04a3c"/><ellipse cx="4.4" cy="-3.5" rx="2.6" ry="3" fill="#e04a3c"/>`
       + `<circle cx="-5" cy="-4.6" r=".9" fill="#fff"/><circle cx="3.8" cy="-4.6" r=".9" fill="#fff"/>`}),

ishi: A.bg('none') + `<g transform="translate(50 29)">
<path d="M-24 12q-4-11 3-18t15-6 16 6 4 18q-9 4-19 4t-19-4z" fill="#9b968c" stroke="#4c4842" stroke-width="2.4"/>
<g stroke="#4c4842" stroke-width="1.5" fill="none" opacity=".6"><path d="M-16 -4 -8 -9 -3 -2M4 -12l5 6 8-3M-10 8l6-5 6 6"/></g>
<circle cx="-5" cy="1" r="1.8" fill="#1a1a1a"/><circle cx="5" cy="1" r="1.8" fill="#1a1a1a"/>
<path d="M-3 7h6" stroke="#1a1a1a" stroke-width="1.7" stroke-linecap="round"/></g>`,

cannon: A.bg('fire') + `<g transform="translate(50 27)">
<circle cx="-14" cy="12" r="6" fill="#3a3a3a" stroke="#161616" stroke-width="2"/>
<circle cx="12" cy="13" r="4.6" fill="#3a3a3a" stroke="#161616" stroke-width="2"/>
<path d="M-20 8h34l6-6V-9l-8-4H-18q-5 0-5 5v11q0 5 3 5z" fill="#5c6870" stroke="#232b30" stroke-width="2.3"/>
<rect x="18" y="-14" width="12" height="16" rx="3" fill="#7d8b94" stroke="#232b30" stroke-width="2"/>
<circle cx="-8" cy="-4" r="2.6" fill="#1a1a1a"/><circle cx="2" cy="-4" r="2.6" fill="#1a1a1a"/>
<circle cx="-8.8" cy="-5" r="1" fill="#fff"/><circle cx="1.2" cy="-5" r="1" fill="#fff"/>
<path d="M-6 2q4 3 8 0" fill="none" stroke="#1a1a1a" stroke-width="1.9" stroke-linecap="round"/>` + A.flame(-34, -12, .6, '#ffb24d', '#b8501a') + `</g>`,

creeper: A.bg('fire') + `<g transform="translate(50 27)">
<rect x="-15" y="-17" width="30" height="30" rx="1.5" fill="#5aab54" stroke="#2c5c28" stroke-width="2.3"/>
<g fill="#43873f" opacity=".8"><rect x="-15" y="-17" width="7" height="7"/><rect x="8" y="-3" width="7" height="7"/><rect x="-4" y="6" width="7" height="7"/></g>
<g fill="#1a1a1a"><rect x="-11" y="-11" width="7.5" height="7.5"/><rect x="3.5" y="-11" width="7.5" height="7.5"/>
<rect x="-3.8" y="-3.5" width="7.6" height="7"/><rect x="-8" y="1" width="4.2" height="9"/><rect x="3.8" y="1" width="4.2" height="9"/></g>` 
+ A.flame(-24, -6, .45, '#ffb24d', '#b8501a') + A.flame(24, -6, .45, '#ffb24d', '#b8501a') + `</g>`,

enderman: A.bg('poison') + `<g transform="translate(50 26)">
<rect x="-4" y="-20" width="8" height="38" rx="1" fill="#1a1a22" stroke="#000" stroke-width="1.6"/>
<rect x="-11" y="-24" width="22" height="13" rx="1.5" fill="#1a1a22" stroke="#000" stroke-width="1.8"/>
<g stroke="#1a1a22" stroke-width="3.4" stroke-linecap="round"><path d="M-4 -10-14 4-15 17M4 -10 14 4 15 17"/></g>
<rect x="-8" y="-20" width="6" height="4" rx="1" fill="#d4b8ff"/><rect x="2" y="-20" width="6" height="4" rx="1" fill="#d4b8ff"/>
<g fill="#c49af0" opacity=".85"><rect x="-24" y="-14" width="3" height="3"/><rect x="20" y="-6" width="3" height="3"/><rect x="-19" y="6" width="2.4" height="2.4"/><rect x="25" y="9" width="2.4" height="2.4"/></g></g>`,

ikaku: A.bg('poison') + `<g transform="translate(50 25)">
<path d="M-16 2q0-18 16-18t16 18q-7 4-16 4t-16-4z" fill="#c96a9a" stroke="#6e2a4c" stroke-width="2.3"/>
<path d="M-17 -6-28 -16 -14 -12zM17 -6 28 -16 14 -12z" fill="#c96a9a" stroke="#6e2a4c" stroke-width="1.9" stroke-linejoin="round"/>
<g stroke="#c96a9a" stroke-width="3.2" fill="none" stroke-linecap="round"><path d="M-11 6q-3 9-8 12M-4 7q-1 10-3 13M4 7q1 10 3 13M11 6q3 9 8 12"/></g>
<circle cx="-6" cy="-3" r="2.8" fill="#1a1a1a"/><circle cx="6" cy="-3" r="2.8" fill="#1a1a1a"/>
<circle cx="-7" cy="-4.2" r="1" fill="#fff"/><circle cx="5" cy="-4.2" r="1" fill="#fff"/>
<path d="M-4 3q4-3 8 0" fill="none" stroke="#1a1a1a" stroke-width="1.9" stroke-linecap="round"/>
<g fill="#2b2140" opacity=".45"><circle cx="-27" cy="12" r="6"/><circle cx="-20" cy="17" r="4"/></g></g>`,

jiro: A.bg('none') + `<g transform="translate(50 28)">` + A.steam(0, -22, 1.15) + `
<path d="M-20 -8q6-12 20-12t20 12q-9 4-20 4t-20-4z" fill="#5aab54" stroke="#2c5c28" stroke-width="2"/>
<g fill="#f2c9a0" stroke="#a8763c" stroke-width="1.4"><rect x="-16" y="-12" width="13" height="7" rx="2"/><rect x="3" y="-14" width="13" height="7" rx="2"/></g>
<path d="M-26 -6h52q-4 20-26 20T-26 -6z" fill="#f4ecd8" stroke="#8a7550" stroke-width="2.4"/>
<path d="M-22 -3h44" stroke="#c9b98e" stroke-width="1.8"/>
<circle cx="-6" cy="3" r="2.4" fill="#1a1a1a"/><circle cx="6" cy="3" r="2.4" fill="#1a1a1a"/>
<path d="M-4.5 8q4.5 3.5 9 0" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round"/></g>`,

gekikara: A.bg('fire') + `<g transform="translate(50 28)">` + A.flame(0, -20, .75, '#ffb24d', '#b8501a') + `
<path d="M-25 -6h50q-4 20-25 20T-25 -6z" fill="#c0392b" stroke="#6e1f16" stroke-width="2.4"/>
<path d="M-21 -3h42" stroke="#e8837a" stroke-width="1.8"/>
<path d="M-19 -8q7-4 12 0t14 0 12 0" fill="none" stroke="#f2d24a" stroke-width="2.4" stroke-linecap="round"/>
<path d="M-14 -12q-2-5 1-7 3 3 2 7z" fill="#e0403c" stroke="#7a1f16" stroke-width="1.3"/>
<path d="M13 -12q2-5-1-7-3 3-2 7z" fill="#e0403c" stroke="#7a1f16" stroke-width="1.3"/>
<circle cx="-6" cy="3" r="2.4" fill="#1a1a1a"/><circle cx="6" cy="3" r="2.4" fill="#1a1a1a"/>
<path d="M-5 8q5 4 10 0" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round"/></g>`,

onsen: A.bg('ice') + `<g transform="translate(50 28)">` + A.steam(-14, -18, 1) + A.steam(14, -18, 1) + `
<path d="M-27 -4h54q-3 18-27 18T-27 -4z" fill="#7d6a4a" stroke="#3f3320" stroke-width="2.4"/>
<ellipse cx="0" cy="-4" rx="27" ry="7" fill="#9fd8ea" stroke="#3f3320" stroke-width="2"/>
<g stroke="#eaf7ff" stroke-width="1.6" fill="none" opacity=".9"><path d="M-16 -4q5-3 10 0t10 0"/></g>
<path d="M-11 -12q0-9 11-9t11 9q-5 3-11 3t-11-3z" fill="#f4ecd8" stroke="#8a7550" stroke-width="2"/>
<path d="M-8 -8q8 5 16 0" fill="none" stroke="#cfc3a4" stroke-width="1.8"/>
<circle cx="-4.4" cy="-15" r="2.1" fill="#1a1a1a"/><circle cx="4.4" cy="-15" r="2.1" fill="#1a1a1a"/>
<path d="M-3 -10q3 2.4 6 0" fill="none" stroke="#1a1a1a" stroke-width="1.7" stroke-linecap="round"/></g>`
};

/* =========================================================
   カードDB(全26枚 / すべて N)
   ── 設計方針 ──
   ・レアリティで素の数値は吊り上げない。HPと威力は
     「硬い＝低火力 / 脆い＝高火力」のトレードで散らす
   ・skills[0] は必ず前衛スキル(Lv1で唯一使える枠のため)
   ・skills は原則3つ。王スキルと合わせて計4つがLvで解放される
     (「そこら辺の石」だけは意図的に1つ。空き枠は空欄で描かれる)
   ・状態異常つきスキルの数値は STATUS_SPEC の価値表から逆算:
     威力 + 付与率 × 実効価値 ≒ 同SPの単純攻撃(SP1で17 / SP2で28)
   ========================================================= */
const CARD_DB = {
  /* ================= 炎 ================= */
  sfire:{name:'炎のさいきの', elem:'炎', rarity:'N', hp:52,
    skills:[ F({name:'火の粉', power:17}),
             F({name:'焦がす息', power:13, status:{type:'burn', chance:.55}}),
             B({name:'熾火の手当て', power:0, friendly:true, heal:16}) ],
    king:{name:'燃え残り', desc:'味方が倒れる毎に攻+10%', trigger:'rage', value:.10}},

  kfire:{name:'ファイアカービィ', elem:'炎', rarity:'N', hp:53,
    skills:[ F({name:'ファイアブレス', power:18}),
             F({name:'燃えあがる突進', power:13, status:{type:'burn', chance:.55}}),
             B({name:'あったか応援', power:0, friendly:true, buffAll:{amount:.28, turns:2}}) ],
    king:{name:'消えない火種', desc:'味方が倒れる毎に攻+11%', trigger:'rage', value:.11}},

  gekikara:{name:'激辛ラーメン', elem:'炎', rarity:'N', hp:45,
    skills:[ F({name:'灼熱すすり', power:16}),
             F({name:'唐辛子の追い打ち', power:13, status:{type:'burn', chance:.5}}),
             B({cost:2, name:'汗だくの気合', power:0, friendly:true, healAll:9}) ],
    king:{name:'辛味の追撃', desc:'状態異常の敵に+5', trigger:'statusBonus', value:5}},

  cannon:{name:'私は大砲', elem:'炎', rarity:'N', hp:44,
    skills:[ F({name:'空砲おどし', power:17}),
             F({cost:2, name:'超遠距離砲', reach:'any', power:26}),
             B({name:'装填の合図', power:10, drainSP:1}) ],
    king:{name:'砲身加熱', desc:'SP3以上で与ダメ+18%', trigger:'spMax', need:3, value:.18}},

  creeper:{name:'クリーパー', elem:'炎', rarity:'N', hp:50,
    skills:[ F({name:'にじり寄り', power:17}),
             F({cost:2, name:'自爆', power:17, allEnemies:true}),
             B({name:'導火線の音', power:0, debuffAll:{amount:.28, turns:2}}) ],
    king:{name:'置き土産', desc:'味方が倒れる毎に攻+14%', trigger:'rage', value:.14}},

  /* ================= 氷 ================= */
  sice:{name:'氷のさいきの', elem:'氷', rarity:'N', hp:56,
    skills:[ F({name:'氷のひとつき', power:16}),
             F({name:'こごえる霧', power:12, status:{type:'freeze', chance:.5}}),
             B({name:'静かな治癒', power:0, friendly:true, cleanse:true, heal:15}) ],
    king:{name:'凍てつく守り', desc:'前衛2枚生存で被ダメ-12%', trigger:'frontGuard', value:.12}},

  kice:{name:'アイスカービィ', elem:'氷', rarity:'N', hp:52,
    skills:[ F({name:'こおりのいぶき', power:18}),
             F({name:'つめたい抱きつき', power:12, status:{type:'freeze', chance:.5}}),
             B({name:'冷ややかな視線', power:0, debuffAtk:{amount:.38, turns:2}}) ],
    king:{name:'氷の壁', desc:'前衛2枚生存で被ダメ-13%', trigger:'frontGuard', value:.13}},

  onsen:{name:'温泉の神', elem:'氷', rarity:'N', hp:48,
    skills:[ F({name:'湯けむり払い', power:15}),
             B({name:'源泉かけ流し', power:0, friendly:true, healAll:8, cleanse:true}),
             B({cost:2, name:'ぬくもりの祝福', power:0, friendly:true, heal:17}) ],
    king:{name:'湯治', desc:'ターン開始時に王HP+5', trigger:'turnHeal', value:5}},

  happycat:{name:'はっぴーねこ', elem:'氷', rarity:'N', hp:52,
    skills:[ F({name:'まねき猫パンチ', power:17}),
             B({name:'福を分ける', power:0, friendly:true, heal:22}),
             B({name:'招き猫ビーム', power:14}) ],
    king:{name:'大入り満員', desc:'5枚全員生存で全体+16%', trigger:'fullBoard', value:.16}},

  sniper:{name:'すにゃいぱー', elem:'氷', rarity:'N', hp:50,
    skills:[ F({name:'近接けりゃく', power:17}),
             F({name:'狙撃', reach:'any', power:15}),
             F({cost:2, name:'必中ヘッドショット', reach:'any', power:26}) ],
    king:{name:'一点集中', desc:'SP3以上で与ダメ+16%', trigger:'spMax', need:3, value:.16}},

  /* ================= 毒 ================= */
  spoison:{name:'毒のさいきの', elem:'毒', rarity:'N', hp:55,
    skills:[ F({name:'胞子突き', power:17}),
             F({name:'毒の胞子', power:14, status:{type:'poison', chance:.6}}),
             B({name:'腐食の霧', power:0, debuffAll:{amount:.28, turns:2}}) ],
    king:{name:'蝕み', desc:'状態異常の敵に+4', trigger:'statusBonus', value:4}},

  kpoison:{name:'ポイズンカービィ', elem:'毒', rarity:'N', hp:50,
    skills:[ F({name:'毒液スピット', power:17}),
             F({name:'とけこむ体液', power:13, status:{type:'poison', chance:.6}}),
             B({name:'解毒とお守り', power:0, friendly:true, cleanse:true, buffTarget:{amount:.15, turns:2}}) ],
    king:{name:'毒の相乗', desc:'味方が状態異常付与で追加5', trigger:'onStatusInflict', value:5}},

  enderman:{name:'エンダーマン', elem:'毒', rarity:'N', hp:46,
    skills:[ F({name:'目が合った', power:17}),
             F({cost:2, name:'瞬間移動', power:24, swapEnemy:true}),
             B({name:'空間のきしみ', power:10, drainSP:1}) ],
    king:{name:'次元のゆらぎ', desc:'ターン毎に攻+7% 最大35%', trigger:'rampUp', value:.07, max:.35}},

  spidercat:{name:'すぱいだーにゃん', elem:'毒', rarity:'N', hp:54,
    skills:[ F({name:'八本足キック', power:18}),
             F({name:'しびれ糸', power:13, status:{type:'paralyze', chance:.55}}),
             B({name:'巣を張る', power:0, debuffAll:{amount:.30, turns:2}}) ],
    king:{name:'糸の網', desc:'状態異常の敵に+5', trigger:'statusBonus', value:5}},

  ikaku:{name:'イカク', elem:'毒', rarity:'N', hp:52,
    skills:[ F({name:'触腕なぐり', power:18}),
             B({name:'威嚇のにらみ', power:0, debuffAtk:{amount:.38, turns:2}}),
             F({name:'墨のカーテン', power:12, status:{type:'poison', chance:.55}}) ],
    king:{name:'深海の圧', desc:'前衛2枚生存で被ダメ-12%', trigger:'frontGuard', value:.12}},

  /* ================= 雷 ================= */
  sbolt:{name:'雷のさいきの', elem:'雷', rarity:'N', hp:46,
    skills:[ F({name:'帯電突進', power:16}),
             B({name:'雷気供給', power:0, friendly:true, gainSP:2, selfDamage:14, oncePerTurn:true}),
             F({name:'しびれ放電', power:11, status:{type:'paralyze', chance:.45}}) ],
    king:{name:'高電圧', desc:'SP3以上で与ダメ+15%', trigger:'spMax', need:3, value:.15}},

  kspark:{name:'スパークカービィ', elem:'雷', rarity:'N', hp:45,
    skills:[ F({name:'スパークタックル', power:16}),
             F({name:'痺れる放電', power:11, status:{type:'paralyze', chance:.45}}),
             B({name:'電力チャージ', power:0, friendly:true, gainSP:2, selfDamage:14, oncePerTurn:true}) ],
    king:{name:'感電の連鎖', desc:'味方が状態異常付与で追加5', trigger:'onStatusInflict', value:5}},

  nyancat:{name:'NYANCAT', elem:'雷', rarity:'N', hp:40,
    skills:[ F({name:'虹の尾ビンタ', power:16}),
             B({name:'にゃんこチャージ', power:0, friendly:true, gainSP:2, selfDamage:14, oncePerTurn:true}),
             F({cost:2, name:'レインボーダッシュ', power:23}) ],
    king:{name:'無限ループ', desc:'5枚全員生存で全体+14%', trigger:'fullBoard', value:.14}},

  carkirby:{name:'車カービィ', elem:'雷', rarity:'N', hp:50,
    skills:[ F({name:'体当たり走行', power:18}),
             F({cost:2, name:'フルスロットル', power:30}),
             B({name:'ピットイン', power:0, friendly:true, friendlyFreeMove:true, heal:15}) ],
    king:{name:'アイドリング', desc:'ターン開始時に王HP+4', trigger:'turnHeal', value:4}},

  shadow:{name:'シャドウ', elem:'雷', rarity:'N', hp:44,
    skills:[ F({name:'カオススラッシュ', power:18}),
             F({name:'漆黒のしびれ', power:12, status:{type:'paralyze', chance:.5}}),
             B({name:'エネルギー吸収', power:0, drainSP:1, gainSP:1, selfDamage:9, oncePerTurn:true}) ],
    king:{name:'孤高', desc:'王だけになると全能力+40%', trigger:'lastStand', value:.40}},

  /* ================= 無 ================= */
  splain:{name:'無のさいきの', elem:'無', rarity:'N', hp:55,
    skills:[ F({name:'ぶちかまし', power:17}),
             B({name:'隊列の整え', power:0, friendly:true, healAll:8}),
             F({cost:2, name:'渾身のぶちかまし', power:28}) ],
    king:{name:'素の力', desc:'ターン毎に攻+6% 最大30%', trigger:'rampUp', value:.06, max:.30}},

  kstone:{name:'ストーンカービィ', elem:'無', rarity:'N', hp:60,
    skills:[ F({name:'のしかかり', power:17}),
             F({cost:2, name:'ストーンプレス', power:27}),
             B({name:'岩陰で休む', power:0, friendly:true, heal:16}) ],
    king:{name:'不動', desc:'前衛2枚生存で被ダメ-14%', trigger:'frontGuard', value:.14}},

  jiro:{name:'二郎系ラーメン', elem:'無', rarity:'N', hp:52,
    skills:[ F({name:'ヤサイマシマシ', power:15}),
             B({name:'全マシコール', power:0, friendly:true, healAll:8}),
             F({cost:2, name:'ロット崩し', power:27}) ],
    king:{name:'胃もたれ', desc:'後衛2枚生存で毎T 王HP+5', trigger:'backHeal', value:5}},

  waddle:{name:'ワドルディ', elem:'無', rarity:'N', hp:54,
    skills:[ F({name:'やりで突く', power:17}),
             B({name:'みんなで応援', power:0, friendly:true, buffAll:{amount:.28, turns:2}}),
             F({cost:2, name:'とっしんアタック', power:28}) ],
    king:{name:'いつでも一緒', desc:'5枚全員生存で全体+17%', trigger:'fullBoard', value:.17}},

  shacho:{name:'社長', elem:'無', rarity:'N', hp:60,
    skills:[ F({name:'決裁のハンコ', power:17}),
             B({name:'鼓舞する訓示', power:0, friendly:true, buffAll:{amount:.30, turns:2}}),
             B({name:'叱責', power:15, debuffAtk:{amount:.25, turns:2}}) ],
    king:{name:'現場の底力', desc:'味方が倒れる毎に攻+13%', trigger:'rage', value:.13}},

  /* スキルが1つしかない異端カード。空いた2枠は空欄で描かれる */
  ishi:{name:'そこら辺の石', elem:'無', rarity:'N', hp:62,
    skills:[ F({name:'ころがる', power:18}) ],
    king:{name:'ただの石', desc:'前衛2枚生存で被ダメ-15%', trigger:'frontGuard', value:.15}}
};

const CARD_IDS = Object.keys(CARD_DB);
