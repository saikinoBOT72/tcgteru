/* =========================================================
   data.js — 属性 / レアリティ / カードアート / カードDB
   企画書 5章(属性)6章(レアリティ)7章(スキルプール)8章(サンプル)
   ========================================================= */

const ELEMENTS = ['炎', '氷', '毒', '雷', '無'];

const ELEM = {
  '炎': {icon:'🔥', accent:'#e2483f', id:'fire'},
  '氷': {icon:'❄️', accent:'#4f96c2', id:'ice'},
  '毒': {icon:'☠️', accent:'#8e5cc9', id:'poison'},
  '雷': {icon:'⚡', accent:'#c9a227', id:'bolt'},
  '無': {icon:'⚪', accent:'#8d8d8d', id:'none'}
};

/* ---- 属性相性表(企画書TODOの確定版) --------------------
   4すくみ: 炎→氷→毒→雷→炎 が有利(1.2倍)
   その逆流しは軽減(0.8倍)、同属性も軽減(0.8倍)
   「無」は攻守ともに常に等倍 = 安定枠
   0倍(無効)は基礎相性では使わず、王スキル(属性無効)専用の枠とする
   ---------------------------------------------------------- */
const AFFINITY = {
  '炎': {'炎':0.8, '氷':1.2, '毒':1.0, '雷':0.8, '無':1.0},
  '氷': {'炎':0.8, '氷':0.8, '毒':1.2, '雷':1.0, '無':1.0},
  '毒': {'炎':1.0, '氷':0.8, '毒':0.8, '雷':1.2, '無':1.0},
  '雷': {'炎':1.2, '氷':1.0, '毒':0.8, '雷':0.8, '無':1.0},
  '無': {'炎':1.0, '氷':1.0, '毒':1.0, '雷':1.0, '無':1.0}
};

function affinityMult(atkElem, defElem){
  const row = AFFINITY[atkElem];
  return row && row[defElem] !== undefined ? row[defElem] : 1.0;
}

/* ---- レアリティ ---- */
const RARITY = {
  N : {label:'N',  rank:0, frame:'#8d8d8d', gachaWeight:74},
  R : {label:'R',  rank:1, frame:'#3f7fc2', gachaWeight:20},
  SR: {label:'SR', rank:2, frame:'#c9a227', gachaWeight:5},
  UR: {label:'UR', rank:3, frame:'#9b3fc2', gachaWeight:1}
};

const STATUS_LABEL = {burn:'やけど', poison:'毒', freeze:'凍結', paralyze:'麻痺', stun:'スタン', seal:'封印'};

/* =========================================================
   カードアート(viewBox 0 0 100 50 の symbol 中身)
   ========================================================= */
