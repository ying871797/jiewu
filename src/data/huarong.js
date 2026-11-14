/*
 * 解物 · 卷二 华容道 · 关卡与棋子数据
 *
 * 坐标统一为 [row, col]，棋盘 5 行 × 4 列。
 * 棋子顺序固定：曹操(2×2) → 关羽(2×1 横) → 四将(1×2 竖) → 四卒(1×1)。
 * 同形棋子在求解时按组规范化，所以「四将」「四卒」不区分个体。
 */
(function (global) {
  'use strict';

  var JW = global.JW || (global.JW = {});
  JW.data = JW.data || {};

  var ROWS = 5;
  var COLS = 4;
  var EXIT = [3, 1]; // 曹操左上角到达这里即胜

  var TYPES = {
    cao:     { key: 'cao',     w: 2, h: 2, label: '曹操', tone: 'cao' },
    guan:    { key: 'guan',    w: 2, h: 1, label: '关羽', tone: 'guan' },
    general: { key: 'general', w: 1, h: 2, label: '将',   tone: 'general' },
    soldier: { key: 'soldier', w: 1, h: 1, label: '卒',   tone: 'soldier' }
  };

  function piece(type, row, col) {
    return { type: type, at: [row, col] };
  }

  var LEVELS = [
    {
      id: 'huarong-xiaoshi',
      name: '小试',
      sub: '先学会推块',
      chapter: '教学 · 小试',
      note: '只留曹操与两卒。把曹操移到底部中央的出口，体会「滑块只能推向空位」。',
      pieces: [
        piece('cao', 0, 1),
        piece('soldier', 2, 1),
        piece('soldier', 2, 2)
      ],
      optimal: { straight: 3, finger: 2, unit: 5 },
      stars: { two: 5, three: 3 }
    },
    {
      id: 'huarong-hengdaolima',
      name: '横刀立马',
      sub: '90 步 · 三种计步',
      chapter: '经典 · 横刀立马',
      note: '最著名的一局。直线步 90，古法指步 81，单格步 116——同一局棋，三种「一步」。',
      pieces: [
        piece('cao', 0, 1),
        piece('guan', 2, 1),
        piece('general', 0, 0),
        piece('general', 2, 0),
        piece('general', 0, 3),
        piece('general', 2, 3),
        piece('soldier', 3, 1),
        piece('soldier', 3, 2),
        piece('soldier', 4, 0),
        piece('soldier', 4, 3)
      ],
      optimal: { straight: 90, finger: 81, unit: 116 },
      stars: { two: 108, three: 90 }
    }
  ];

  var METRICS = [
    { id: 'straight', name: '直线步', short: '直', desc: '一方连续直滑，算一步' },
    { id: 'finger',   name: '古法指步', short: '指', desc: '一方连续滑动并转弯，算一步' },
    { id: 'unit',     name: '单格步', short: '格', desc: '每移动一格，算一步' }
  ];

  var levelById = {};
  LEVELS.forEach(function (level) { levelById[level.id] = level; });

  JW.data.huarong = {
    rows: ROWS,
    cols: COLS,
    exit: EXIT,
    types: TYPES,
    levels: LEVELS,
    levelById: levelById,
    metrics: METRICS
  };
})(window);
