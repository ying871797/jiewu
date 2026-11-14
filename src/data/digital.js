/*
 * 解物 · 卷二 数局 · 盘面与关卡数据
 *
 * 「数局」是华容道卷内的数字滑块：n×n 盘面，1…n²−1 依次排好，空格留在右下。
 * 三盘都是「从复原态随机走 depth 步」生成的，因而天然可解；
 * 同一 seed 每次生成同一盘，便于复盘与测试。
 */
(function (global) {
  'use strict';

  var JW = global.JW || (global.JW = {});
  JW.data = JW.data || {};

  var LEVELS = [
    {
      id: 'digital-9',
      n: 3,
      name: '九宫',
      sub: '3 × 3 · 八数一空',
      chapter: '数局 · 九宫',
      seed: 0x1f123bb5,
      depth: 40,
      note: '八个数，一个空格。先把第一行排好，再收第二行。'
    },
    {
      id: 'digital-16',
      n: 4,
      name: '十六宫',
      sub: '4 × 4 · 十五数一空',
      chapter: '数局 · 十六宫',
      seed: 0x6a09e667,
      depth: 120,
      note: '最经典的一盘。看似只差几格，往往要绕很远。'
    },
    {
      id: 'digital-25',
      n: 5,
      name: '廿五宫',
      sub: '5 × 5 · 廿四数一空',
      chapter: '数局 · 廿五宫',
      seed: 0x3c6ef372,
      depth: 160,
      note: '盘面更大，空格更少。先归位，再谈速度。'
    }
  ];

  var byId = {};
  LEVELS.forEach(function (level) { byId[level.id] = level; });

  JW.data.digital = {
    levels: LEVELS,
    levelById: byId,
    defaultIndex: 1
  };
})(window);
