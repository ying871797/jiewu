(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var CX = 540;
  var RING_Y = 209;
  var OFF_Y = 396;
  var REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var board      = document.getElementById('board');
  var ringsLayer = document.getElementById('rings');
  var animLayer  = document.getElementById('animLayer');
  var dustLayer  = document.getElementById('dust');

  var elMoves = document.getElementById('hudMoves');
  var elOpt   = document.getElementById('hudOpt');
  var elTime  = document.getElementById('hudTime');
  var elDist  = document.getElementById('echoDist');
  var elDots  = document.getElementById('echoDots');
  var elName  = document.getElementById('lvlName');
  var elSub   = document.getElementById('lvlSub');
  var elChapter = document.getElementById('lvlChapter');
  var elToast = document.getElementById('toast');
  var elCoach = document.getElementById('coach');
  var elCoachNum = document.getElementById('coachNum');
  var elCoachMsg = document.getElementById('coachMsg');
  var elPct = document.getElementById('hudPct');
  var elProg = document.getElementById('hudProg');
  var elLockHint = document.getElementById('lockHint');
  var elBtnFree = document.getElementById('btnFree');
  var elBtnLegal = document.getElementById('btnLegal');
  var elBtnSound = document.getElementById('btnSound');
  var elBtnContrast = document.getElementById('btnContrast');
  var elSr = document.getElementById('srStatus');
  var elMem = document.getElementById('memStats');
  var elSeg = document.getElementById('echoSeg');
  var elSegSep = document.getElementById('echoSegSep');
  var elWinVerdict = document.getElementById('winVerdict');
  var elWinNote = document.getElementById('winNote');
  var elBtnNext = document.getElementById('btnNext');
  var elChapKicker = document.getElementById('chapEra');
  var elChapName = document.getElementById('chapName');
  var elChapSeal = document.getElementById('chapSeal');
  var elChapGhost = document.getElementById('chapGhost');
  var elChapMotif = document.getElementById('chapMotif');
  var elChapQuote = document.getElementById('chapQuote');
  var elChapPlain = document.getElementById('chapPlain');
  var elChapSource = document.getElementById('chapSource');
  var elChapNote = document.getElementById('chapNote');
  var elCardKicker = document.getElementById('cardKicker');
  var elCardChapter = document.getElementById('cardChapter');
  var elCardQuote = document.getElementById('cardQuote');
  var elCardPlain = document.getElementById('cardPlain');
  var elCardSource = document.getElementById('cardSource');
  var elCardNote = document.getElementById('cardNote');
  var elCodexCount = document.getElementById('codexCount');
  var elCodexList = document.getElementById('codexList');
  var elSkinRow = document.getElementById('skinRow');

  /* ───────────────────────── 数据 ───────────────────────── */
  var LEVELS = [
    { id:'L1', cid:'jade',    n:3, chapter:'玉连环 · 战国', name:'三连环', start:0x7,         goal:0,           note:'君王后椎破连环' },
    { id:'L2', cid:'jade',    n:4, chapter:'玉连环 · 战国', name:'四连环', start:0xF,         goal:0,           note:'玉环相贯' },
    { id:'L3', cid:'danqian', n:5, chapter:'丹铅 · 明',     name:'五连环', start:0x1F,        goal:0,           note:'杨慎考九连环' },
    { id:'L4', cid:'danqian', n:6, chapter:'丹铅 · 明',     name:'六连环', start:0x3F,        goal:0,           note:'闺妇孩童以为玩具' },
    { id:'L5', cid:'honglou', n:7, chapter:'红楼 · 清',     name:'七连环', start:0x7F,        goal:0,           note:'大家解九连环顽' },
    { id:'L6', cid:'miaoxu',  n:8, chapter:'妙绪 · 清末',   name:'八连环', start:0xFF,        goal:0,           note:'妙绪环生' },
    { id:'L7', cid:'miaoxu',  n:9, chapter:'妙绪 · 清末',   name:'九连环', start:0x1FF,       goal:0,           note:'一钗九环' },
    { id:'L8', cid:'gewu',    n:9, chapter:'格物 · 今',     name:'复原',   start:0,           goal:0x1FF,       note:'从散到整' },
    { id:'L9', cid:'gewu',    n:9, chapter:'格物 · 今',     name:'独环',   start:0,           goal:0x100,       note:'最难的一局' }
  ];

  var CHAPTERS = [
    {
      id:'jade', num:'一', name:'玉连环', era:'战国', seal:'玉', motif:'玉 · 青铜 · 椎',
      quote:'齐多知，而解此环不？',
      plain:'秦昭王派使者送玉连环给齐国君王后，问齐国是否有人能解。群臣不能解，君王后引椎椎破之，答：“谨以解矣。”',
      source:'《战国策·齐策六》',
      note:'故事中的秦王是秦昭王，不是秦始皇。'
    },
    {
      id:'danqian', num:'二', name:'丹铅', era:'明', seal:'丹', motif:'书斋 · 砚台 · 铜环',
      quote:'今有此器，谓之九连环，以铜或铁为之，以代玉。闺妇孩童以为玩具。',
      plain:'明代杨慎在《丹铅总录》里第一次明确记下“九连环”这个名字。铜铁代替玉，说明它已经从宫廷进入日常。',
      source:'明·杨慎《丹铅总录》',
      note:'这是现存中国文献中最早明确提到“九连环”的记载。'
    },
    {
      id:'honglou', num:'三', name:'红楼', era:'清', seal:'红', motif:'闺阁 · 宫花 · 暖光',
      quote:'谁知此时黛玉不在自己房中，却在宝玉房中大家解九连环顽呢。',
      plain:'《红楼梦》第七回，黛玉与宝玉一起解九连环。这只铜环在清代已经进入最日常的闺阁场景。',
      source:'清·曹雪芹《红楼梦》第七回',
      note:'“顽”是玩；九连环在当时是再寻常不过的消遣。'
    },
    {
      id:'miaoxu', num:'四', name:'妙绪', era:'清末', seal:'妙', motif:'月份牌 · 市井 · 上海',
      quote:'有情人，送奴一把九连环……',
      plain:'1804 年《白雪遗音》收俗曲《九连环》，九连环成了定情信物。1892 年吴友如画《妙绪环生》，四名上海妇女围坐解环。',
      source:'《白雪遗音》；吴友如《妙绪环生》',
      note:'从闺阁到市井，九连环始终是手里的一件小东西。'
    },
    {
      id:'gewu', num:'五', name:'格物', era:'今', seal:'格', motif:'蓝图 · 网格 · 冷光',
      quote:'九连环的状态，恰好是二进制反射格雷码。',
      plain:'把第 i 环在钗上记为第 i 位，解环路径就是沿格雷码单调移动；到全解的最短步数，正是状态转成二进制后的值。',
      source:'OEIS A000975；Frank Gray, 1940',
      note:'你不是在解环，你是在倒着数数。'
    }
  ];
  var CHAPTER_BY_ID = {};
  CHAPTERS.forEach(function (c) { CHAPTER_BY_ID[c.id] = c; });

  function chapterOf(idx) {
    var L = LEVELS[idx];
    return L ? CHAPTER_BY_ID[L.cid] : null;
  }

  var CARDS = [
    { id:'jade-hui', cid:'jade', title:'连环可解也',
      quote:'连环可解也。',
      plain:'惠施把“连环可解也”列入“历物十事”，讨论的不是玩具说明书，而是解与不可解的相对性。唐·成玄英疏：“两环贯空，不相涉入，各自通转，故可解者也。”',
      source:'《庄子·天下》；唐·成玄英《庄子疏》',
      note:'惠施说的是两环相贯的玉连环，与后世九连环形制不同。' },
    { id:'jade-king', cid:'jade', title:'君王后椎破连环',
      quote:'齐多知，而解此环不？',
      plain:'秦昭王派使者送玉连环给齐国君王后，问齐国是否有人能解。群臣不能解，君王后引椎椎破之，答：“谨以解矣。”',
      source:'《战国策·齐策六》',
      note:'故事中的秦王是秦昭王，不是秦始皇。' },
    { id:'jade-pacioli', cid:'jade', title:'西方最早的记载',
      quote:'De Viribus Quantitatis',
      plain:'约 1509–1510 年，意大利数学家 Luca Pacioli 在《De Viribus Quantitatis》中描述这种环，并给出七连环解法。这是西方最早的文献之一。',
      source:'Luca Pacioli, De Viribus Quantitatis',
      note:'中西文献年代相近，九连环的起源地至今没有定论。' },

    { id:'dan-yang', cid:'danqian', title:'九连环得名',
      quote:'今有此器，谓之九连环，以铜或铁为之，以代玉。',
      plain:'明代杨慎在《丹铅总录》里第一次明确记下“九连环”这个名字。铜铁代替玉，说明它已经从宫廷进入日常。',
      source:'明·杨慎《丹铅总录》',
      note:'现存中国文献中最早明确提到“九连环”者。' },
    { id:'dan-xiaohui', cid:'danqian', title:'闺中的解法书',
      quote:'绘图与解法图表',
      plain:'清道光元年（1821），贮香主人编《小慧集》，收录九连环的绘图与解法图表，读者多为闺中女子。',
      source:'清·贮香主人《小慧集》',
      note:'九连环不只是玩具，也是一门可以被写下来、传下去的手艺。' },
    { id:'dan-xuke', cid:'danqian', title:'八十一词的疑案',
      quote:'先上第一环，再上第二环，而下其第一环，更上第三环……',
      plain:'徐珂《清稗类钞》记下了解法口诀，却写“凡八十一词”，与今天算出的 341 步不合，疑为传抄或刊刻之误。',
      source:'清末·徐珂《清稗类钞》',
      note:'古籍里的数字，有时也会把后人绕进去。' },

    { id:'hong-daiyu', cid:'honglou', title:'大家解九连环顽',
      quote:'谁知此时黛玉不在自己房中，却在宝玉房中大家解九连环顽呢。',
      plain:'《红楼梦》第七回，黛玉与宝玉一起解九连环。这只铜环在清代已进入最日常的闺阁场景。',
      source:'清·曹雪芹《红楼梦》第七回',
      note:'“顽”是玩；九连环在当时是再寻常不过的消遣。' },
    { id:'hong-kangxi', cid:'honglou', title:'康熙的寿礼',
      quote:'玉制九连环',
      plain:'康熙五十二年（1713），康熙六十大寿，收到孙女进献的玉制九连环。',
      source:'清宫档案 / 藏品著录',
      note:'从民间铜环到宫廷玉器，同一套规则，不同的材质。' },
    { id:'hong-yuji', cid:'honglou', title:'仕女手中的环',
      quote:'仕女手持九连环',
      plain:'清嘉庆十二年（1807），画家余集（1738–1823）作仕女图，画中仕女手持九连环。德国汉学家夏德 1893 年在扬州购得此画。',
      source:'余集仕女图；夏德 1893 年购藏',
      note:'九连环也成了画家笔下的一件日常道具。' },

    { id:'miao-baixue', cid:'miaoxu', title:'定情之物',
      quote:'有情人，送奴一把九连环……',
      plain:'清嘉庆九年（1804），华广生编《白雪遗音》收俗曲《九连环》。九连环从此不只是玩具，也成了定情信物的意象。',
      source:'清·华广生《白雪遗音》',
      note:'“解不开的九连环”，说的是环，也是心结。' },
    { id:'miao-wuyouru', cid:'miaoxu', title:'妙绪环生',
      quote:'四名上海妇女围坐解环',
      plain:'光绪十八年（1892），吴友如画《妙绪环生》，画四名上海妇女玩九连环、小儿欲参与。',
      source:'《吴友如画宝》',
      note:'画面里的九连环，已经是市井生活的一部分。' },
    { id:'miao-culin', cid:'miaoxu', title:'一个不可靠的传说',
      quote:'诸葛亮为排遣妻子寂寞而发明',
      plain:'1876–1877 年，美国民族学家 Stewart Culin 记录九连环，并转述“诸葛亮为排遣妻子寂寞而发明”的民间传说。来源不明，不可作为信史。',
      source:'Stewart Culin, Games of the Orient',
      note:'传说很好听，但目前没有实证。' },

    { id:'ge-gray', cid:'gewu', title:'比格雷码早四百年',
      quote:'二进制反射格雷码',
      plain:'把“第 i 环在钗上”记为第 i 位，九连环的状态恰好构成二进制反射格雷码；解环就是沿格雷码单调移动。1940 年，贝尔实验室的 Frank Gray 才正式提出格雷码。',
      source:'Frank Gray, 1940；OEIS A000975',
      note:'一只铜环，提前演示了二十世纪的编码。' },
    { id:'ge-lucas', cid:'gewu', title:'Lucas 的解法',
      quote:'二进制与格雷码',
      plain:'19 世纪，法国数学家 Édouard Lucas（汉诺塔的发明者）用二进制与格雷码给出了优雅解法。',
      source:'Édouard Lucas',
      note:'汉诺塔和九连环，在数学上是一对远亲。' },
    { id:'ge-oeis', cid:'gewu', title:'A000975',
      quote:'1, 2, 5, 10, 21, 42, 85, 170, 341, …',
      plain:'从 1 环到 9 环，最少步数依次是 1、2、5、10、21、42、85、170、341。九连环共有 512 种状态。',
      source:'OEIS A000975',
      note:'把环数加一，步数大约翻倍；这就是指数的形状。' },
    { id:'ge-origin', cid:'gewu', title:'起源仍无定论',
      quote:'中国，还是西方？',
      plain:'中国明代杨慎的记载与意大利 Pacioli 的文献年代仅差数年，学界对九连环的起源地尚无定论。',
      source:'杨慎《丹铅总录》；Pacioli, De Viribus Quantitatis',
      note:'与其争第一，不如承认它可能在不同地方各自长出来。' }
  ];

  var SKINS = {
    brass: {
      name:'黄铜', swatch:'#c8a05a', unlock:'初始',
      gold:'#c8a05a', hi:'#f2dca6', lo:'#7a5a25',
      hair:'rgba(200,160,90,.18)', hair2:'rgba(200,160,90,.34)',
      grad:['#fdf0c8','#e7c583','#b9904a','#7d5c25','#e9cb8b','#5d4218'],
      rod:['#fbeec6','#d9b877','#8a672f','#c9a45c','#4c3613']
    },
    silver: {
      name:'白银', swatch:'#cfd6d2', unlock:'通关红楼 · 七连环',
      gold:'#cfd6d2', hi:'#f4f7f5', lo:'#7d8683',
      hair:'rgba(207,214,210,.18)', hair2:'rgba(207,214,210,.34)',
      grad:['#ffffff','#eef2f0','#c8d1cd','#8b9692','#f4f8f5','#666f6b'],
      rod:['#ffffff','#dfe6e2','#9aa4a0','#cdd5d1','#5f6864']
    },
    jade: {
      name:'翡翠', swatch:'#8fbf9f', unlock:'全部九局三星',
      gold:'#8fbf9f', hi:'#dff5e7', lo:'#4d7059',
      hair:'rgba(143,191,159,.20)', hair2:'rgba(143,191,159,.38)',
      grad:['#f0fff5','#c8ecd5','#86b296','#4d7059','#b7e3c6','#2f4a37'],
      rod:['#effff5','#b9ddc7','#6f917b','#a6cfb4','#34503c']
    },
    ebony: {
      name:'乌木', swatch:'#8a6340', unlock:'通关全部九局',
      gold:'#b08a5e', hi:'#e6cfa8', lo:'#5b422e',
      hair:'rgba(176,138,94,.20)', hair2:'rgba(176,138,94,.38)',
      grad:['#f0d5a8','#c49a67','#8a6340','#4e3826','#b98c5c','#2a1d13'],
      rod:['#e8c99a','#b98a58','#7a5232','#a87a4e','#2b1d12']
    }
  };
  var SKIN_ORDER = ['brass','silver','jade','ebony'];

  /* ───────────────────────── 数学 ───────────────────────── */
  function gray2bin(g) {
    var b = g, m = g >> 1;
    while (m) { b ^= m; m >>= 1; }
    return b;
  }
  function bin2gray(b) { return b ^ (b >> 1); }
  function distOf(s) { return gray2bin(s); }
  function optimal(s, t) { return Math.abs(distOf(s) - distOf(t)); }

  function canMove(s, k) {
    if (k === 1) return true;
    var mask = (1 << (k - 1)) - 1;
    return (s & mask) === (1 << (k - 2));
  }

  function nextState(s, t) {
    var ds = distOf(s), dt = distOf(t);
    if (ds === dt) return s;
    return ds > dt ? bin2gray(ds - 1) : bin2gray(ds + 1);
  }

  function flippedBit(a, b) {
    var x = a ^ b;
    if (!x) return 0;
    return Math.floor(Math.log(x) / Math.LN2) + 1;
  }

  /* ───────────────────────── 状态 ───────────────────────── */
  var N = 9;
  var ringR = 32;
  var slot = [];
  var ringEls = [];
  var hitRects = [];
  var dotEls = [];
  var visual = -1;

  var state = 0, goal = 0, moves = 0;
  var history = [];
  var levelIndex = 0;

  var elapsed = 0, timerId = null, timerStart = 0;
  var autoId = null, autoPaused = false;
  var progress = {};
  var checkpointAt = 0;
  var lastWin = null;
  var shareState = null;
  var deferredInstall = null;
  var settings = {
    muted:false, legal:false, freeMode:false, tutorialDone:false, contrast:false,
    chaptersSeen:{}, cards:{}, cardCursor:{}, skin:'brass'
  };

  var stats = {
    moves:0, undo:0, hint:0, auto:0, wins:0, time:0
  };

  var STORE = window.JW.core.store;

  var tutorial = { active:false, step:0, seq:[1,3,1,2,1], justFinished:false };

  function loadProgress() {
    var p = STORE.volume('rings').progress;
    progress = (p && typeof p === 'object' && !Array.isArray(p)) ? p : {};
  }
  function saveProgress() { STORE.save(); }

  function loadSettings() {
    var s = STORE.settings();
    if (!s || typeof s !== 'object') s = {};
    settings.muted = !!s.muted;
    settings.legal = !!s.legal;
    settings.freeMode = !!s.freeMode;
    settings.tutorialDone = !!s.tutorialDone;
    settings.contrast = (typeof s.contrast === 'boolean')
      ? s.contrast
      : !!(window.matchMedia && window.matchMedia('(prefers-contrast: more)').matches);
    settings.chaptersSeen = (s.chaptersSeen && typeof s.chaptersSeen === 'object' && !Array.isArray(s.chaptersSeen)) ? s.chaptersSeen : {};
    settings.cards = (s.cards && typeof s.cards === 'object' && !Array.isArray(s.cards)) ? s.cards : {};
    settings.cardCursor = (s.cardCursor && typeof s.cardCursor === 'object' && !Array.isArray(s.cardCursor)) ? s.cardCursor : {};
    settings.skin = (typeof s.skin === 'string' && SKINS[s.skin]) ? s.skin : 'brass';
  }
  function saveSettings() { STORE.doc().settings = settings; STORE.save(); }

  function loadStats() {
    var s = STORE.stats();
    if (!s || typeof s !== 'object') s = {};
    ['moves','undo','hint','auto','wins','time'].forEach(function (k) {
      stats[k] = (typeof s[k] === 'number' && isFinite(s[k]) && s[k] >= 0) ? s[k] : 0;
    });
  }
  var statsTimer = null;
  function saveStats() {
    if (statsTimer) { clearTimeout(statsTimer); statsTimer = null; }
    STORE.doc().stats = stats;
    STORE.save();
  }
  function scheduleStatsSave() {
    if (statsTimer) return;
    statsTimer = setTimeout(function () {
      statsTimer = null;
      STORE.doc().stats = stats;
      STORE.save();
    }, 1500);
  }

  function loadSession() {
    var s = STORE.volume('rings').session;
    if (!s || typeof s !== 'object') return null;
    var L = LEVELS[s.levelIndex];
    if (!L) return null;
    if (typeof s.state !== 'number' || (s.state | 0) !== s.state) return null;
    if (s.state < 0 || s.state >= (1 << L.n)) return null;
    if (s.state === L.goal) return null;
    if (!Array.isArray(s.history)) s.history = [];
    s.history = s.history.filter(function (v) {
      return typeof v === 'number' && v >= 0 && v < (1 << L.n);
    });
    if (typeof s.moves !== 'number' || s.moves < 0) s.moves = s.history.length;
    if (typeof s.elapsed !== 'number' || s.elapsed < 0 || !isFinite(s.elapsed)) s.elapsed = 0;
    return s;
  }
  var sessionTimer = null;
  function saveSession() {
    if (sessionTimer) { clearTimeout(sessionTimer); sessionTimer = null; }
    if (state === goal) return;
    var cur = timerId ? Date.now() - timerStart : elapsed;
    STORE.volume('rings').session = {
      levelIndex: levelIndex,
      state: state,
      moves: moves,
      elapsed: cur,
      history: history.slice(-600),
      tutorial: tutorial.active ? { step: tutorial.step } : null
    };
    STORE.save();
  }
  // 长局里每一步都写 localStorage 会拖慢低端机；合并成短节流，退出时再强制落盘。
  function scheduleSessionSave() {
    if (sessionTimer) return;
    sessionTimer = setTimeout(function () { sessionTimer = null; saveSession(); }, 500);
  }
  function flushSession() { if (sessionTimer) { clearTimeout(sessionTimer); sessionTimer = null; } saveSession(); }
  function clearSession() {
    if (sessionTimer) { clearTimeout(sessionTimer); sessionTimer = null; }
    STORE.volume('rings').session = null;
    STORE.save();
  }

  function isSkinUnlocked(id) {
    if (id === 'brass') return true;
    if (id === 'silver') return !!progress['L5'];
    if (id === 'jade') {
      return LEVELS.every(function (L) { return progress[L.id] && progress[L.id].stars === 3; });
    }
    if (id === 'ebony') {
      return LEVELS.every(function (L) { return !!progress[L.id]; });
    }
    return false;
  }

  function applySkin(id) {
    if (!SKINS[id] || !isSkinUnlocked(id)) id = 'brass';
    settings.skin = id;
    var s = SKINS[id];
    var root = document.documentElement.style;
    root.setProperty('--gold', s.gold);
    root.setProperty('--gold-hi', s.hi);
    root.setProperty('--gold-lo', s.lo);
    root.setProperty('--hair', s.hair);
    root.setProperty('--hair-strong', s.hair2);

    var bstops = document.querySelectorAll('#brassGrad stop');
    s.grad.forEach(function (c, i) { if (bstops[i]) bstops[i].setAttribute('stop-color', c); });
    var rstops = document.querySelectorAll('#rodGrad stop');
    s.rod.forEach(function (c, i) { if (rstops[i]) rstops[i].setAttribute('stop-color', c); });
    applyContrast();
  }

  function applyContrast() {
    var hc = !!settings.contrast;
    document.documentElement.classList.toggle('hc', hc);
    // --gold 系列由器色内联决定；描边色要在高对比时单独压过它。
    var s = SKINS[settings.skin] || SKINS.brass;
    var root = document.documentElement.style;
    if (hc) {
      root.setProperty('--hair', 'rgba(232,201,138,.34)');
      root.setProperty('--hair-strong', 'rgba(232,201,138,.62)');
    } else {
      root.setProperty('--hair', s.hair);
      root.setProperty('--hair-strong', s.hair2);
    }
  }

  function cardsOf(cid) {
    return CARDS.filter(function (c) { return c.cid === cid; });
  }

  function unlockedCardCount() {
    var n = 0;
    CARDS.forEach(function (c) { if (settings.cards[c.id]) n++; });
    return n;
  }

  function takeNextCard(cid) {
    var left = cardsOf(cid).filter(function (c) { return !settings.cards[c.id]; });
    if (!left.length) return null;
    var card = left[0];
    settings.cardCursor[cid] = (settings.cardCursor[cid] || 0) + 1;
    settings.cards[card.id] = true;
    saveSettings();
    return card;
  }

  function segInfo() {
    var opt = Math.max(1, optimal(LEVELS[levelIndex].start, goal));
    var total = Math.max(1, Math.ceil(opt / 40));
    var seg = Math.min(total, Math.floor(moves / 40) + 1);
    return { seg: seg, total: total, opt: opt };
  }

  /* ───────────────────────── 段落 · 过场 · 图鉴 ───────────────────────── */
  var clockPaused = false;

  function pauseClock() {
    if (!timerId) return;
    elapsed = Date.now() - timerStart;
    stopTimer();
    clockPaused = true;
  }

  function resumeClock() {
    if (!clockPaused) return;
    clockPaused = false;
    if (state !== goal && moves > 0 && !autoId) startTimer();
  }

  function maybeCheckpoint() {
    if (moves <= 0 || moves % 40 !== 0 || moves <= checkpointAt) return;
    checkpointAt = moves;
    gong();
    if (autoId || tutorial.active) return;
    var card = takeNextCard(LEVELS[levelIndex].cid);
    if (card) openCard(card);
  }

  function openCard(card) {
    if (!card) return;
    pauseClock();
    var ch = CHAPTER_BY_ID[card.cid];
    var si = segInfo();
    var segDone = Math.max(1, Math.ceil(moves / 40));
    elCardKicker.textContent = (si.total > 1 ? '第 ' + segDone + ' 段 · 小憩' : '小憩');
    elCardChapter.textContent = ch ? '第' + ch.num + '章 · ' + ch.name + ' · ' + ch.era : '';
    elCardQuote.textContent = '“' + card.quote + '”';
    elCardPlain.textContent = card.plain;
    elCardSource.textContent = '出处 · ' + card.source;
    elCardNote.textContent = card.note;
    openVeil('veilCard');
  }

  function openChapterCard(ch, seen) {
    if (!ch) return;
    pauseClock();
    elChapKicker.textContent = '第 ' + ch.num + ' 章 · ' + ch.era;
    elChapName.textContent = ch.name;
    elChapSeal.textContent = ch.seal;
    elChapGhost.textContent = ch.num;
    elChapMotif.textContent = ch.motif;
    elChapQuote.textContent = '“' + ch.quote + '”';
    elChapPlain.textContent = ch.plain;
    elChapSource.textContent = '出处 · ' + ch.source;
    elChapNote.textContent = ch.note;
    var b = document.querySelector('#veilChapter [data-act="closeChapter"]');
    if (b) b.textContent = seen ? '回到本局' : '入局';
    openVeil('veilChapter');
  }

  function maybeShowChapter(cid) {
    if (!cid || settings.chaptersSeen[cid]) return false;
    var ch = CHAPTER_BY_ID[cid];
    if (!ch) return false;
    settings.chaptersSeen[cid] = true;
    saveSettings();
    openChapterCard(ch, false);
    return true;
  }

  function renderSkins() {
    var html = '';
    SKIN_ORDER.forEach(function (id) {
      var s = SKINS[id];
      var open = isSkinUnlocked(id);
      var on = open && settings.skin === id;
      var grad = 'linear-gradient(135deg,' + s.grad[0] + ',' + s.grad[1] + ',' + s.grad[2] + ',' + s.grad[3] + ')';
      html += '<button class="skin' + (on ? ' on' : '') + '" data-skin="' + id + '"' +
        (open ? '' : ' disabled') + ' aria-pressed="' + (on ? 'true' : 'false') + '">' +
        '<span class="sw" style="background:' + grad + '"></span>' +
        '<span class="nm">' + s.name + '</span>' +
        '<span class="lk">' + (open ? (on ? '正在使用' : '可换') : '未启 · ' + s.unlock) + '</span>' +
        '</button>';
    });
    elSkinRow.innerHTML = html;
  }

  function selectSkin(id) {
    if (!SKINS[id]) return;
    if (!isSkinUnlocked(id)) {
      toast('器色「' + SKINS[id].name + '」尚未解锁：' + SKINS[id].unlock + '。');
      return;
    }
    applySkin(id);
    saveSettings();
    renderSkins();
    toast('器色已换为「' + SKINS[id].name + '」。');
  }

  function renderCodex() {
    elCodexCount.textContent = unlockedCardCount() + ' / ' + CARDS.length;
    var html = '';
    CHAPTERS.forEach(function (ch) {
      var list = cardsOf(ch.id);
      var got = list.filter(function (c) { return !!settings.cards[c.id]; }).length;
      html += '<div class="cx-group">第' + ch.num + '章 · ' + ch.name + ' · ' + ch.era +
        '<span>' + got + ' / ' + list.length + '</span></div>';
      list.forEach(function (c) {
        if (!settings.cards[c.id]) {
          html += '<div class="cx-locked"><span class="t">未得</span>' +
            '<span class="s">' + ch.name + ' · 每 40 步或解局可得</span></div>';
          return;
        }
        html += '<details class="cx-card">' +
          '<summary><span class="t">' + c.title + '</span><span class="s">' + c.source + '</span></summary>' +
          '<div class="cx-body">' +
            '<div class="q">“' + c.quote + '”</div>' +
            '<p>' + c.plain + '</p>' +
            '<div class="src">出处 · ' + c.source + '</div>' +
            '<div class="nt">' + c.note + '</div>' +
          '</div></details>';
      });
    });
    elCodexList.innerHTML = html;
  }

  function renderStats() {
    var solved = LEVELS.filter(function (L) { return !!progress[L.id]; }).length;
    var cells = [
      ['已解局', solved + '<small>/ ' + LEVELS.length + '</small>'],
      ['通关次数', stats.wins + '<small>次</small>'],
      ['总步数', stats.moves + '<small>步</small>'],
      ['撤销', stats.undo + '<small>次</small>'],
      ['提示', stats.hint + '<small>次</small>'],
      ['累计用时', fmt(stats.time)]
    ];
    var html = '<dl class="mem">';
    cells.forEach(function (c) {
      html += '<div class="mem-cell"><dt>' + c[0] + '</dt><dd>' + c[1] + '</dd></div>';
    });
    html += '</dl>';

    var recs = LEVELS.filter(function (L) { return !!progress[L.id]; }).map(function (L) {
      var r = progress[L.id];
      return '<span>' + L.name + ' <b>' + r.best + '</b> 步 · ' +
        (r.stars === 3 ? '★★★' : (r.stars === 2 ? '★★☆' : '★☆☆')) + '</span>';
    });
    if (recs.length) html += '<div class="mem-recs">' + recs.join('　') + '</div>';
    else html += '<div class="mem-empty">尚无记录。解一局，手记便有一行。</div>';

    elMem.innerHTML = html;
  }

  function openCodex() {
    pauseClock();
    renderSkins();
    renderStats();
    renderCodex();
    openVeil('veilCodex');
  }

  function closeOverlay(id) {
    closeVeil(id);
    if (id === 'veilCard' || id === 'veilChapter' || id === 'veilCodex' ||
        id === 'veilLevels' || id === 'veilHelp') resumeClock();
  }

  /* ───────────────────────── 布局 ───────────────────────── */
  function layout(n) {
    N = n;
    var sp = n <= 1 ? 0 : Math.min(182, 612 / (n - 1));
    ringR = Math.max(21, Math.min(46, sp * 0.41));
    slot = [];
    for (var i = 1; i <= n; i++) {
      slot[i] = CX + (i - (n + 1) / 2) * sp;
    }
  }

  function isTouchLayout() {
    return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
      window.innerWidth <= 880;
  }

  // 手指比鼠标粗：窄屏/触屏把热区纵向拉高，横向仍限制在本环所在的格子内，
  // 既够得着，也不会点到隔壁那只环。
  function refreshHitTargets() {
    if (!hitRects.length) return;
    var outer = ringR + Math.max(5.5, ringR * 0.27) * 0.9;
    var cell = N > 1 ? slot[2] - slot[1] : 0;
    var w = Math.min(cell || (outer * 2 + 18), outer * 2 + 18);
    var h = outer * 2 + 18;
    if (isTouchLayout()) h = Math.max(h, 128);
    hitRects.forEach(function (rect) {
      if (!rect) return;
      rect.setAttribute('x', (-w / 2).toFixed(2));
      rect.setAttribute('y', (-h / 2).toFixed(2));
      rect.setAttribute('width', w.toFixed(2));
      rect.setAttribute('height', h.toFixed(2));
      rect.setAttribute('rx', Math.min(18, w / 2).toFixed(2));
    });
  }

  function polar(r, deg) {
    var a = deg * Math.PI / 180;
    return [r * Math.cos(a), r * Math.sin(a)];
  }
  function arcPath(r, a0, a1) {
    var p0 = polar(r, a0), p1 = polar(r, a1);
    var large = (a1 - a0) > 180 ? 1 : 0;
    return 'M' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) +
           ' A' + r.toFixed(2) + ' ' + r.toFixed(2) + ' 0 ' + large + ' 1 ' +
           p1[0].toFixed(2) + ' ' + p1[1].toFixed(2);
  }
  function mk(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    return e;
  }

  function buildRing(i) {
    var g = mk('g', { 'class': 'ring', 'data-i': i });
    g.style.transformOrigin = '0 0';
    g.setAttribute('tabindex', i === 1 ? '0' : '-1');
    g.setAttribute('role', 'button');
    g.setAttribute('focusable', 'true');
    g.setAttribute('aria-keyshortcuts', 'Enter Space ArrowUp ArrowDown');
    g.setAttribute('aria-label', '第 ' + i + ' 环');
    g.setAttribute('aria-pressed', 'false');

    var inner = mk('g', { 'class': 'inner' });
    inner.style.transformOrigin = '0 0';

    var r = ringR;
    var w = Math.max(5.5, r * 0.27);

    // 命中区：跟随环移动的透明圆角矩形；尺寸由 refreshHitTargets() 按环距与触屏调整。
    var hit = mk('rect', {
      'class': 'ring-hit', x: -20, y: -20, width: 40, height: 40, rx: 8,
      fill: 'transparent', 'pointer-events': 'all'
    });
    inner.appendChild(hit);
    hitRects[i] = hit;

    // 外轮廓
    inner.appendChild(mk('circle', {
      r: r + w * 0.52, fill: 'none',
      stroke: '#2a1d08', 'stroke-opacity': '.55', 'stroke-width': 1.4
    }));
    // 环体
    var body = mk('circle', {
      'class': 'body', r: r, fill: 'none',
      stroke: 'url(#brassGrad)', 'stroke-width': w
    });
    inner.appendChild(body);
    // 内轮廓高光
    inner.appendChild(mk('circle', {
      r: r - w * 0.52, fill: 'none',
      stroke: '#fff4cf', 'stroke-opacity': '.34', 'stroke-width': 1.2
    }));
    // 高光弧
    inner.appendChild(mk('path', {
      d: arcPath(r * 0.99, 202, 258), fill: 'none',
      stroke: '#fffdf0', 'stroke-opacity': '.92',
      'stroke-width': Math.max(1.5, w * 0.26), 'stroke-linecap': 'round'
    }));
    inner.appendChild(mk('path', {
      d: arcPath(r * 0.99, 300, 322), fill: 'none',
      stroke: '#fffdf0', 'stroke-opacity': '.38',
      'stroke-width': Math.max(1, w * 0.16), 'stroke-linecap': 'round'
    }));

    g.appendChild(inner);
    g.addEventListener('click', function () { onRingClick(i); });
    g.addEventListener('keydown', onRingKey);
    g.addEventListener('focus', function () { setRoving(i); });
    return g;
  }

  function buildBoard() {
    while (ringsLayer.firstChild) ringsLayer.removeChild(ringsLayer.firstChild);
    while (animLayer.firstChild) animLayer.removeChild(animLayer.firstChild);
    ringEls = [];
    hitRects = [];
    for (var i = 1; i <= N; i++) {
      var g = buildRing(i);
      ringEls[i] = g;
      ringsLayer.appendChild(g);
      g.style.transform = 'translate(' + slot[i] + 'px,' + offY(i) + 'px)';
    }
    refreshHitTargets();
    ringsLayer.classList.remove('solved');
    buildDots();
    visual = -1;
  }

  // 点阵只建一次，之后只改文本与类，避免每步重建 innerHTML。
  function buildDots() {
    while (elDots.firstChild) elDots.removeChild(elDots.firstChild);
    dotEls = [];
    for (var i = N; i >= 1; i--) {
      var s = document.createElement('span');
      s.textContent = '○';
      s.className = 'off';
      elDots.appendChild(s);
      dotEls[i] = s;
    }
  }

  function offY(i) {
    return OFF_Y + ((i * 37) % 11) - 5;
  }

  function isOn(s, i) { return (s >> (i - 1)) & 1 ? 1 : 0; }

  /* ───────────────────────── 渲染 ───────────────────────── */
  // 动画层与环架之间搬动节点会让焦点掉到 body；键盘玩家会因此断掉。
  function moveToLayer(g, parent) {
    var hadFocus = document.activeElement === g;
    if (g.parentNode !== parent) parent.appendChild(g);
    if (hadFocus) {
      try { g.focus({ preventScroll: true }); } catch (e) { try { g.focus(); } catch (e2) {} }
    }
  }

  function place(i, on, animate) {
    var g = ringEls[i];
    if (!g) return;
    var x = slot[i];
    var to = on ? RING_Y : offY(i);

    if (g._anim) { try { g._anim.cancel(); } catch (e) {} g._anim = null; }

    if (!animate || REDUCE) {
      g.style.transform = 'translate(' + x + 'px,' + to + 'px)';
      moveToLayer(g, ringsLayer);
      return;
    }

    var from = on ? offY(i) : RING_Y;
    var lift = RING_Y - ringR * 1.65;
    moveToLayer(g, animLayer);

    var kf = on
      ? [
          { transform: 'translate(' + x + 'px,' + from + 'px) rotate(0deg)' },
          { transform: 'translate(' + x + 'px,' + lift + 'px) rotate(11deg)', offset: .46 },
          { transform: 'translate(' + x + 'px,' + (to - 4) + 'px) rotate(-2deg)', offset: .84 },
          { transform: 'translate(' + x + 'px,' + to + 'px) rotate(0deg)' }
        ]
      : [
          { transform: 'translate(' + x + 'px,' + from + 'px) rotate(0deg)' },
          { transform: 'translate(' + x + 'px,' + lift + 'px) rotate(-11deg)', offset: .46 },
          { transform: 'translate(' + x + 'px,' + (to + 5) + 'px) rotate(2deg)', offset: .84 },
          { transform: 'translate(' + x + 'px,' + to + 'px) rotate(0deg)' }
        ];

    var a = g.animate(kf, {
      duration: autoId ? 150 : 380,
      easing: 'cubic-bezier(.32,.9,.28,1)'
    });
    g._anim = a;
    a.onfinish = function () {
      g._anim = null;
      if (!g.isConnected) return;
      g.style.transform = 'translate(' + x + 'px,' + to + 'px)';
      moveToLayer(g, ringsLayer);
    };
    a.oncancel = function () {
      g._anim = null;
      if (!g.isConnected) return;
      g.style.transform = 'translate(' + x + 'px,' + to + 'px)';
      moveToLayer(g, ringsLayer);
    };
  }

  function syncVisual(animate) {
    for (var i = 1; i <= N; i++) {
      var on = isOn(state, i);
      var wasOn = isOn(visual, i);
      if (visual === -1 || on !== wasOn) place(i, on, !!animate);
    }
    visual = state;
  }

  function refreshHud() {
    var opt = optimal(LEVELS[levelIndex].start, goal);
    var left = optimal(state, goal);
    elMoves.textContent = moves;
    elOpt.textContent = opt;
    elDist.textContent = left;

    var total = Math.max(1, opt);
    var pct = Math.round(Math.max(0, Math.min(1, 1 - left / total)) * 100);
    elPct.textContent = pct + '%';
    elProg.style.width = pct + '%';

    var si = segInfo();
    if (si.total > 1) {
      elSegSep.hidden = false;
      elSeg.hidden = false;
      elSeg.innerHTML = '第 <b>' + si.seg + '</b> / ' + si.total + ' 段';
    } else {
      elSegSep.hidden = true;
      elSeg.hidden = true;
    }

    for (var i = N; i >= 1; i--) {
      var d = dotEls[i];
      if (!d) continue;
      var lit = !!isOn(state, i);
      d.textContent = lit ? '●' : '○';
      d.classList.toggle('off', !lit);
    }
    updateRingA11y();
    refreshLegal();
  }

  function ringLabel(i) {
    var on = !!isOn(state, i);
    var movable = state !== goal && canMove(state, i);
    return '第 ' + i + ' 环，' + (on ? '在钗上' : '不在钗上') + (movable ? '，当前可动' : '');
  }

  function updateRingA11y() {
    for (var i = 1; i <= N; i++) {
      var g = ringEls[i];
      if (!g) continue;
      g.setAttribute('aria-label', ringLabel(i));
      g.setAttribute('aria-pressed', isOn(state, i) ? 'true' : 'false');
    }
  }

  function refreshLegal() {
    for (var i = 1; i <= N; i++) {
      var g = ringEls[i];
      if (!g) continue;
      var ok = settings.legal && !tutorial.active && state !== goal && canMove(state, i);
      g.classList.toggle('legal', !!ok);
    }
  }

  /* ───────────────────────── 三环引导 ───────────────────────── */
  var CN_NUM = ['一','二','三','四','五','六','七','八','九'];
  var TUTORIAL_TEXT = [
    '第 <em>1</em> 环随时可动。点它，让它落下。',
    '现在动第 <em>3</em> 环：第 2 环在钗上，第 1 环不在。',
    '又轮到第 <em>1</em> 环，让它回到钗上。',
    '再动第 <em>2</em> 环：第 1 环在钗上，前面没有环挡着。',
    '最后动第 <em>1</em> 环。三环就解开了。'
  ];
  var nudgeTimer = null;

  function refreshTutorial() {
    if (!tutorial.active) {
      elCoach.hidden = true;
      for (var i = 1; i <= N; i++) {
        if (!ringEls[i]) continue;
        ringEls[i].classList.remove('coach-dim');
        ringEls[i].classList.remove('coach-target');
      }
      refreshLegal();
      return;
    }
    var step = Math.min(tutorial.step, tutorial.seq.length - 1);
    var exp = tutorial.seq[step];
    elCoach.hidden = false;
    elCoachNum.textContent = CN_NUM[step] || '五';
    elCoachMsg.innerHTML = TUTORIAL_TEXT[step];
    for (var k = 1; k <= N; k++) {
      if (!ringEls[k]) continue;
      ringEls[k].classList.toggle('coach-dim', k !== exp);
      ringEls[k].classList.toggle('coach-target', k === exp);
    }
    refreshLegal();
  }

  function nudgeTutorial(msg) {
    elCoachMsg.innerHTML = msg;
    clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(refreshTutorial, 1900);
  }

  function beginTutorial() {
    tutorial.active = true;
    tutorial.step = 0;
    tutorial.justFinished = false;
    settings.tutorialDone = false;
    saveSettings();
    refreshTutorial();
  }

  function finishTutorial() {
    if (!tutorial.active) return;
    tutorial.active = false;
    tutorial.step = 0;
    tutorial.justFinished = true;
    settings.tutorialDone = true;
    saveSettings();
    clearTimeout(nudgeTimer);
    refreshTutorial();
    saveSession();
  }

  function skipTutorial() {
    if (!tutorial.active) return;
    tutorial.active = false;
    tutorial.step = 0;
    settings.tutorialDone = true;
    saveSettings();
    clearTimeout(nudgeTimer);
    refreshTutorial();
    saveSession();
    toast('已跳过引导。第 1 环随时可动，其余须隔一环。');
  }

  function startTutorial() {
    closeVeil('veilHelp');
    closeVeil('veilLevels');
    closeVeil('veilWin');
    loadLevel(0);
    beginTutorial();
    saveSession();
  }

  /* ───────────────────────── 计时 ───────────────────────── */
  function fmt(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function tick() {
    elapsed = Date.now() - timerStart;
    elTime.textContent = fmt(elapsed);
  }
  function startTimer() {
    if (timerId) return;
    timerStart = Date.now() - elapsed;
    timerId = setInterval(tick, 250);
  }
  function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }
  function resetTimer() {
    stopTimer(); elapsed = 0; elTime.textContent = '00:00';
  }

  /* ───────────────────────── 提示 ───────────────────────── */
  var toastTimer = null;
  function toast(msg) {
    elToast.innerHTML = msg;
    elToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { elToast.classList.remove('show'); }, 2600);
  }
  function hideToast() {
    clearTimeout(toastTimer);
    elToast.classList.remove('show');
  }

  // 移动端触感只作补充，不作为唯一反馈；桌面浏览器无此 API 时静默跳过。
  function haptic(pattern) {
    if (!navigator.vibrate) return;
    // 没有真实用户手势时，浏览器会拒绝并把错误写进控制台；先挡住。
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try { navigator.vibrate(pattern); } catch (e) {}
  }

  function reasonOf(i) {
    if (i === 1) return '第 1 环随时可以动。';
    return '要动第 ' + i + ' 环，须第 ' + (i - 1) + ' 环在钗上，且第 1 至 ' + (i - 2) + ' 环都不在。';
  }

  function clearHints() {
    for (var i = 1; i <= N; i++) if (ringEls[i]) ringEls[i].classList.remove('hint');
  }

  function shakeRing(i) {
    var g = ringEls[i];
    if (!g) return;
    g.classList.remove('shake');
    void g.offsetWidth;
    g.classList.add('shake');
    setTimeout(function () { g.classList.remove('shake'); }, 400);
  }

  var announceTimer = null;
  function announce(msg) {
    if (!elSr) return;
    clearTimeout(announceTimer);
    elSr.textContent = '';
    announceTimer = setTimeout(function () { elSr.textContent = msg; }, 40);
  }

  // 环间只保留一个 tabindex=0，Tab 进得来，方向键在环间走。
  function setRoving(i) {
    for (var k = 1; k <= N; k++) {
      if (ringEls[k]) ringEls[k].setAttribute('tabindex', k === i ? '0' : '-1');
    }
  }

  function focusRing(i) {
    i = Math.max(1, Math.min(N, i));
    var g = ringEls[i];
    if (!g) return;
    setRoving(i);
    try { g.focus({ preventScroll: true }); } catch (e) { g.focus(); }
  }

  function ringAction(i, wantOn) {
    if (autoId) stopAuto(true);
    if (state === goal) return;
    if (!!isOn(state, i) === wantOn) {
      var msg = '第 ' + i + ' 环' + (wantOn ? '已在钗上。' : '已不在钗上。');
      toast(msg);
      announce(msg);
      return;
    }
    onRingClick(i);
  }

  function onRingKey(e) {
    var i = parseInt(this.getAttribute('data-i'), 10);
    if (!i) return;
    var k = e.key;
    if (k === 'ArrowLeft') { e.preventDefault(); focusRing(i - 1); return; }
    if (k === 'ArrowRight') { e.preventDefault(); focusRing(i + 1); return; }
    if (k === 'Home') { e.preventDefault(); focusRing(1); return; }
    if (k === 'End') { e.preventDefault(); focusRing(N); return; }
    if (k === 'ArrowUp') { e.preventDefault(); ringAction(i, true); return; }
    if (k === 'ArrowDown') { e.preventDefault(); ringAction(i, false); return; }
    if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
      e.preventDefault();
      if (autoId) stopAuto(true);
      onRingClick(i);
    }
  }

  function onRingClick(i) {
    if (autoId) stopAuto(true);
    if (state === goal) return;

    if (tutorial.active) {
      var exp = tutorial.seq[tutorial.step];
      if (i !== exp) {
        shakeRing(i);
        beep(i, false, true);
        haptic(16);
        nudgeTutorial('这一步先动第 <em>' + exp + '</em> 环。');
        announce('这一步先动第 ' + exp + ' 环。');
        return;
      }
      if (!canMove(state, i)) { shakeRing(i); return; }
      doMove(i);
      return;
    }

    if (!canMove(state, i)) {
      shakeRing(i);
      beep(i, false, true);
      haptic(16);
      toast(reasonOf(i));
      announce(reasonOf(i));
      return;
    }
    doMove(i);
  }

  /* ───────────────────────── 走子 ───────────────────────── */
  function doMove(i, fromAuto) {
    history.push(state);
    state ^= (1 << (i - 1));
    moves++;
    startTimer();
    clearHints();
    syncVisual(true);
    var nowOn = isOn(state, i);
    beep(i, nowOn);
    refreshHud();

    if (!fromAuto) {
      stats.moves++;
      scheduleStatsSave();
      announce('第 ' + i + ' 环' + (nowOn ? '上' : '下') + '。距解 ' + optimal(state, goal) + ' 步。');
    }

    if (tutorial.active) {
      tutorial.step++;
      if (tutorial.step >= tutorial.seq.length) finishTutorial();
      else refreshTutorial();
    }

    scheduleSessionSave();
    if (state === goal) { win(); return; }
    maybeCheckpoint();
  }

  function undo() {
    if (!history.length) { toast('已是本局开头。'); announce('已是本局开头。'); return; }
    if (autoId) stopAuto(true);
    state = history.pop();
    moves = Math.max(0, moves - 1);
    stats.undo++;
    scheduleStatsSave();
    clearHints();
    if (tutorial.active && tutorial.step > 0) tutorial.step--;
    syncVisual(true);
    refreshHud();
    refreshTutorial();
    if (state !== goal && moves > 0) startTimer();
    announce('已撤销。第 ' + moves + ' 步，距解 ' + optimal(state, goal) + ' 步。');
    scheduleSessionSave();
  }

  function resetLevel() {
    if (autoId) stopAuto(true);
    var L = LEVELS[levelIndex];
    state = L.start;
    moves = 0;
    history = [];
    clearHints();
    resetTimer();
    if (tutorial.active) tutorial.step = 0;
    syncVisual(false);
    refreshHud();
    refreshTutorial();
    saveSession();
    announce('本局已重置。距解 ' + optimal(state, goal) + ' 步。');
  }

  function winFlourish() {
    if (REDUCE) return;
    ringsLayer.classList.remove('solved');
    void ringsLayer.offsetWidth;
    ringsLayer.classList.add('solved');
    setTimeout(function () { ringsLayer.classList.remove('solved'); }, 1800);
  }

  // 胜利收束：宫—角—徵三音，短，不盖过画面。
  function winChime() {
    if (settings.muted) return;
    try {
      if (!ensureAudio()) return;
      var t = actx.currentTime;
      [523.25, 659.25, 783.99].forEach(function (f, k) {
        var o = actx.createOscillator();
        var g = actx.createGain();
        var at = t + k * 0.15;
        o.type = k === 2 ? 'triangle' : 'sine';
        o.frequency.setValueAtTime(f, at);
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.036, at + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
        o.connect(g).connect(actx.destination);
        o.start(at);
        o.stop(at + 0.95);
      });
    } catch (e) {}
  }

  function win() {
    if (timerId) elapsed = Date.now() - timerStart;
    stopTimer();
    if (autoId) stopAuto(true);
    clearSession();
    var L = LEVELS[levelIndex];
    var opt = optimal(L.start, L.goal);
    var stars = moves <= opt ? 3 : (moves <= Math.ceil(opt * 1.3) ? 2 : 1);

    lastWin = {
      id: L.id, name: L.name, chapter: L.chapter, cid: L.cid,
      moves: moves, opt: opt, stars: stars, elapsed: elapsed
    };

    stats.wins++;
    stats.time += Math.max(0, elapsed);
    saveStats();
    winFlourish();
    winChime();
    haptic([20, 50, 30]);

    var before = {};
    SKIN_ORDER.forEach(function (id) { before[id] = isSkinUnlocked(id); });

    var rec = progress[L.id];
    if (!rec || moves < rec.best) rec = { best: moves, stars: stars };
    else if (stars > rec.stars) rec.stars = stars;
    progress[L.id] = rec;
    saveProgress();

    // 解局得一张史料；三星再得一张。短局（三、四环）也能集齐本章。
    var gained = [];
    var c1 = takeNextCard(L.cid);
    if (c1) gained.push(c1.title);
    if (stars === 3) {
      var c2 = takeNextCard(L.cid);
      if (c2) gained.push(c2.title);
    }

    var newly = [];
    SKIN_ORDER.forEach(function (id) {
      if (id !== 'brass' && !before[id] && isSkinUnlocked(id)) newly.push(SKINS[id].name);
    });

    document.getElementById('winChapter').textContent = L.chapter;
    document.getElementById('winTitle').textContent = L.name + ' · 环解';
    document.getElementById('winMoves').textContent = moves;
    document.getElementById('winOpt').textContent = opt;
    document.getElementById('winTime').textContent = fmt(elapsed);
    document.getElementById('winStars').innerHTML =
      [0,1,2].map(function (k) {
        return '<span class="' + (k < stars ? '' : 'dim') + '">★</span>';
      }).join('');

    elWinVerdict.textContent = stars === 3
      ? '纤毫不差，正合最短之数。'
      : (stars === 2 ? '环解，然略绕数步。' : '环解，然去短径尚远。');

    var nextL = LEVELS[levelIndex + 1];
    var bits = [];
    if (nextL) {
      bits.push(nextL.cid !== L.cid
        ? '下一章：' + CHAPTER_BY_ID[nextL.cid].name + ' · ' + CHAPTER_BY_ID[nextL.cid].era
        : '下一局：' + nextL.name);
    } else {
      bits.push('九局已尽，铜环仍在案上。');
    }
    if (gained.length) bits.push('得史料《' + gained.join('》《') + '》');
    if (newly.length) bits.push('器色「' + newly.join('」「') + '」已解锁');
    bits.push('史料 ' + unlockedCardCount() + ' / ' + CARDS.length + ' · 点「图鉴」可读');
    elWinNote.innerHTML = bits.join('<br>');

    if (elBtnNext) {
      elBtnNext.textContent = nextL
        ? (nextL.cid !== L.cid ? '下一章' : '下一局')
        : '回到三连环';
    }

    openVeil('veilWin');
    announce('环解。用了 ' + moves + ' 步，最优 ' + opt + ' 步，' + (stars === 3 ? '三星。' : (stars === 2 ? '二星。' : '一星。')));
    if (tutorial.justFinished) {
      tutorial.justFinished = false;
      toast('你已经会解九连环了。往后的局，只是更长。');
    } else if (stars === 3) {
      toast('一步未错。');
    }
  }

  /* ───────────────────────── 分享卡片 ───────────────────────── */
  function cardRoundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function cardLerp(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ];
  }

  function cardRing(c, cx, cy, r, w) {
    var stops = [
      [0.00, [93, 66, 24]],
      [0.12, [125, 92, 37]],
      [0.26, [233, 203, 139]],
      [0.36, [253, 240, 200]],
      [0.52, [185, 144, 74]],
      [0.68, [93, 66, 24]],
      [0.82, [233, 203, 139]],
      [1.00, [93, 66, 24]]
    ];
    c.save();
    c.shadowColor = 'rgba(0,0,0,.7)';
    c.shadowBlur = 36;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.lineWidth = w + 7;
    c.strokeStyle = 'rgba(0,0,0,.5)';
    c.stroke();
    c.restore();

    var steps = 180;
    var step = Math.PI * 2 / steps;
    for (var i = 0; i < steps; i++) {
      var t = i / steps;
      var col = stops[stops.length - 1][1];
      for (var j = 1; j < stops.length; j++) {
        if (t <= stops[j][0]) {
          var t0 = stops[j - 1][0], c0 = stops[j - 1][1];
          var t1 = stops[j][0], c1 = stops[j][1];
          col = cardLerp(c0, c1, (t - t0) / (t1 - t0));
          break;
        }
      }
      var a0 = -Math.PI / 2 + t * Math.PI * 2;
      c.beginPath();
      c.arc(cx, cy, r, a0, a0 + step * 1.04);
      c.lineWidth = w;
      c.strokeStyle = 'rgb(' + col.join(',') + ')';
      c.stroke();
    }

    c.beginPath();
    c.arc(cx, cy, r + w / 2, 0, Math.PI * 2);
    c.lineWidth = 1.5;
    c.strokeStyle = 'rgba(35,23,8,.7)';
    c.stroke();
    c.beginPath();
    c.arc(cx, cy, r - w / 2, 0, Math.PI * 2);
    c.lineWidth = 1.5;
    c.strokeStyle = 'rgba(255,244,207,.32)';
    c.stroke();

    c.lineCap = 'round';
    c.beginPath();
    c.arc(cx, cy, r, Math.PI * 1.08, Math.PI * 1.44);
    c.lineWidth = Math.max(3, w * 0.24);
    c.strokeStyle = 'rgba(255,253,240,.92)';
    c.stroke();
    c.beginPath();
    c.arc(cx, cy, r, Math.PI * 1.64, Math.PI * 1.82);
    c.lineWidth = Math.max(2, w * 0.13);
    c.strokeStyle = 'rgba(255,253,240,.34)';
    c.stroke();
  }

  function cardRod(c, x0, x1, y, w) {
    var g = c.createLinearGradient(0, y - w / 2, 0, y + w / 2);
    g.addColorStop(0, '#fbeec6');
    g.addColorStop(0.28, '#d9b877');
    g.addColorStop(0.55, '#8a672f');
    g.addColorStop(0.78, '#c9a45c');
    g.addColorStop(1, '#4c3613');
    c.fillStyle = g;
    cardRoundRect(c, x0, y - w / 2, x1 - x0, w, w / 2);
    c.fill();
  }

  function cardSpaced(c, text, x, y, spacing, color, font) {
    c.font = font;
    c.fillStyle = color;
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    for (var i = 0; i < text.length; i++) {
      c.fillText(text.charAt(i), x, y);
      x += c.measureText(text.charAt(i)).width + spacing;
    }
  }

  function starName(n) {
    return n === 3 ? '三星' : (n === 2 ? '二星' : '一星');
  }

  function makeShareCard() {
    var rec = lastWin;
    if (!rec) return null;
    var W = 1200, H = 630;
    var cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    var c = cv.getContext('2d');
    if (!c) return null;

    var bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#181c15');
    bg.addColorStop(0.55, '#11140e');
    bg.addColorStop(1, '#0b0d09');
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);

    var moss = c.createRadialGradient(0, 0, 20, 0, 0, 760);
    moss.addColorStop(0, 'rgba(125,148,129,.12)');
    moss.addColorStop(1, 'rgba(125,148,129,0)');
    c.fillStyle = moss;
    c.fillRect(0, 0, W, H);

    var glow = c.createRadialGradient(870, 300, 20, 870, 300, 500);
    glow.addColorStop(0, 'rgba(200,160,90,.20)');
    glow.addColorStop(0.55, 'rgba(200,160,90,.06)');
    glow.addColorStop(1, 'rgba(200,160,90,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, W, H);

    var seed = 29;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (var d = 0; d < 42; d++) {
      var dx = 620 + rnd() * 540;
      var dy = 70 + rnd() * 480;
      c.globalAlpha = 0.05 + rnd() * 0.14;
      c.fillStyle = '#e8c98a';
      c.beginPath();
      c.arc(dx, dy, 0.6 + rnd() * 1.5, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    var vig = c.createRadialGradient(600, 315, 250, 600, 315, 760);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,.5)');
    c.fillStyle = vig;
    c.fillRect(0, 0, W, H);

    c.save();
    c.translate(880, 528);
    c.scale(1, 0.24);
    var sh = c.createRadialGradient(0, 0, 0, 0, 0, 300);
    sh.addColorStop(0, 'rgba(0,0,0,.72)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sh;
    c.beginPath();
    c.arc(0, 0, 300, 0, Math.PI * 2);
    c.fill();
    c.restore();

    cardRod(c, 660, 1122, 272, 15);
    cardRing(c, 880, 325, 172, 42);
    cardRod(c, 660, 1122, 294, 15);

    cardSpaced(c, '中国古典益智玩具', 78, 121, 7, '#a99770',
      '400 18px "Songti SC","SimSun",serif');

    c.font = '400 104px "KaiTi","STKaiti","SimSun",serif';
    c.fillStyle = '#e6ddc8';
    c.textAlign = 'left';
    c.fillText('解连环', 74, 258);

    c.strokeStyle = 'rgba(200,160,90,.45)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(78, 296);
    c.lineTo(430, 296);
    c.stroke();
    c.strokeStyle = '#c0432f';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(78, 296);
    c.lineTo(148, 296);
    c.stroke();

    c.font = '400 27px "KaiTi","STKaiti","SimSun",serif';
    c.fillStyle = '#f2dca6';
    c.fillText(rec.name + ' · ' + starName(rec.stars), 78, 344);

    c.font = '400 18px "Songti SC","SimSun",serif';
    c.fillStyle = '#9a927f';
    c.fillText(rec.moves + ' 步 · 最优 ' + rec.opt + ' 步 · ' + fmt(rec.elapsed), 78, 384);

    c.font = '400 32px "SimSun","Songti SC",serif';
    for (var s = 0; s < 3; s++) {
      c.fillStyle = s < rec.stars ? '#c8a05a' : '#3b4136';
      c.fillText('★', 78 + s * 38, 439);
    }

    c.font = '400 20px "KaiTi","STKaiti","SimSun",serif';
    c.fillStyle = '#cfc7b4';
    c.fillText(rec.stars === 3 ? '纤毫不差，正合最短之数。'
      : (rec.stars === 2 ? '环解，然略绕数步。' : '环解，然去短径尚远。'), 78, 480);

    c.fillStyle = '#c0432f';
    cardRoundRect(c, 78, 516, 58, 58, 3);
    c.fill();
    c.font = '400 38px "KaiTi","STKaiti","SimSun",serif';
    c.fillStyle = '#f8efe0';
    var nw = c.measureText('九').width;
    c.fillText('九', 78 + (58 - nw) / 2, 559);

    c.font = '400 22px "KaiTi","STKaiti","SimSun",serif';
    c.fillStyle = '#c8b184';
    c.fillText('环环相扣，步步可数。', 154, 543);
    c.font = '400 14px "Songti SC","SimSun",serif';
    c.fillStyle = '#7e7767';
    c.fillText('点开即玩 · 断网亦可', 154, 570);

    c.textAlign = 'right';
    c.font = '400 14px "Songti SC","SimSun",serif';
    c.fillStyle = '#6f695c';
    var host = /^https?:/.test(location.protocol) ? location.host : '本地双击 index.html';
    c.fillText(host, 1122, 591);

    return cv;
  }

  function shareCaption(rec) {
    var t = '我用 ' + rec.moves + ' 步解开了《解连环》的「' + rec.name + '」';
    t += rec.stars === 3 ? '，一步未错，三星。' : '，' + starName(rec.stars) + '。';
    t += '最优 ' + rec.opt + ' 步 · 用时 ' + fmt(rec.elapsed) + '。';
    if (/^https?:/.test(location.protocol)) t += '\n' + location.origin + location.pathname;
    return t;
  }

  function openShare() {
    if (!lastWin) { toast('先解一局，再来分享。'); return; }
    var cv = makeShareCard();
    if (!cv) { toast('分享卡片生成失败。'); return; }

    var filename = 'jielianhuan-' + lastWin.id + '.png';
    var caption = shareCaption(lastWin);
    shareState = { blob: null, file: null, dataURL: '', filename: filename, caption: caption };

    try {
      shareState.dataURL = cv.toDataURL('image/png');
      document.getElementById('shareImg').src = shareState.dataURL;
    } catch (e) {}
    document.getElementById('shareCap').textContent = caption;

    var sys = document.getElementById('btnSystemShare');
    if (sys) sys.hidden = true;

    try {
      cv.toBlob(function (blob) {
        if (!blob) return;
        shareState.blob = blob;
        try { shareState.file = new File([blob], filename, { type: 'image/png' }); } catch (e) {}
        if (sys && shareState.file && navigator.canShare && navigator.canShare({ files: [shareState.file] })) {
          sys.hidden = false;
        }
      }, 'image/png');
    } catch (e) {}

    openVeil('veilShare');
    hideToast();
    announce('分享卡片已生成。可保存图片或复制配文。');
  }

  function downloadBlob(blob, name) {
    if (!blob) return false;
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    return true;
  }

  function saveShareCard() {
    if (!shareState) { toast('没有可保存的卡片。'); return; }
    var ok = false;
    if (shareState.blob) ok = downloadBlob(shareState.blob, shareState.filename);
    else if (shareState.dataURL) {
      var a = document.createElement('a');
      a.href = shareState.dataURL;
      a.download = shareState.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      ok = true;
    }
    toast(ok ? '分享卡片已存下。' : '保存失败，请长按图片另存。');
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () {
        return true;
      }).catch(function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function copyShareCaption() {
    if (!shareState) { toast('没有可复制的配文。'); return; }
    copyText(shareState.caption).then(function (ok) {
      toast(ok ? '配文已复制。' : '复制失败，请手动选择配文。');
    });
  }

  function nativeShare() {
    if (!shareState || !shareState.file || !navigator.share) { saveShareCard(); return; }
    navigator.share({
      files: [shareState.file],
      title: '解连环 · ' + (lastWin ? lastWin.name : '九连环'),
      text: shareState.caption
    }).catch(function (err) {
      if (err && err.name === 'AbortError') return;
      saveShareCard();
    });
  }

  /* ───────────────────────── 安装与离线 ───────────────────────── */
  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  }

  function updatePwaState() {
    var el = document.getElementById('pwaState');
    if (!el) return;
    var secure = location.protocol === 'https:' ||
      location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    var controlled = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
    var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (location.protocol === 'file:') {
      el.textContent = '本地文件模式 · 无需联网，双击即玩。';
    } else if (isStandalone()) {
      el.textContent = controlled ? '已安装 · 离线缓存就绪，断网也能打开。' : '已安装 · 正在准备离线缓存…';
    } else if (!secure) {
      el.textContent = '此地址不支持离线缓存（需 HTTPS 或 localhost）。';
    } else if (iOS) {
      el.textContent = controlled
        ? '离线缓存已就绪 · 用浏览器「分享 → 添加到主屏幕」安装。'
        : '正在准备离线缓存…（浏览器「分享 → 添加到主屏幕」）';
    } else if (controlled) {
      el.textContent = '离线缓存已就绪 · 断网也能打开。';
    } else {
      el.textContent = '正在准备离线缓存…（联网打开一次即可）';
    }
  }

  function installApp() {
    if (!deferredInstall) {
      toast('请用浏览器菜单「安装应用 / 添加到主屏幕」。');
      return;
    }
    var prompt = deferredInstall;
    deferredInstall = null;
    var btn = document.getElementById('btnInstall');
    if (btn) btn.hidden = true;
    try { prompt.prompt(); } catch (e) {
      toast('请用浏览器菜单安装。');
      return;
    }
    prompt.userChoice.then(function (choice) {
      if (choice && choice.outcome === 'accepted') toast('正在安装…');
      else toast('可随时从「说明」再安装。');
      updatePwaState();
    }).catch(function () {});
  }

  function registerPWA() {
    updatePwaState();

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredInstall = e;
      var btn = document.getElementById('btnInstall');
      if (btn) btn.hidden = false;
      updatePwaState();
    });

    window.addEventListener('appinstalled', function () {
      deferredInstall = null;
      var btn = document.getElementById('btnInstall');
      if (btn) btn.hidden = true;
      updatePwaState();
      toast('已安装 · 断网也能打开。');
    });

    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' }).then(function (reg) {
        updatePwaState();
        function offerUpdate() {
          if (navigator.serviceWorker.controller) toast('新版本已备好，下次打开生效。');
        }
        if (reg.waiting) offerUpdate();
        reg.addEventListener('updatefound', function () {
          var nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', function () {
            if (nw.state === 'installed') offerUpdate();
          });
        });
      }).catch(function () { updatePwaState(); });

      navigator.serviceWorker.addEventListener('controllerchange', updatePwaState);
    }, { once: true });
  }

  /* ───────────────────────── 演示 ───────────────────────── */
  function stopAuto(silent) {
    if (autoId) { clearInterval(autoId); autoId = null; }
    setAutoLabel(false);
    if (!silent) toast('演示已停。');
  }

  function setAutoLabel(on) {
    var btn = document.querySelector('[data-act="auto"]');
    if (btn) {
      btn.classList.toggle('on', !!on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function toggleAuto() {
    if (autoId) { stopAuto(); return; }
    if (tutorial.active) { toast('先跟着引导走完，或点「跳过」。'); return; }
    if (state === goal) { toast('这一局已经解开了。'); return; }
    autoPaused = false;
    stats.auto++;
    scheduleStatsSave();
    var btn = document.querySelector('[data-act="auto"]');
    btn.classList.add('on');
    btn.setAttribute('aria-pressed', 'true');
    var speed = N >= 7 ? 95 : (N >= 5 ? 160 : 260);
    autoId = setInterval(function () {
      if (state === goal) { stopAuto(true); return; }
      var nx = nextState(state, goal);
      var i = flippedBit(state, nx);
      if (!i) { stopAuto(true); return; }
      doMove(i, true);
    }, speed);
    toast('正在按最短解演示。');
  }

  /* ───────────────────────── 音 ───────────────────────── */
  var actx = null;
  var PENTA = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99];

  function ensureAudio() {
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }

  function beep(i, on, quiet) {
    if (settings.muted) return;
    try {
      if (!ensureAudio()) return;
      var t = actx.currentTime;
      var idx = Math.max(0, Math.min(PENTA.length - 1, i - 1));
      var f = PENTA[idx];

      function voice(type, freq, gain, dur) {
        var o = actx.createOscillator();
        var g = actx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(actx.destination);
        o.start(t);
        o.stop(t + dur + 0.03);
      }

      if (quiet) {
        voice('sine', f * 0.5, 0.032, 0.18);
        return;
      }
      if (on) {
        // 上环：泛音明亮，像铜环刚刚离钗
        voice('sine', f, 0.042, 0.72);
        voice('sine', f * 2.005, 0.03, 0.5);
        voice('sine', f * 3.008, 0.014, 0.34);
        voice('triangle', f * 4.01, 0.007, 0.22);
      } else {
        // 下环：实音低沉，像环落回案面
        voice('triangle', f, 0.07, 0.34);
        voice('sine', f * 0.5, 0.028, 0.4);
        voice('sine', f * 1.002, 0.02, 0.26);
      }
    } catch (e) {}
  }

  // 每 40 步一声低音磬：不打断，只提醒「又过一段」。
  function gong() {
    if (settings.muted) return;
    try {
      if (!ensureAudio()) return;
      var t = actx.currentTime;
      function voice(type, freq, gain, dur) {
        var o = actx.createOscillator();
        var g = actx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(actx.destination);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
      voice('sine', 130.81, 0.05, 1.9);
      voice('sine', 196.00, 0.03, 1.5);
      voice('triangle', 98.00, 0.038, 2.2);
    } catch (e) {}
  }

  function syncSoundButton() {
    elBtnSound.textContent = settings.muted ? '静' : '音';
    elBtnSound.classList.toggle('on', !settings.muted);
    elBtnSound.setAttribute('aria-pressed', settings.muted ? 'false' : 'true');
    elBtnSound.setAttribute('aria-label', settings.muted ? '声音已关，点击开启' : '声音已开，点击静音');
  }

  function toggleSound() {
    settings.muted = !settings.muted;
    saveSettings();
    syncSoundButton();
    if (!settings.muted) beep(5, true);
    toast(settings.muted ? '已静音。' : '已开声。');
  }

  function syncToggles() {
    elBtnLegal.classList.toggle('on', settings.legal);
    elBtnLegal.setAttribute('aria-pressed', settings.legal ? 'true' : 'false');
    if (elBtnContrast) {
      elBtnContrast.classList.toggle('on', !!settings.contrast);
      elBtnContrast.setAttribute('aria-pressed', settings.contrast ? 'true' : 'false');
      elBtnContrast.setAttribute('aria-label', settings.contrast ? '高对比模式已开，点击关闭' : '高对比模式已关，点击开启');
    }
    syncSoundButton();
  }

  function toggleContrast() {
    settings.contrast = !settings.contrast;
    saveSettings();
    applyContrast();
    syncToggles();
    toast(settings.contrast ? '已开高对比。' : '已恢复常规对比。');
  }

  function toggleLegal() {
    settings.legal = !settings.legal;
    saveSettings();
    syncToggles();
    refreshLegal();
    toast(settings.legal ? '已标出当前可动的环。' : '已收起可动环标记。');
  }

  function hintAction() {
    if (autoId) stopAuto(true);
    var nx = nextState(state, goal);
    var i = flippedBit(state, nx);
    if (!i) { toast('已经解开了。'); return; }
    clearHints();
    if (ringEls[i]) ringEls[i].classList.add('hint');
    setTimeout(clearHints, 3600);
    beep(i, true);
    stats.hint++;
    scheduleStatsSave();
    toast('试动第 <b style="color:var(--gold-hi);font-weight:400">' + i + '</b> 环。' + reasonOf(i));
    announce('试动第 ' + i + ' 环。' + reasonOf(i));
  }

  var resetArmed = 0;
  function resetAction() {
    var now = Date.now();
    if (now - resetArmed < 2400) {
      resetArmed = 0;
      resetLevel();
      toast('本局已重置。');
    } else {
      resetArmed = now;
      toast('再按一次 R，重置本局。');
    }
  }

  function openLevels() {
    pauseClock();
    renderLevelGrid();
    openVeil('veilLevels');
  }

  function openHelp() {
    pauseClock();
    openVeil('veilHelp');
  }

  /* ───────────────────────── 关卡面板 ───────────────────────── */
  function isUnlocked(idx) {
    return settings.freeMode || idx === 0 || idx === levelIndex || !!progress[LEVELS[idx - 1].id];
  }

  function renderLevelGrid() {
    var grid = document.getElementById('levelGrid');
    grid.innerHTML = '';
    LEVELS.forEach(function (L, idx) {
      var opt = optimal(L.start, L.goal);
      var rec = progress[L.id];
      var open = isUnlocked(idx);
      var btn = document.createElement('button');
      btn.className = 'lv' + (idx === levelIndex ? ' active' : '') + (open ? '' : ' locked');
      btn.setAttribute('aria-disabled', open ? 'false' : 'true');
      btn.innerHTML = open
        ? '<span class="st">' + (rec ? '★'.repeat(rec.stars) : '') + '</span>' +
          '<span class="n">' + L.name + '</span>' +
          '<span class="m">最优 ' + opt + ' 步' + (rec ? ' · 记录 ' + rec.best : '') + '</span>'
        : '<span class="lock">未启</span>' +
          '<span class="n">' + L.name + '</span>' +
          '<span class="m">先解「' + LEVELS[idx - 1].name + '」</span>';
      btn.addEventListener('click', function () {
        if (!open) { toast('先解开「' + LEVELS[idx - 1].name + '」。'); return; }
        closeVeil('veilLevels');
        loadLevel(idx);
      });
      grid.appendChild(btn);
    });

    elBtnFree.textContent = settings.freeMode ? '恢复顺序解锁' : '自由练习 · 解锁全部';
    elBtnFree.classList.toggle('on', settings.freeMode);
    elLockHint.textContent = settings.freeMode
      ? '自由练习中 · 九局皆可入'
      : '依序解锁 · 通过一局，开启下一局';
  }

  function toggleFree() {
    settings.freeMode = !settings.freeMode;
    saveSettings();
    renderLevelGrid();
    toast(settings.freeMode ? '已解锁全部九局。' : '已恢复顺序解锁。');
  }

  /* ───────────────────────── 载入 ───────────────────────── */
  function loadLevel(idx, restore) {
    if (autoId) stopAuto(true);
    stopTimer();
    var hubOpen = !!(window.JW && JW.hub &&
      (JW.hub.isOpen() || (JW.hub.active && JW.hub.active() !== 'rings')));

    levelIndex = idx;
    var L = LEVELS[idx];
    layout(L.n);
    buildBoard();

    state = restore ? restore.state : L.start;
    goal = L.goal;
    moves = restore ? restore.moves : 0;
    checkpointAt = Math.floor(moves / 40) * 40;
    history = restore ? restore.history.slice() : [];
    elapsed = restore ? restore.elapsed : 0;
    elTime.textContent = fmt(elapsed);
    clearHints();

    tutorial.active = false;
    tutorial.step = 0;
    tutorial.justFinished = false;
    refreshTutorial();

    elChapter.textContent = L.chapter;
    elName.innerHTML = L.name + '<small>' + optimal(L.start, L.goal) + ' 步 · ' + L.note + '</small>';

    syncVisual(false);
    refreshHud();

    if (restore && restore.tutorial && !settings.tutorialDone) {
      tutorial.active = true;
      tutorial.step = Math.max(0, Math.min(tutorial.seq.length - 1, restore.tutorial.step | 0));
      refreshTutorial();
    }

    if (restore && (moves > 0 || elapsed > 0) && !hubOpen) startTimer();

    // 入场：环自下而上依次亮起（续玩时不重播）
    if (!restore && !REDUCE) {
      for (var i = 1; i <= N; i++) {
        (function (k, el) {
          var on = isOn(state, k);
          var x = slot[k], to = on ? RING_Y : offY(k);
          el.animate(
            [{ transform: 'translate(' + x + 'px,' + (to + 26) + 'px)', opacity: 0 },
             { transform: 'translate(' + x + 'px,' + to + 'px)', opacity: 1 }],
            { duration: 520, delay: 40 * k, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }
          );
        })(i, ringEls[i]);
      }
    }

    saveSession();

    setRoving(1);
    if (!hubOpen && !document.querySelector('.veil.show') && ringEls[1]) {
      try { ringEls[1].focus({ preventScroll: true }); } catch (e) {}
    }

    if (!restore && !hubOpen) maybeShowChapter(L.cid);
  }

  /* ───────────────────────── 弹层 · 焦点管理 ───────────────────────── */
  var veilStack = [];
  var returnFocus = {};

  function setAppInert(on) {
    var app = document.querySelector('.app');
    if (!app) return;
    try { app.inert = !!on; } catch (e) {}
    if (on) app.setAttribute('aria-hidden', 'true');
    else app.removeAttribute('aria-hidden');
  }

  function focusablesIn(root) {
    var list = root.querySelectorAll('button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])');
    return Array.prototype.filter.call(list, function (el) {
      return !el.disabled && el.getClientRects().length > 0;
    });
  }

  function topVeil() {
    return veilStack.length ? veilStack[veilStack.length - 1] : null;
  }

  function openVeil(id) {
    var v = document.getElementById(id);
    if (!v || v.classList.contains('show')) return;
    if (autoId) { stopAuto(true); autoPaused = true; }
    returnFocus[id] = document.activeElement;
    v.classList.add('show');
    if (veilStack.indexOf(id) < 0) veilStack.push(id);
    setAppInert(true);

    var target = v.querySelector('[data-autofocus]');
    if (!target) {
      var list = focusablesIn(v);
      target = list.length ? list[0] : v.querySelector('.slab');
    }
    if (target) {
      if (!target.hasAttribute('tabindex') && target.tagName !== 'BUTTON' && target.tagName !== 'SUMMARY') {
        target.setAttribute('tabindex', '-1');
      }
      try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
    }
  }

  function closeVeil(id) {
    var v = document.getElementById(id);
    if (!v) return;
    var wasOpen = v.classList.contains('show');
    v.classList.remove('show');

    var idx = veilStack.lastIndexOf(id);
    if (idx >= 0) veilStack.splice(idx, 1);
    setAppInert(veilStack.length > 0);
    if (!wasOpen) return;

    var back = returnFocus[id];
    returnFocus[id] = null;
    var backRect = (back && typeof back.getBoundingClientRect === 'function') ? back.getBoundingClientRect() : null;
    var canRestore = back && back.isConnected && typeof back.focus === 'function' &&
      !back.closest('[inert]') &&
      (back.hasAttribute('tabindex') || /^(BUTTON|A|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(back.tagName)) &&
      (!backRect || backRect.width > 0 || backRect.height > 0);

    if (canRestore) {
      try { back.focus({ preventScroll: true }); } catch (e) { back.focus(); }
    } else if (!veilStack.length) {
      // 回到第一只环，键盘玩家不会掉出环架。
      for (var i = 1; i <= N; i++) {
        if (!ringEls[i]) continue;
        setRoving(i);
        try { ringEls[i].focus({ preventScroll: true }); } catch (e) {}
        break;
      }
    }

    if (!veilStack.length && autoPaused && !document.hidden && state !== goal) {
      autoPaused = false;
      toggleAuto();
    }
  }

  /* ───────────────────────── 事件 ───────────────────────── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (btn) {
      var act = btn.dataset.act;
      if (act === 'undo') undo();
      else if (act === 'reset') resetLevel();
      else if (act === 'hint') hintAction();
      else if (act === 'auto') toggleAuto();
      else if (act === 'levels') openLevels();
      else if (act === 'help') openHelp();
      else if (act === 'chapter') {
        var ch = chapterOf(levelIndex);
        if (ch) openChapterCard(ch, !!settings.chaptersSeen[ch.id]);
      }
      else if (act === 'codex') openCodex();
      else if (act === 'closeChapter') closeOverlay('veilChapter');
      else if (act === 'closeCard') closeOverlay('veilCard');
      else if (act === 'replay') { closeVeil('veilWin'); resetLevel(); }
      else if (act === 'next') {
        closeVeil('veilWin');
        loadLevel((levelIndex + 1) % LEVELS.length);
      }
      else if (act === 'skipTutorial') skipTutorial();
      else if (act === 'tutorial') startTutorial();
      else if (act === 'toggleSound') toggleSound();
      else if (act === 'toggleLegal') toggleLegal();
      else if (act === 'toggleContrast') toggleContrast();
      else if (act === 'toggleFree') toggleFree();
      else if (act === 'share') openShare();
      else if (act === 'saveShare') saveShareCard();
      else if (act === 'copyShare') copyShareCaption();
      else if (act === 'systemShare') nativeShare();
      else if (act === 'install') installApp();
    }

    var sk = e.target.closest('[data-skin]');
    if (sk && !sk.disabled) selectSkin(sk.dataset.skin);

    var c = e.target.closest('[data-close]');
    if (c) closeOverlay(c.dataset.close);

    if (e.target.classList && e.target.classList.contains('veil')) {
      closeOverlay(e.target.id);
    }
  });

  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName ? e.target.tagName : '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;
    if (window.JW && JW.hub && JW.hub.isOpen()) return;
    if (window.JW && JW.hub && JW.hub.active && JW.hub.active() !== 'rings') return;

    // Tab 只在最上层弹层里循环。
    if (e.key === 'Tab') {
      var topId = topVeil();
      if (!topId) return;
      var v = document.getElementById(topId);
      var f = focusablesIn(v);
      if (!f.length) {
        e.preventDefault();
        var slab = v.querySelector('.slab');
        if (slab) {
          if (!slab.hasAttribute('tabindex')) slab.setAttribute('tabindex', '-1');
          slab.focus();
        }
        return;
      }
      var first = f[0], last = f[f.length - 1];
      if (!v.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      return;
    }

    if (e.key === 'Escape') {
      var top = topVeil();
      if (top) { e.preventDefault(); closeOverlay(top); }
      return;
    }

    if (topVeil()) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9 && n <= N) {
      e.preventDefault();
      if (autoId) stopAuto(true);
      onRingClick(n);
      return;
    }

    var k = e.key;
    if (k === 'z' || k === 'Z') { e.preventDefault(); undo(); }
    else if (k === 'r' || k === 'R') { e.preventDefault(); resetAction(); }
    else if (k === 'h' || k === 'H') { e.preventDefault(); hintAction(); }
    else if (k === 'a' || k === 'A') { e.preventDefault(); toggleAuto(); }
    else if (k === 'l' || k === 'L') { e.preventDefault(); openLevels(); }
    else if (k === 'c' || k === 'C') { e.preventDefault(); toggleContrast(); }
    else if (k === 'm' || k === 'M') { e.preventDefault(); toggleSound(); }
    else if (k === '?' || (k === '/' && e.shiftKey)) { e.preventDefault(); openHelp(); }
  });

  /* ───────────────────────── 背景金屑 ───────────────────────── */
  function buildDust() {
    var frag = document.createDocumentFragment();
    var seed = 7;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (var i = 0; i < 26; i++) {
      var x = 120 + rnd() * 780;
      var y = 80 + rnd() * 460;
      var r = 0.6 + rnd() * 1.5;
      frag.appendChild(mk('circle', {
        cx: x.toFixed(1), cy: y.toFixed(1), r: r.toFixed(2),
        fill: '#e8c98a', opacity: (0.06 + rnd() * 0.16).toFixed(2)
      }));
    }
    dustLayer.appendChild(frag);
  }

  /* ───────────────────────── 启动 ───────────────────────── */
  loadProgress();
  loadSettings();
  loadStats();
  applySkin(settings.skin);
  applyContrast();
  buildDust();
  syncToggles();
  registerPWA();

  var bootSession = loadSession();
  if (bootSession) {
    loadLevel(bootSession.levelIndex, bootSession);
    // 首次进入时若在章节过场刷新，恢复三环引导，别让新手掉队。
    if (!settings.tutorialDone && bootSession.levelIndex === 0 && bootSession.moves === 0 && !bootSession.tutorial) {
      beginTutorial();
      saveSession();
    }
    if (bootSession.moves > 0 || bootSession.elapsed > 0) {
      setTimeout(function () {
        if (window.JW && JW.hub && JW.hub.active && JW.hub.active() !== 'rings') return;
        toast('接着上次：' + LEVELS[bootSession.levelIndex].name + ' · ' + bootSession.moves + ' 步');
      }, 800);
    }
  } else {
    var bootIdx = 0;
    if (settings.tutorialDone) {
      for (var bi = 0; bi < LEVELS.length; bi++) {
        if (!progress[LEVELS[bi].id] && isUnlocked(bi)) { bootIdx = bi; break; }
      }
    }
    loadLevel(bootIdx);
    if (bootIdx === 0 && !settings.tutorialDone) {
      beginTutorial();
      saveSession();
    } else {
      setTimeout(function () {
        if (window.JW && JW.hub && JW.hub.active && JW.hub.active() !== 'rings') return;
        toast('点环即动。第 1 环随时可动，其余须隔一环。');
      }, 900);
    }
  }

  window.addEventListener('pagehide', function () {
    flushSession();
    saveStats();
  });

  var hitResizeRaf = 0;
  function scheduleHitRefresh() {
    if (hitResizeRaf) return;
    hitResizeRaf = requestAnimationFrame(function () {
      hitResizeRaf = 0;
      refreshHitTargets();
    });
  }
  window.addEventListener('resize', scheduleHitRefresh);
  window.addEventListener('orientationchange', scheduleHitRefresh);
  if (window.matchMedia) {
    var coarseQuery = window.matchMedia('(pointer: coarse)');
    if (coarseQuery.addEventListener) coarseQuery.addEventListener('change', scheduleHitRefresh);
    else if (coarseQuery.addListener) coarseQuery.addListener(scheduleHitRefresh);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (autoId) { stopAuto(true); autoPaused = true; }
      pauseClock();
      flushSession();
      saveStats();
    } else {
      if (window.JW && JW.hub && JW.hub.active && JW.hub.active() !== 'rings') return;
      if (!document.querySelector('.veil.show')) resumeClock();
      if (autoPaused && !document.querySelector('.veil.show') && state !== goal) {
        autoPaused = false;
        toggleAuto();
      }
    }
  });

  // 馆入口：离开卷一时暂停计时并落盘；回到卷一后续上，不重复弹已看过的章节。
  function pauseForHub() {
    if (autoId) stopAuto(true);
    pauseClock();
    flushSession();
    saveStats();
  }

  function enterFromHub() {
    setRoving(1);
    if ((moves > 0 || elapsed > 0) && state !== goal) {
      clockPaused = false;
      startTimer();
    }
    maybeShowChapter(LEVELS[levelIndex].cid);
    if (!document.querySelector('.veil.show') && ringEls[1]) {
      try { ringEls[1].focus({ preventScroll: true }); } catch (e) {}
    }
  }

  window.__puzzle = {
    gray2bin: gray2bin,
    bin2gray: bin2gray,
    canMove: canMove,
    optimal: optimal,
    nextState: nextState,
    loadLevel: loadLevel,
    openChapterCard: openChapterCard,
    maybeShowChapter: maybeShowChapter,
    openCard: openCard,
    openCodex: openCodex,
    selectSkin: selectSkin,
    makeShareCard: makeShareCard,
    openShare: openShare,
    get lastWin() { return lastWin; },
    get state() { return state; },
    get goal() { return goal; },
    get moves() { return moves; },
    get levelIndex() { return levelIndex; },
    get level() { return LEVELS[levelIndex]; },
    get checkpointAt() { return checkpointAt; },
    get settings() { return settings; },
    get stats() { return stats; },
    get veilStack() { return veilStack.slice(); },
    get tutorial() { return { active: tutorial.active, step: tutorial.step }; },
    get store() { return STORE.inspect(); }
  };

  JW.toys.rings = {
    id: 'rings',
    title: '九连环',
    subtitle: '递归',
    status: 'ready',
    storage: 'jiewu.v2 / volumes.rings',
    levels: LEVELS,
    levelCount: LEVELS.length,
    levelName: function (i) { return LEVELS[i] ? LEVELS[i].name : ''; },
    enter: enterFromHub,
    pause: pauseForHub,
    debug: window.__puzzle
  };

  document.dispatchEvent(new CustomEvent('jiewu:rings-ready'));
})();
