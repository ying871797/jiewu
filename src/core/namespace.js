/*
 * 解物 · 命名空间
 * 所有模块只挂到 window.JW 下，不污染其它全局变量。
 * 源码按 core → data → toys 的顺序加载；发布时由 src/build.py 内联成单文件。
 */
(function (global) {
  'use strict';

  var JW = global.JW || (global.JW = {});
  JW.VERSION = '0.8.0-dev';
  JW.core = JW.core || {};
  JW.toys = JW.toys || {};
  JW.data = JW.data || {};
})(window);
