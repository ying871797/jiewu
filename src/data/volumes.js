/*
 * 解物 · 四卷元数据
 * 只放「是什么」，不放「怎么玩」；各卷规则在 src/toys/<id>/。
 */
(function (global) {
  'use strict';

  var JW = global.JW || (global.JW = {});
  JW.data = JW.data || {};

  var volumes = [
    {
      id: 'rings',
      no: 1,
      label: '卷一',
      title: '九连环',
      alias: '解连环',
      thinking: '递归',
      algorithm: '格雷码 / 递推',
      line: '把 341 步的机械重复，变成一段看得见的递归。',
      status: 'ready',
      entry: 'dist/index.html',
      accent: 'brass'
    },
    {
      id: 'huarong',
      no: 2,
      label: '卷二',
      title: '华容道',
      alias: '走曹 · 数阵',
      thinking: '搜索',
      algorithm: '状态图 / 广度优先 / 加权 A*',
      line: '木局三种「一步」，三个答案；数局一方数阵，一条可行解。',
      status: 'ready',
      entry: 'dist/index.html?play=huarong',
      accent: 'cinnabar'
    },
    {
      id: 'tangram',
      no: 3,
      label: '卷三',
      title: '七巧板',
      alias: '七巧图',
      thinking: '变换',
      algorithm: '等积变换 / 精确覆盖',
      line: '七块板，十三种凸形，无数种人间。',
      status: 'ready',
      entry: 'dist/index.html?play=tangram',
      accent: 'jade'
    },
    {
      id: 'burr',
      no: 4,
      label: '卷四',
      title: '鲁班锁',
      alias: '六子连芳',
      thinking: '结构',
      algorithm: '三维拆装 / 依赖图',
      line: '六根木头，三轴相扣，最后一根叫「锁」。',
      status: 'ready',
      entry: 'dist/index.html?play=burr',
      accent: 'ebony'
    }
  ];

  var byId = {};
  volumes.forEach(function (v) { byId[v.id] = v; });

  JW.data.volumes = volumes;
  JW.data.volumeById = byId;
})(window);