const ART = {
karai:`<rect width="100" height="50" fill="url(#bg-fire)"/>
<g stroke="#e8a79f" stroke-width="2.2" opacity=".5" fill="none"><path d="M5 6 L17 17 M95 6 L83 17 M5 44 L17 33 M95 44 L83 33"/></g>
<g transform="translate(50 25) scale(.82)">
<path d="M-2 -25 Q4 -32 9 -26 L1 -16 Z" fill="#4d9a4d" stroke="#2e6b2e" stroke-width="1.8"/>
<path d="M1 -21 C18 -20 24 -5 15 8 C9 18 -6 21 -13 13 C-19 5 -14 -8 -5 -14 C-11 -17 -10 -22 1 -21 Z" fill="#e2483f" stroke="#8f241d" stroke-width="2.4"/>
<path d="M-6 -12 C-11 -6 -12 2 -8 8" fill="none" stroke="#ff8f83" stroke-width="2.6" stroke-linecap="round" opacity=".75"/>
<circle cx="-3" cy="-2" r="2.9" fill="#1a1a1a"/><circle cx="6" cy="-5" r="2.9" fill="#1a1a1a"/>
<circle cx="-4" cy="-3" r="1" fill="#fff"/><circle cx="5" cy="-6" r="1" fill="#fff"/>
<path d="M-4 5 Q2 10 8 4" fill="none" stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round"/></g>`,

kaki:`<rect width="100" height="50" fill="url(#bg-ice)"/>
<g stroke="#9fd2e8" stroke-width="2" opacity=".55" fill="none"><path d="M10 9 v7 M6.5 12.5 h7 M90 36 v7 M86.5 39.5 h7 M87 10 v5 M84.5 12.5 h5"/></g>
<g transform="translate(50 26) scale(.86)">
<path d="M-11 18 L11 18 L7 -6 Q0 -11 -7 -6 Z" fill="#eaf6fb" stroke="#3f83ad" stroke-width="2.4"/>
<ellipse cx="0" cy="-10" rx="16" ry="11" fill="#fff" stroke="#3f83ad" stroke-width="2.4"/>
<path d="M-11 -10 Q0 -22 11 -10" fill="none" stroke="#c9e8f6" stroke-width="3" stroke-linecap="round"/>
<circle cx="0" cy="-21" r="3.6" fill="#d84b4b" stroke="#9c2820" stroke-width="1.5"/>
<circle cx="-5" cy="0" r="2.5" fill="#1a1a1a"/><circle cx="5" cy="0" r="2.5" fill="#1a1a1a"/>
<circle cx="-5.8" cy="-.8" r=".9" fill="#fff"/><circle cx="4.2" cy="-.8" r=".9" fill="#fff"/>
<path d="M-5 6 Q0 10 5 6" fill="none" stroke="#1a1a1a" stroke-width="2.1" stroke-linecap="round"/>
<circle cx="-13" cy="3" r="2.5" fill="#f5b8c4" opacity=".8"/><circle cx="13" cy="3" r="2.5" fill="#f5b8c4" opacity=".8"/></g>`,

natto:`<rect width="100" height="50" fill="url(#bg-poison)"/>
<g stroke="#c0a6dd" stroke-width="1.8" opacity=".55" fill="none"><path d="M7 14 q7 6 0 13 M93 14 q-7 6 0 13"/></g>
<g transform="translate(50 25) scale(1.02)">
<g stroke="#efe0b8" stroke-width="1.6" opacity=".9" fill="none"><path d="M-16 4 q4 -8 2 12 M16 4 q-4 -8 -2 12 M0 12 q3 -6 -1 10"/></g>
<ellipse cx="-10" cy="3" rx="10" ry="12" fill="#c9a15a" stroke="#6d5227" stroke-width="2.1"/>
<ellipse cx="10" cy="3" rx="10" ry="12" fill="#d9b16a" stroke="#6d5227" stroke-width="2.1"/>
<ellipse cx="0" cy="-7" rx="11" ry="13" fill="#e6c37f" stroke="#6d5227" stroke-width="2.1"/>
<circle cx="-4" cy="-9" r="2.5" fill="#1a1a1a"/><circle cx="4" cy="-9" r="2.5" fill="#1a1a1a"/>
<circle cx="-4.8" cy="-9.8" r=".9" fill="#fff"/><circle cx="3.2" cy="-9.8" r=".9" fill="#fff"/>
<path d="M-4 -2 Q0 1 4 -2" fill="none" stroke="#1a1a1a" stroke-width="2.1" stroke-linecap="round"/></g>`,

soda:`<rect width="100" height="50" fill="url(#bg-bolt)"/>
<g fill="#fff" opacity=".7"><circle cx="12" cy="12" r="3"/><circle cx="88" cy="16" r="2.4"/><circle cx="16" cy="38" r="2.2"/><circle cx="86" cy="37" r="3.2"/></g>
<g transform="translate(50 26) scale(.8)">
<path d="M-12 -14 L12 -14 L8 20 L-8 20 Z" fill="#fdf0b0" stroke="#a8851a" stroke-width="2.4"/>
<rect x="-2.5" y="-29" width="5" height="17" rx="2.5" fill="#fff" stroke="#a8851a" stroke-width="1.6"/>
<g fill="#fff" stroke="#a8851a" stroke-width="1.1"><circle cx="-5" cy="-6" r="2.3"/><circle cx="5" cy="-10" r="1.8"/><circle cx="2" cy="1" r="2.5"/></g>
<circle cx="-5" cy="9" r="2.4" fill="#1a1a1a"/><circle cx="5" cy="9" r="2.4" fill="#1a1a1a"/>
<circle cx="-5.8" cy="8.2" r=".9" fill="#fff"/><circle cx="4.2" cy="8.2" r=".9" fill="#fff"/>
<path d="M-5 14 Q0 17 5 14" fill="none" stroke="#1a1a1a" stroke-width="2.1" stroke-linecap="round"/></g>`,

onigiri:`<rect width="100" height="50" fill="url(#bg-none)"/>
<g stroke="#c4c4c4" stroke-width="2" opacity=".65" fill="none"><path d="M8 40 h16 M76 40 h16"/></g>
<g transform="translate(50 26) scale(.94)">
<clipPath id="clip-oni"><path d="M0 -22 L19 14 Q21 19 16 19 L-16 19 Q-21 19 -19 14 Z"/></clipPath>
<path d="M0 -22 L19 14 Q21 19 16 19 L-16 19 Q-21 19 -19 14 Z" fill="#fff" stroke="#333" stroke-width="2.4"/>
<g clip-path="url(#clip-oni)"><rect x="-24" y="6" width="48" height="16" fill="#262626"/></g>
<circle cx="-5" cy="-2" r="2.5" fill="#1a1a1a"/><circle cx="5" cy="-2" r="2.5" fill="#1a1a1a"/>
<circle cx="-5.8" cy="-2.8" r=".9" fill="#fff"/><circle cx="4.2" cy="-2.8" r=".9" fill="#fff"/>
<path d="M-4 4 Q0 7 4 4" fill="none" stroke="#1a1a1a" stroke-width="2.1" stroke-linecap="round"/>
<circle cx="-12" cy="2" r="2.3" fill="#f3b9b9" opacity=".85"/><circle cx="12" cy="2" r="2.3" fill="#f3b9b9" opacity=".85"/></g>`,

mapo:`<rect width="100" height="50" fill="url(#bg-fire)"/>
<g stroke="#e8a79f" stroke-width="2" opacity=".45" fill="none"><path d="M8 40 q6 -10 12 0 M80 40 q6 -10 12 0"/></g>
<g transform="translate(50 27) scale(.95)">
<path d="M-20 -2 Q0 -10 20 -2 L16 12 Q0 19 -16 12 Z" fill="#c0392b" stroke="#7a1f16" stroke-width="2.2"/>
<ellipse cx="0" cy="-3" rx="20" ry="6" fill="#e2483f" stroke="#7a1f16" stroke-width="2"/>
<g fill="#f7f0e0" stroke="#8a6a3a" stroke-width="1.2"><rect x="-11" y="-8" width="7" height="7" rx="1.2"/><rect x="3" y="-9" width="7" height="7" rx="1.2"/><rect x="-4" y="-13" width="7" height="7" rx="1.2"/></g>
<g stroke="#ffd0a0" stroke-width="2" opacity=".8" fill="none"><path d="M-12 -16 q3 -6 0 -10 M12 -16 q-3 -6 0 -10 M0 -20 q3 -5 0 -9"/></g>
<circle cx="-6" cy="4" r="2.4" fill="#1a1a1a"/><circle cx="6" cy="4" r="2.4" fill="#1a1a1a"/>
<circle cx="-6.8" cy="3.2" r=".9" fill="#fff"/><circle cx="5.2" cy="3.2" r=".9" fill="#fff"/>
<path d="M-5 10 Q0 14 5 10" fill="none" stroke="#1a1a1a" stroke-width="2.1" stroke-linecap="round"/></g>`,

icecream:`<rect width="100" height="50" fill="url(#bg-ice)"/>
<g stroke="#9fd2e8" stroke-width="1.8" opacity=".5" fill="none"><path d="M12 12 v6 M9 15 h6 M88 34 v6 M85 37 h6"/></g>
<g transform="translate(50 26) scale(.9)">
<path d="M-9 4 L9 4 L0 22 Z" fill="#e6c78a" stroke="#9c7532" stroke-width="2.2"/>
<path d="M-6 8 L6 8 M-4 13 L4 13" stroke="#9c7532" stroke-width="1.2"/>
<circle cx="-6" cy="-2" r="9" fill="#fff0f4" stroke="#c98aa0" stroke-width="2"/>
<circle cx="6" cy="-2" r="9" fill="#eaf6fb" stroke="#3f83ad" stroke-width="2"/>
<circle cx="0" cy="-12" r="9.5" fill="#fdf6e0" stroke="#b89a4e" stroke-width="2"/>
<circle cx="0" cy="-23" r="3.4" fill="#d84b4b" stroke="#9c2820" stroke-width="1.4"/>
<circle cx="-4" cy="-13" r="2.3" fill="#1a1a1a"/><circle cx="4" cy="-13" r="2.3" fill="#1a1a1a"/>
<circle cx="-4.8" cy="-13.8" r=".8" fill="#fff"/><circle cx="3.2" cy="-13.8" r=".8" fill="#fff"/>
<path d="M-3.5 -7.5 Q0 -4.5 3.5 -7.5" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round"/></g>`,

kinoko:`<rect width="100" height="50" fill="url(#bg-poison)"/>
<g stroke="#c0a6dd" stroke-width="1.8" opacity=".5" fill="none"><path d="M9 16 q6 6 0 12 M91 16 q-6 6 0 12"/></g>
<g transform="translate(50 26) scale(.95)">
<path d="M-7 2 Q-9 16 -6 20 L6 20 Q9 16 7 2 Z" fill="#f2e8d5" stroke="#8a7550" stroke-width="2.2"/>
<path d="M-19 2 Q-19 -16 0 -16 Q19 -16 19 2 Z" fill="#8e5cc9" stroke="#5a3080" stroke-width="2.3"/>
<g fill="#f4ecff" stroke="#5a3080" stroke-width="1"><circle cx="-11" cy="-6" r="3.2"/><circle cx="2" cy="-10" r="2.6"/><circle cx="12" cy="-4" r="2.9"/></g>
<circle cx="-4" cy="8" r="2.3" fill="#1a1a1a"/><circle cx="4" cy="8" r="2.3" fill="#1a1a1a"/>
<circle cx="-4.8" cy="7.2" r=".8" fill="#fff"/><circle cx="3.2" cy="7.2" r=".8" fill="#fff"/>
<path d="M-3.5 13 Q0 15.5 3.5 13" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round"/></g>`,

energy:`<rect width="100" height="50" fill="url(#bg-bolt)"/>
<g fill="#fff" opacity=".65"><circle cx="11" cy="14" r="2.6"/><circle cx="89" cy="34" r="2.6"/></g>
<g transform="translate(50 26) scale(.86)">
<path d="M-11 -15 L11 -15 L9 18 Q0 22 -9 18 Z" fill="#3f3f3f" stroke="#111" stroke-width="2.3"/>
<path d="M-11 -15 L11 -15 L10.4 -8 L-10.4 -8 Z" fill="#c9a227" stroke="#111" stroke-width="1.6"/>
<path d="M2 -6 L-5 4 L0 4 L-2 13 L6 2 L1 2 Z" fill="#ffe14d" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/>
<circle cx="-6" cy="9" r="2.2" fill="#fff"/><circle cx="6" cy="9" r="2.2" fill="#fff"/>
<circle cx="-6" cy="9" r="1" fill="#111"/><circle cx="6" cy="9" r="1" fill="#111"/>
<path d="M-13 -19 l3 5 M13 -19 l-3 5" stroke="#ffe14d" stroke-width="2.2" stroke-linecap="round"/></g>`,

shokupan:`<rect width="100" height="50" fill="url(#bg-none)"/>
<g stroke="#c4c4c4" stroke-width="2" opacity=".6" fill="none"><path d="M9 38 h14 M77 38 h14"/></g>
<g transform="translate(50 26) scale(.92)">
<path d="M-15 -8 Q-15 -20 0 -20 Q15 -20 15 -8 L15 17 Q15 20 12 20 L-12 20 Q-15 20 -15 17 Z" fill="#f7e3b8" stroke="#a07f3c" stroke-width="2.3"/>
<path d="M-11 -6 Q-11 -15 0 -15 Q11 -15 11 -6 L11 15 L-11 15 Z" fill="#fffaf0" stroke="#a07f3c" stroke-width="1.4"/>
<path d="M-22 -12 L20 -22" stroke="#8d8d8d" stroke-width="2.6" stroke-linecap="round"/>
<path d="M-24 -10 L-19 -14" stroke="#5a5a5a" stroke-width="4" stroke-linecap="round"/>
<circle cx="-4" cy="2" r="2.3" fill="#1a1a1a"/><circle cx="4" cy="2" r="2.3" fill="#1a1a1a"/>
<circle cx="-4.8" cy="1.2" r=".8" fill="#fff"/><circle cx="3.2" cy="1.2" r=".8" fill="#fff"/>
<path d="M-3.5 8 Q0 10.5 3.5 8" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round"/></g>`,

curry:`<rect width="100" height="50" fill="url(#bg-fire)"/>
<g stroke="#ffb08a" stroke-width="2.2" opacity=".55" fill="none"><path d="M6 8 L16 18 M94 8 L84 18"/></g>
<g transform="translate(50 27) scale(.95)">
<path d="M-22 6 Q0 0 22 6 L18 15 Q0 21 -18 15 Z" fill="#fff" stroke="#8a8a8a" stroke-width="2"/>
<path d="M-19 3 Q-8 -4 0 3 Q8 -4 19 3 Q10 9 0 7 Q-10 9 -19 3 Z" fill="#b5651d" stroke="#6d3c0e" stroke-width="2"/>
<path d="M-4 -6 Q0 -20 6 -26 Q10 -18 6 -6 Z" fill="#e2483f" stroke="#8f241d" stroke-width="1.8"/>
<path d="M-10 -4 Q-12 -14 -8 -19" fill="none" stroke="#ffb08a" stroke-width="2.2" stroke-linecap="round"/>
<circle cx="-6" cy="2" r="2.3" fill="#1a1a1a"/><circle cx="6" cy="2" r="2.3" fill="#1a1a1a"/>
<circle cx="-6.8" cy="1.2" r=".8" fill="#fff"/><circle cx="5.2" cy="1.2" r=".8" fill="#fff"/>
<path d="M-4 8 Q0 12 4 8" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round"/></g>`,

parfait:`<rect width="100" height="50" fill="url(#bg-ice)"/>
<g stroke="#9fd2e8" stroke-width="1.8" opacity=".5" fill="none"><path d="M11 11 v6 M8 14 h6 M89 33 v6 M86 36 h6"/></g>
<g transform="translate(50 26) scale(.88)">
<path d="M-11 -4 L11 -4 L7 14 L-7 14 Z" fill="#fdf6ff" stroke="#a07fc0" stroke-width="2.1" opacity=".95"/>
<rect x="-3" y="14" width="6" height="5" fill="#e9e0f2" stroke="#a07fc0" stroke-width="1.6"/>
<ellipse cx="0" cy="20" rx="9" ry="3" fill="#e9e0f2" stroke="#a07fc0" stroke-width="1.8"/>
<path d="M-11 -4 Q0 -12 11 -4 Z" fill="#f7c9dc" stroke="#c07f9e" stroke-width="1.6"/>
<circle cx="-5" cy="-12" r="7" fill="#fff0f4" stroke="#c98aa0" stroke-width="1.8"/>
<circle cx="6" cy="-13" r="6.5" fill="#eaf6fb" stroke="#3f83ad" stroke-width="1.8"/>
<circle cx="0" cy="-21" r="3.2" fill="#d84b4b" stroke="#9c2820" stroke-width="1.3"/>
<path d="M12 -18 l6 -8" stroke="#c9a227" stroke-width="2.4" stroke-linecap="round"/>
<circle cx="-4" cy="2" r="2.2" fill="#1a1a1a"/><circle cx="4" cy="2" r="2.2" fill="#1a1a1a"/>
<path d="M-3 7 Q0 9.5 3 7" fill="none" stroke="#1a1a1a" stroke-width="1.9" stroke-linecap="round"/></g>`,

ramune:`<rect width="100" height="50" fill="url(#bg-bolt)"/>
<g fill="#fff" opacity=".7"><circle cx="10" cy="11" r="2.8"/><circle cx="90" cy="15" r="2.2"/><circle cx="14" cy="39" r="2.4"/><circle cx="88" cy="38" r="2.8"/></g>
<g transform="translate(50 26) scale(.82)">
<path d="M-10 -18 Q-10 -24 0 -26 Q10 -24 10 -18 L12 14 Q12 20 0 21 Q-12 20 -12 14 Z" fill="#d6f0f7" stroke="#2f7f9c" stroke-width="2.3"/>
<circle cx="0" cy="-17" r="3.6" fill="#fff" stroke="#2f7f9c" stroke-width="1.6"/>
<path d="M3 -8 L-6 5 L0 5 L-3 16 L7 2 L1 2 Z" fill="#ffe14d" stroke="#8a6a10" stroke-width="1.5" stroke-linejoin="round"/>
<g fill="#fff" opacity=".9"><circle cx="-6" cy="-6" r="2"/><circle cx="7" cy="-2" r="1.6"/></g>
<circle cx="-5" cy="10" r="2.2" fill="#1a1a1a"/><circle cx="5" cy="10" r="2.2" fill="#1a1a1a"/>
<path d="M-4 15 Q0 18 4 15" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round"/></g>`,

durian:`<rect width="100" height="50" fill="url(#bg-poison)"/>
<g stroke="#b18ad8" stroke-width="2.2" opacity=".55" fill="none"><path d="M7 10 q8 8 0 15 M93 10 q-8 8 0 15 M50 3 v6"/></g>
<g transform="translate(50 26) scale(.95)">
<g fill="#7a9c3f" stroke="#48631f" stroke-width="1.6">
<path d="M-18 -6 l-6 -5 l7 -1 Z"/><path d="M18 -6 l6 -5 l-7 -1 Z"/><path d="M0 -19 l-1 -8 l5 6 Z"/>
<path d="M-13 -14 l-5 -6 l7 1 Z"/><path d="M13 -14 l5 -6 l-7 1 Z"/>
<path d="M-18 8 l-7 3 l6 3 Z"/><path d="M18 8 l7 3 l-6 3 Z"/><path d="M0 19 l-2 8 l6 -6 Z"/></g>
<ellipse cx="0" cy="0" rx="18" ry="17" fill="#8fb04a" stroke="#48631f" stroke-width="2.4"/>
<g fill="#a8c463" stroke="#48631f" stroke-width="1"><circle cx="-9" cy="-8" r="2.4"/><circle cx="9" cy="-9" r="2.2"/><circle cx="11" cy="6" r="2.4"/><circle cx="-11" cy="6" r="2.2"/></g>
<path d="M-9 -3 l7 3 M9 -3 l-7 3" stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round"/>
<circle cx="-5" cy="2" r="2.6" fill="#1a1a1a"/><circle cx="5" cy="2" r="2.6" fill="#1a1a1a"/>
<circle cx="-5.8" cy="1.2" r=".9" fill="#fff"/><circle cx="4.2" cy="1.2" r=".9" fill="#fff"/>
<path d="M-6 9 Q0 14 6 9" fill="none" stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round"/></g>`,

osechi:`<rect width="100" height="50" fill="url(#bg-none)"/>
<g stroke="#d4b45a" stroke-width="2" opacity=".7" fill="none"><path d="M6 7 h10 M84 7 h10 M6 43 h10 M84 43 h10"/></g>
<g transform="translate(50 26) scale(.95)">
<rect x="-23" y="-15" width="46" height="30" rx="2.5" fill="#8c2f26" stroke="#4d1712" stroke-width="2.4"/>
<rect x="-23" y="-15" width="46" height="6" fill="#c9a227" stroke="#4d1712" stroke-width="1.6"/>
<g stroke="#4d1712" stroke-width="1.6"><path d="M-8 -9 v24 M8 -9 v24 M-23 3 h46"/></g>
<g stroke="none">
<circle cx="-15.5" cy="-3" r="4" fill="#f2e8d5"/><circle cx="-15.5" cy="-3" r="1.8" fill="#d84b4b"/>
<rect x="3" y="-7" width="10" height="8" rx="1" fill="#f7d97a"/>
<circle cx="15.5" cy="-3" r="4" fill="#7a9c3f"/>
<rect x="-20" y="6" width="9" height="7" rx="1" fill="#e6c37f"/>
<circle cx="0" cy="9" r="4" fill="#f2e8d5"/><circle cx="0" cy="9" r="1.8" fill="#8c2f26"/>
<rect x="11" y="6" width="9" height="7" rx="1" fill="#c9a227"/></g>
<circle cx="-4" cy="-12" r="1.8" fill="#1a1a1a"/><circle cx="4" cy="-12" r="1.8" fill="#1a1a1a"/></g>`
};

