/*
 * 解物 · 卷三 七巧板数据
 *
 * 坐标以「七巧方」边长 4 为 1 个基准单位，棋盘 12×8。
 * 剪影区：x 4..8，y 0..4；木片区：y 4..8。
 *
 * 七块板：大三角 ×2、中三角 ×1、小三角 ×2、正方形 ×1、平行四边形 ×1。
 * 每块都是 16 个基本小三角的整数并集。
 */
(function (global) {
  'use strict';

  var JW = global.JW || (global.JW = {});
  JW.data = JW.data || {};

  // 母形：取「七巧方」中的标准位姿；第一个顶点就是每块板的锚点。
  var SHAPES = {
    large: [[0, 0], [0, 4], [2, 2]],
    medium: [[2, 0], [4, 0], [4, 2]],
    small: [[1, 1], [3, 1], [2, 2]],
    square: [[2, 2], [3, 1], [4, 2], [3, 3]],
    para: [[0, 0], [2, 0], [3, 1], [1, 1]]
  };

  var TRAY = {
    'large-1': { x: 0, y: 4, rot: 0 },
    'large-2': { x: 2, y: 4, rot: 0 },
    'medium-1': { x: 4, y: 4, rot: 0 },
    'small-1': { x: 4, y: 6, rot: 0 },
    'small-2': { x: 6, y: 6, rot: 0 },
    'square-1': { x: 6, y: 5, rot: 0 },
    'para-1': { x: 8, y: 4, rot: 0 }
  };

  var pieces = [
    { id: 'large-1', type: 'large', name: '大三角·一', short: '大三角', note: '面积 4，两块合起来是一半。' },
    { id: 'large-2', type: 'large', name: '大三角·二', short: '大三角', note: '面积 4，斜边与方边同长。' },
    { id: 'medium-1', type: 'medium', name: '中三角', short: '中三角', note: '面积 2，两块小三角可拼成它。' },
    { id: 'small-1', type: 'small', name: '小三角·一', short: '小三角', note: '面积 1，十六分之一。' },
    { id: 'small-2', type: 'small', name: '小三角·二', short: '小三角', note: '面积 1，翻转后与另一块全等。' },
    { id: 'square-1', type: 'square', name: '正方形', short: '正方形', note: '面积 2，边长为小三角的直角边。' },
    { id: 'para-1', type: 'para', name: '平行四边形', short: '平行四边形', note: '面积 2，唯一可以翻面的板。' }
  ];

  var byId = {};
  pieces.forEach(function (p) { byId[p.id] = p; });

  var levels = [
    {
      id: 'tangram-two-small',
      name: '小方',
      sub: '两块小三角 · 一方',
      chapter: '教学 · 两块',
      note: '两块小三角沿斜边拼合，就是一方小印。先在木片区找到它们。',
      pieces: ['small-1', 'small-2'],
      targets: [
        { id: 'small-1', type: 'small', x: 6, y: 2, rot: 0 },
        { id: 'small-2', type: 'small', x: 8, y: 2, rot: 180 }
      ],
      targetTime: 25
    },
    {
      id: 'tangram-two-large',
      name: '大方',
      sub: '两块大三角 · 一方',
      chapter: '教学 · 两块',
      note: '两块大三角沿斜边合拢，也是一方；边长是小方的两倍。',
      pieces: ['large-1', 'large-2'],
      targets: [
        { id: 'large-1', type: 'large', x: 6, y: 0, rot: 0 },
        { id: 'large-2', type: 'large', x: 6, y: 4, rot: 180 }
      ],
      targetTime: 30
    },
    {
      id: 'tangram-two-triangle',
      name: '大三角',
      sub: '两块大三角 · 一峰',
      chapter: '教学 · 两块',
      note: '把两块大三角沿一条直角边错开，就成一座直角的山。',
      pieces: ['large-1', 'large-2'],
      targets: [
        { id: 'large-1', type: 'large', x: 4, y: 0, rot: 0 },
        { id: 'large-2', type: 'large', x: 8, y: 0, rot: 90 }
      ],
      targetTime: 40
    },
    {
      id: 'tangram-seven-square',
      name: '七巧方',
      sub: '七块 · 复原一方',
      chapter: '教学 · 七块',
      note: '七块板全部归位，回到最初的那方。剪影不画分割线，先看大三角。',
      pieces: ['large-1', 'large-2', 'medium-1', 'small-1', 'small-2', 'square-1', 'para-1'],
      targets: [
        { id: 'large-1', type: 'large', x: 4, y: 0, rot: 0 },
        { id: 'large-2', type: 'large', x: 4, y: 4, rot: 270 },
        { id: 'medium-1', type: 'medium', x: 6, y: 0, rot: 0 },
        { id: 'small-1', type: 'small', x: 5, y: 1, rot: 0 },
        { id: 'small-2', type: 'small', x: 8, y: 2, rot: 90 },
        { id: 'square-1', type: 'square', x: 6, y: 2, rot: 0 },
        { id: 'para-1', type: 'para', x: 4, y: 0, rot: 0 }
      ],
      targetTime: 150
    }
  ];

  JW.data.tangram = {
    shapes: SHAPES,
    pieces: pieces,
    pieceById: byId,
    tray: TRAY,
    levels: levels,
    board: { w: 12, h: 8, target: { x: 4, y: 0, w: 4, h: 4 }, unit: 80 },
    facts: [
      '七巧方边长 4，可切成 16 个全等的小等腰直角三角形。',
      '大三角 4、中三角 2、小三角 1、正方形 2、平行四边形 2，合计 16。',
      '七块板能拼出的凸多边形恰好 13 种，1942 年由王福春与熊全治证明。',
      '平行四边形是唯一需要翻面的板；其余六块翻面后都能由旋转得到。'
    ]
  };
})(window);
