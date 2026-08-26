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

const STATUS_LABEL = {burn:'やけど', poison:'毒', freeze:'凍結', paralyze:'麻痺', stun:'スタン', seal:'封印'};

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
   ========================================================= */
const ART = {
ramen:`<rect width="100" height="50" fill="url(#bg-fire)"/>
<g stroke="#e6a99c" stroke-width="2" opacity=".45" fill="none"><path d="M8 40q6-9 12 0M80 40q6-9 12 0"/></g>
<g transform="translate(50 28)">
<g stroke="#f2c9a0" stroke-width="2.1" opacity=".85" fill="none" stroke-linecap="round">
<path d="M-11 -14q4-6 0-11M0 -16q4-6 0-11M11 -14q4-6 0-11"/></g>
<path d="M-21 -4H21q0 15-21 15T-21 -4z" fill="#c94a30" stroke="#7d2415" stroke-width="2.2"/>
<path d="M-21 -4H21" stroke="#7d2415" stroke-width="2.2"/>
<path d="M-17 -6q6-4 12 0t12 0" fill="none" stroke="#f5deb0" stroke-width="2.4" stroke-linecap="round"/>
<circle cx="-9" cy="-8.5" r="3.4" fill="#f7f0e0" stroke="#8a6a3a" stroke-width="1.3"/>
<circle cx="-9" cy="-8.5" r="1.4" fill="#e0a03c"/>
<rect x="4" y="-12" width="8" height="6" rx="1" fill="#3f7a3f" stroke="#255025" stroke-width="1.2"/>
<circle cx="-5" cy="3" r="2.3" fill="#1a1a1a"/><circle cx="5" cy="3" r="2.3" fill="#1a1a1a"/>
<circle cx="-5.7" cy="2.2" r=".8" fill="#fff"/><circle cx="4.3" cy="2.2" r=".8" fill="#fff"/>
<path d="M-4 8q4 3 8 0" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round"/></g>`,

chili:`<rect width="100" height="50" fill="url(#bg-fire)"/>
<g stroke="#e6a99c" stroke-width="2.2" opacity=".4" fill="none"><path d="M6 8 15 17M94 8 85 17"/></g>
<g transform="translate(50 28)">
<path d="M-4 -17q3-7 0-10 5 3 4 10z" fill="#ff9a3c" stroke="#b8501a" stroke-width="1.5"/>
<path d="M6 -16q2-5 0-8 4 3 3 8z" fill="#ffc24d" stroke="#b8501a" stroke-width="1.4"/>
<path d="M-24 2q0-8 24-8t24 8-24 9-24-9z" fill="#e8b96a" stroke="#8a6224" stroke-width="2.2"/>
<path d="M-19 0q0-4 19-4t19 4-19 5-19-5z" fill="#b8543a" stroke="#6e2a18" stroke-width="1.9"/>
<path d="M-16 -1q5 3 8-1t8 1 8-1" fill="none" stroke="#f5d84f" stroke-width="2.2" stroke-linecap="round"/>
<circle cx="-6" cy="6" r="2.3" fill="#1a1a1a"/><circle cx="6" cy="6" r="2.3" fill="#1a1a1a"/>
<path d="M-5 11q5 4 10 0" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round"/></g>`,

pudding:`<rect width="100" height="50" fill="url(#bg-ice)"/>
<g stroke="#9fd0e6" stroke-width="1.9" opacity=".5" fill="none"><path d="M10 9v6M7 12h6M90 35v6M87 38h6"/></g>
<g transform="translate(50 28)">
<path d="M-13 -13h26l4 24q0 4-17 4t-17-4z" fill="#f7dd9a" stroke="#a8842e" stroke-width="2.2"/>
<path d="M-13 -13h26q0 4-13 4t-13-4z" fill="#a05a24" stroke="#6b3a13" stroke-width="2"/>
<path d="M-9 -12q3 6 9 3t9 2" fill="none" stroke="#c47a34" stroke-width="2.2" stroke-linecap="round" opacity=".8"/>
<ellipse cx="0" cy="15" rx="17" ry="4" fill="#c48a34" stroke="#6b3a13" stroke-width="1.8"/>
<circle cx="-6" cy="3" r="2.4" fill="#1a1a1a"/><circle cx="6" cy="3" r="2.4" fill="#1a1a1a"/>
<circle cx="-6.8" cy="2.2" r=".9" fill="#fff"/><circle cx="5.2" cy="2.2" r=".9" fill="#fff"/>
<path d="M-3.5 8.5q3.5 3 7 0" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round"/>
<circle cx="-14" cy="5" r="2.4" fill="#f2b6c4" opacity=".8"/><circle cx="14" cy="5" r="2.4" fill="#f2b6c4" opacity=".8"/></g>`,

sorbet:`<rect width="100" height="50" fill="url(#bg-ice)"/>
<g stroke="#9fd0e6" stroke-width="1.9" opacity=".55" fill="none"><path d="M11 10v7M7.5 13.5h7M89 33v7M85.5 36.5h7"/></g>
<g transform="translate(50 28)">
<path d="M16 -19 26 -25" stroke="#b8901a" stroke-width="2.6" stroke-linecap="round"/>
<ellipse cx="19" cy="-18" rx="4.4" ry="3" fill="#e8dcc0" stroke="#8a7332" stroke-width="1.5"/>
<path d="M-14 -6h28l-4 17q-1 3-10 3t-10-3z" fill="#dff1fa" stroke="#2f7fae" stroke-width="2.2" opacity=".95"/>
<circle cx="-6" cy="-11" r="8.4" fill="#bfe6f7" stroke="#2f7fae" stroke-width="2"/>
<circle cx="6" cy="-12" r="7.6" fill="#f3f9fd" stroke="#2f7fae" stroke-width="2"/>
<circle cx="0" cy="-19" r="3.4" fill="#d0517a" stroke="#8e2b4c" stroke-width="1.4"/>
<circle cx="-4" cy="1" r="2.3" fill="#1a1a1a"/><circle cx="4" cy="1" r="2.3" fill="#1a1a1a"/>
<path d="M-3 6.5q3 2.6 6 0" fill="none" stroke="#1a1a1a" stroke-width="1.9" stroke-linecap="round"/></g>`,

nuka:`<rect width="100" height="50" fill="url(#bg-poison)"/>
<g stroke="#bb9fdb" stroke-width="1.8" opacity=".5" fill="none"><path d="M7 14q7 6 0 13M93 14q-7 6 0 13"/></g>
<g transform="translate(50 28)">
<path d="M-16 -12h32v22q0 5-16 5t-16-5z" fill="#d9c79a" stroke="#7d6631" stroke-width="2.2"/>
<rect x="-19" y="-16" width="38" height="5" rx="2" fill="#8a6a3a" stroke="#4f3a17" stroke-width="1.8"/>
<path d="M-11 -8q4 14 0 18M0 -9q3 14 0 19M11 -8q-4 14 0 18" fill="none" stroke="#5f8a3a" stroke-width="3.4" stroke-linecap="round"/>
<circle cx="-5" cy="2" r="2.4" fill="#1a1a1a"/><circle cx="5" cy="2" r="2.4" fill="#1a1a1a"/>
<circle cx="-5.8" cy="1.2" r=".9" fill="#fff"/><circle cx="4.2" cy="1.2" r=".9" fill="#fff"/>
<path d="M-4 8q4 3 8 0" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round"/></g>`,

mushroom:`<rect width="100" height="50" fill="url(#bg-poison)"/>
<g stroke="#bb9fdb" stroke-width="1.8" opacity=".45" fill="none"><path d="M9 16q6 6 0 12M91 16q-6 6 0 12"/></g>
<g transform="translate(50 29)">
<path d="M-22 8h44q-2 10-22 10T-22 8z" fill="#6d5330" stroke="#3f2d15" stroke-width="2.1"/>
<path d="M-7 -2q-2 8-1 11h16q1-3-1-11z" fill="#f0e6cf" stroke="#8a7550" stroke-width="2"/>
<path d="M-19 -2q0-16 19-16t19 16z" fill="#7b40b5" stroke="#4a2270" stroke-width="2.3"/>
<g fill="#f0e4ff" stroke="#4a2270" stroke-width="1"><circle cx="-10" cy="-8" r="3.2"/><circle cx="3" cy="-11" r="2.5"/><circle cx="12" cy="-6" r="2.7"/></g>
<circle cx="-4" cy="3" r="2.2" fill="#1a1a1a"/><circle cx="4" cy="3" r="2.2" fill="#1a1a1a"/>
<path d="M-3 8q3 2.5 6 0" fill="none" stroke="#1a1a1a" stroke-width="1.9" stroke-linecap="round"/></g>`,

cider:`<rect width="100" height="50" fill="url(#bg-bolt)"/>
<g fill="#fff" opacity=".6"><circle cx="12" cy="12" r="2.8"/><circle cx="88" cy="36" r="2.4"/><circle cx="15" cy="38" r="2"/></g>
<g transform="translate(50 28)">
<path d="M-9 -18q0-5 9-6t9 6l3 26q0 5-12 5t-12-5z" fill="#cfeaf2" stroke="#2c7d94" stroke-width="2.3"/>
<rect x="-6" y="-24" width="12" height="5" rx="2" fill="#b8901a" stroke="#7a5c0e" stroke-width="1.6"/>
<g fill="#fff" opacity=".95"><circle cx="-4" cy="-6" r="2.2"/><circle cx="5" cy="-11" r="1.7"/><circle cx="3" cy="1" r="2.4"/></g>
<circle cx="-5" cy="8" r="2.2" fill="#1a1a1a"/><circle cx="5" cy="8" r="2.2" fill="#1a1a1a"/>
<path d="M-4 13q4 3 8 0" fill="none" stroke="#1a1a1a" stroke-width="1.9" stroke-linecap="round"/></g>`,

jelly:`<rect width="100" height="50" fill="url(#bg-bolt)"/>
<g fill="#fff" opacity=".55"><circle cx="11" cy="14" r="2.6"/><circle cx="89" cy="34" r="2.6"/></g>
<g transform="translate(50 28)">
<path d="M2 -25 -7 -14h5.4l-2.6 8.6L6 -17H.6z" fill="#ffe14d" stroke="#8a6a10" stroke-width="1.5" stroke-linejoin="round"/>
<path d="M-18 -10h36v18q0 5-18 5t-18-5z" fill="#f0d75a" stroke="#8a6a10" stroke-width="2.3" opacity=".95"/>
<path d="M-18 -10h36l-6-6h-24z" fill="#f7e894" stroke="#8a6a10" stroke-width="2"/>
<path d="M-13 -5q-2 9-1 13" fill="none" stroke="#fff8cf" stroke-width="2.6" stroke-linecap="round"/>
<circle cx="-5" cy="2" r="2.3" fill="#1a1a1a"/><circle cx="5" cy="2" r="2.3" fill="#1a1a1a"/>
<path d="M-4 8q4 3 8 0" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round"/></g>`,

rice:`<rect width="100" height="50" fill="url(#bg-none)"/>
<g stroke="#c2ccc7" stroke-width="2" opacity=".6" fill="none"><path d="M8 40h14M78 40h14"/></g>
<g transform="translate(50 29)">
<path d="M-16 -6q6-12 16-12t16 12q-6 4-16 4t-16-4z" fill="#fff" stroke="#8d9a94" stroke-width="2.2"/>
<path d="M-23 -6h46q-3 16-23 16T-23 -6z" fill="#3a5c74" stroke="#1e3648" stroke-width="2.3"/>
<path d="M-19 -3h38" stroke="#7fa3ba" stroke-width="1.8"/>
<ellipse cx="0" cy="12" rx="9" ry="3" fill="#3a5c74" stroke="#1e3648" stroke-width="1.8"/>
<circle cx="-5" cy="-9" r="2.2" fill="#1a1a1a"/><circle cx="5" cy="-9" r="2.2" fill="#1a1a1a"/>
<path d="M-3.5 -4.5q3.5 2.5 7 0" fill="none" stroke="#1a1a1a" stroke-width="1.9" stroke-linecap="round"/></g>`,

feast:`<rect width="100" height="50" fill="url(#bg-none)"/>
<g stroke="#cbb26a" stroke-width="2" opacity=".7" fill="none"><path d="M6 7h10M84 7h10M6 43h10M84 43h10"/></g>
<g transform="translate(50 27)">
<rect x="-24" y="-16" width="48" height="32" rx="2.5" fill="#7d2c22" stroke="#43120d" stroke-width="2.3"/>
<rect x="-24" y="-16" width="48" height="6" fill="#b8901a" stroke="#43120d" stroke-width="1.7"/>
<g stroke="#43120d" stroke-width="1.6"><path d="M-8 -10v26M8 -10v26M-24 3h48"/></g>
<circle cx="-16" cy="-3" r="4" fill="#f0e6cf"/><circle cx="-16" cy="-3" r="1.8" fill="#c1362c"/>
<rect x="3" y="-7" width="10" height="8" rx="1" fill="#f2d472"/>
<circle cx="16" cy="-3" r="4" fill="#5f8a3a"/>
<rect x="-21" y="6" width="9" height="7" rx="1" fill="#d9c79a"/>
<circle cx="0" cy="9" r="4" fill="#f0e6cf"/><circle cx="0" cy="9" r="1.8" fill="#7d2c22"/>
<rect x="11" y="6" width="9" height="7" rx="1" fill="#b8901a"/>
<circle cx="-5" cy="-13" r="1.7" fill="#1a1a1a"/><circle cx="5" cy="-13" r="1.7" fill="#1a1a1a"/></g>`
};