/* =========================================================
   スキル定義ヘルパ(企画書7章のスキルプールに対応)
   ========================================================= */
function mkSkill(o){ return Object.assign({cost:1}, o); }

/* =========================================================
   カードDB
   ── スキル設計モデル ──
   前衛スキル2枠は必ず次の型に沿う:
     枠1「通常」 = SP1 の単純攻撃
     枠2「特殊」 = A型: SP1 の弱い攻撃 + 状態異常
                 / B型: SP2以上 の強い単純攻撃
   後衛スキル1枠は原則、SP回復・回復・バフ・デバフ等の支援。
   全体攻撃は例外として少数のみ許可する。
   ※現行15枚はすべてベータ検証用の仮キャラ(名前に「(仮)」)
   ========================================================= */
const CARD_DB = {
  /* ---------------- N ---------------- */
  karai:{name:'激辛くん(仮)', elem:'炎', rarity:'N', hp:35,
    front:[ mkSkill({name:'唐辛子パンチ', power:16}),
            mkSkill({name:'爆速フレイバー', power:10, status:{type:'burn', chance:.25}}) ],
    back:  mkSkill({name:'仕込みの一味', power:0, friendly:true, buffTarget:{amount:.12, turns:2}}),
    king:{name:'猛暑の意地', desc:'前衛2枚生存で被ダメ-10%', trigger:'frontGuard', value:.1}},

  kaki:{name:'かき氷ちゃん(仮)', elem:'氷', rarity:'N', hp:40,
    front:[ mkSkill({name:'シャリシャリ', power:14}),
            mkSkill({name:'フリーズタッチ', power:8, status:{type:'freeze', chance:.15}}) ],
    back:  mkSkill({name:'冷やしなおし', power:0, friendly:true, heal:10}),
    king:{name:'クールダウン', desc:'ターン開始時HP+3', trigger:'turnHeal', value:3}},

  natto:{name:'ねばねば納豆(仮)', elem:'毒', rarity:'N', hp:38,
    front:[ mkSkill({name:'粘着シュート', power:13}),
            mkSkill({name:'発酵ニードル', power:8, status:{type:'poison', chance:1}}) ],
    back:  mkSkill({name:'発酵ガス', power:0, status:{type:'poison', chance:.4}}),
    king:{name:'発酵パワー', desc:'状態異常の敵に+3', trigger:'statusBonus', value:3}},

  soda:{name:'シュワソーダ(仮)', elem:'雷', rarity:'N', hp:32,
    front:[ mkSkill({name:'炭酸弾け', power:18}),
            mkSkill({name:'スパークタッチ', power:10, status:{type:'paralyze', chance:.25}}) ],
    back:  mkSkill({name:'気泡はじき', power:4, allEnemies:true}),
    king:{name:'怒りの泡立ち', desc:'味方が倒れる毎に攻+10%', trigger:'rage', value:.1}},

  onigiri:{name:'しろいおにぎり(仮)', elem:'無', rarity:'N', hp:45,
    front:[ mkSkill({name:'まんまるタックル', power:15}),
            mkSkill({name:'大盛りタックル', cost:2, power:26}) ],
    back:  mkSkill({name:'おむすび休憩', power:0, friendly:true, gainSP:2}),
    king:{name:'安定の白米', desc:'後衛2枚生存で毎T HP+5', trigger:'backHeal', value:5}},

  /* ---------------- R ---------------- */
  mapo:{name:'麻婆マスター(仮)', elem:'炎', rarity:'R', hp:42,
    front:[ mkSkill({name:'花椒バースト', power:20}),
            mkSkill({name:'灼熱の一撃', cost:2, power:32}) ],
    back:  mkSkill({name:'痺れの香り', power:0, debuffAtk:{amount:.2, turns:2}}),
    king:{name:'背水の激辛', desc:'王だけになると全能力+40%', trigger:'lastStand', value:.4}},

  icecream:{name:'アイスクリン(仮)', elem:'氷', rarity:'R', hp:44,
    front:[ mkSkill({name:'コールドスクープ', power:17}),
            mkSkill({name:'フリーズシロップ', power:9, status:{type:'freeze', chance:.3}}) ],
    back:  mkSkill({name:'やさしい甘み', power:0, friendly:true, heal:16}),
    king:{name:'ひんやり治癒', desc:'味方の状態異常を自動治療', trigger:'autoCleanse'}},

  kinoko:{name:'あやしいキノコ(仮)', elem:'毒', rarity:'R', hp:40,
    front:[ mkSkill({name:'胞子ばらまき', power:15}),
            mkSkill({name:'猛毒スティング', power:9, status:{type:'poison', chance:.8}}) ],
    back:  mkSkill({name:'菌糸のいたずら', power:0, reflectStatus:true, gainSP:1}),
    king:{name:'毒素蓄積', desc:'ターン毎に攻+8% 最大40%', trigger:'rampUp', value:.08, max:.4}},

  energy:{name:'エナジー王子(仮)', elem:'雷', rarity:'R', hp:36,
    front:[ mkSkill({name:'カフェインラッシュ', power:16}),
            mkSkill({name:'エナジードレイン', power:10, status:{type:'paralyze', chance:.4}}) ],
    back:  mkSkill({name:'ブースト供給', power:0, friendly:true, gainSP:3}),
    king:{name:'限界突破', desc:'SP3以上で与ダメ+15%', trigger:'spMax', need:3, value:.15}},

  shokupan:{name:'食パン侍(仮)', elem:'無', rarity:'R', hp:48,
    front:[ mkSkill({name:'一刀両断', power:20}),
            mkSkill({name:'二段斬り', cost:2, power:30}) ],
    back:  mkSkill({name:'耳まで香ばしく', power:0, friendly:true, cleanse:true, buffTarget:{amount:.15, turns:2}}),
    king:{name:'不屈の耳', desc:'前衛の致死ダメをHP1耐え', trigger:'endure'}},

  /* ---------------- SR ---------------- */
  curry:{name:'火山カレー(仮)', elem:'炎', rarity:'SR', hp:52,
    front:[ mkSkill({name:'噴火プレート', power:22}),
            mkSkill({name:'溶岩ルー', cost:2, power:36}) ],
    back:  mkSkill({name:'スパイス鼓舞', power:0, friendly:true, buffAll:{amount:.15, turns:2}}),
    king:{name:'噴火の怒り', desc:'被弾3回ごとに全体へ8反撃', trigger:'counter', need:3, value:8}},

  parfait:{name:'パフェ姫(仮)', elem:'氷', rarity:'SR', hp:50,
    front:[ mkSkill({name:'クリスタルスプーン', power:19}),
            mkSkill({name:'甘い誘惑', power:10, sealTarget:true}) ],
    back:  mkSkill({name:'再生のシロップ', cost:2, power:0, friendly:true, revive:{hpPct:.35}, targetDead:true}),
    king:{name:'満漢のきらめき', desc:'5枚全員生存で全体+20%', trigger:'fullBoard', value:.2}},

  ramune:{name:'雷神ラムネ(仮)', elem:'雷', rarity:'SR', hp:46,
    front:[ mkSkill({name:'ビー玉スマッシュ', power:21}),
            mkSkill({name:'雷鳴の一撃', cost:2, power:34}) ],
    back:  mkSkill({name:'炭酸ブースト', power:6, allEnemies:true, drainSP:1}),
    king:{name:'雷鳴の伝播', desc:'味方が状態異常付与で追加6', trigger:'onStatusInflict', value:6}},

  /* ---------------- UR ---------------- */
  durian:{name:'ドリアン卿(仮)', elem:'毒', rarity:'UR', hp:58,
    front:[ mkSkill({name:'棘の王笏', power:24}),
            mkSkill({name:'絶対発酵', cost:3, power:48}) ],
    back:  mkSkill({name:'瘴気の帳', power:0, debuffAll:{amount:.2, turns:2}}),
    king:{name:'異臭結界', desc:'氷属性からの被ダメを無効', trigger:'elemNull', elem:'氷'}},

  osechi:{name:'おせち重(仮)', elem:'無', rarity:'UR', hp:62,
    front:[ mkSkill({name:'祝いの大盤振舞', power:22}),
            mkSkill({name:'重箱返し', cost:2, power:34, swapEnemy:true}) ],
    back:  mkSkill({name:'一年の計', cost:2, power:0, friendly:true, healAll:12, cleanse:true}),
    king:{name:'五段重ねの祝', desc:'5枚全員生存で全体+25%', trigger:'fullBoard', value:.25}}
};

const CARD_IDS = Object.keys(CARD_DB);