/* =========================================================
   カードDB(全10枚 / 属性ごと2枚)
   ── 設計方針 ──
   ・レアリティで素の数値を吊り上げず、HPと威力は「硬い＝低火力 /
     脆い＝高火力」のトレードで散らす。レアリティ差はスキルの
     「質」(効果の種類・複合度)で付ける
   ・skills[0] は必ず前衛スキル(Lv1で唯一使える枠のため)
   ・skills は必ず3つ。王スキルと合わせて計4つがLvで解放される
   ========================================================= */
const CARD_DB = {
  /* ---------------- 炎 ---------------- */
  ramen:{name:'湯気立つラーメン', elem:'炎', rarity:'N', hp:54,
    skills:[ F({name:'熱々スープ', power:17}),
             B({name:'湯気の癒し', power:0, friendly:true, heal:18}),
             F({name:'追い油', cost:2, power:28}) ],
    king:{name:'出汁の温もり', desc:'ターン開始時に王HP+4', trigger:'turnHeal', value:4}},

  chili:{name:'火吹きチリドッグ', elem:'炎', rarity:'R', hp:48,
    skills:[ F({name:'激辛かぶりつき', power:20}),
             F({name:'火炎ブレス', power:12, status:{type:'burn', chance:.6}}),
             B({name:'香辛料の鼓舞', power:0, friendly:true, buffAll:{amount:.2, turns:2}}) ],
    king:{name:'灼熱の意地', desc:'味方が倒れる毎に攻+12%', trigger:'rage', value:.12}},

  /* ---------------- 氷 ---------------- */
  pudding:{name:'ゆれるプリン', elem:'氷', rarity:'N', hp:50,
    skills:[ F({name:'ぷるんアタック', power:17}),
             B({name:'ひんやり鎮静', power:0, debuffAtk:{amount:.3, turns:2}}),
             F({name:'カラメル固め', power:13, status:{type:'freeze', chance:.35}}) ],
    king:{name:'なめらか回避', desc:'前衛2枚生存で被ダメ-12%', trigger:'frontGuard', value:.12}},

  sorbet:{name:'氷結ソルベ', elem:'氷', rarity:'SR', hp:56,
    skills:[ F({name:'氷刃スプーン', power:18}),
             F({name:'絶対零度', cost:2, power:27, status:{type:'freeze', chance:.35}}),
             B({cost:2, name:'再生のシロップ', power:0, friendly:true, revive:{hpPct:.4}, targetDead:true}) ],
    king:{name:'静寂の守り', desc:'味方の状態異常を自動治療', trigger:'autoCleanse'}},

  /* ---------------- 毒 ---------------- */
  nuka:{name:'ぬか漬けマスター', elem:'毒', rarity:'N', hp:52,
    skills:[ F({name:'漬け込みパンチ', power:17}),
             F({name:'発酵の刺', power:13, status:{type:'poison', chance:.8}}),
             B({name:'床の手入れ', power:0, friendly:true, cleanse:true, buffTarget:{amount:.12, turns:2}}) ],
    king:{name:'熟成の妙', desc:'状態異常の敵に+4', trigger:'statusBonus', value:4}},

  mushroom:{name:'妖しいキノコ鍋', elem:'毒', rarity:'R', hp:48,
    skills:[ F({name:'胞子スプラッシュ', power:18}),
             B({name:'痺れ胞子', power:0, debuffAll:{amount:.22, turns:2}}),
             F({cost:2, name:'猛毒煮込み', power:24, status:{type:'poison', chance:1}}) ],
    king:{name:'菌糸の増殖', desc:'ターン毎に攻+7% 最大35%', trigger:'rampUp', value:.07, max:.35}},

  /* ---------------- 雷 ---------------- */
  cider:{name:'はじけるサイダー', elem:'雷', rarity:'N', hp:46,
    skills:[ F({name:'泡ショット', power:15}),
             F({name:'しびれ炭酸', power:11, status:{type:'paralyze', chance:.35}}),
             B({name:'気付けの一杯', power:0, friendly:true, gainSP:2, oncePerTurn:true}) ],
    king:{name:'爽快感', desc:'SP3以上で与ダメ+15%', trigger:'spMax', need:3, value:.15}},

  jelly:{name:'帯電ゼリー', elem:'雷', rarity:'R', hp:50,
    skills:[ F({name:'放電タックル', power:16}),
             B({name:'電力供給', power:0, friendly:true, gainSP:2, oncePerTurn:true}),
             F({cost:2, name:'雷撃スパーク', power:26, status:{type:'paralyze', chance:.4}}) ],
    king:{name:'導通', desc:'味方が状態異常付与で追加5', trigger:'onStatusInflict', value:5}},

  /* ---------------- 無 ---------------- */
  rice:{name:'大盛りごはん', elem:'無', rarity:'N', hp:62,
    skills:[ F({name:'どっしり体当たり', power:15}),
             B({name:'おかわり配給', power:0, friendly:true, healAll:9}),
             F({cost:2, name:'山盛りプレス', power:26}) ],
    king:{name:'満腹の安心', desc:'後衛2枚生存で毎T 王HP+5', trigger:'backHeal', value:5}},

  feast:{name:'五段重の宴', elem:'無', rarity:'UR', hp:58,
    skills:[ F({name:'祝いの一撃', power:19}),
             F({cost:2, name:'重箱返し', power:26, swapEnemy:true}),
             B({cost:2, name:'一年の計', power:0, friendly:true, healAll:12, cleanse:true}) ],
    king:{name:'五段の祝', desc:'5枚全員生存で全体+18%', trigger:'fullBoard', value:.18}}
};

const CARD_IDS = Object.keys(CARD_DB);
