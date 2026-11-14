/*
 * 解物 · 统一存档
 *
 * 新键：jiewu.v2
 * 旧键：jielianhuan.prototype.v1 / session.v1 / settings.v2 / stats.v1
 *
 * 规则：
 * - 首次读取时若 jiewu.v2 不存在，把四个旧键迁移进来；旧键保留 30 天，不删除。
 * - 迁移只做一次；之后所有读写都指向 jiewu.v2。
 * - 结构缺项由 normalize() 补齐，永远不假设用户从最新版来。
 */
(function (global) {
  'use strict';

  var JW = global.JW || (global.JW = {});
  JW.core = JW.core || {};

  var KEY = 'jiewu.v2';
  var LEGACY_KEYS = {
    progress: 'jielianhuan.prototype.v1',
    session: 'jielianhuan.session.v1',
    settings: 'jielianhuan.settings.v2',
    stats: 'jielianhuan.stats.v1'
  };
  var KEEP_DAYS = 30;
  var VOLUME_IDS = ['rings', 'huarong', 'tangram', 'burr'];

  function isObj(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  function readRaw(key) {
    try { return global.localStorage.getItem(key); } catch (e) { return null; }
  }

  function readJSON(key, fallback) {
    var raw = readRaw(key);
    if (raw === null || raw === undefined) return fallback;
    try {
      var v = JSON.parse(raw);
      return v === null || v === undefined ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, val) {
    try {
      global.localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      return false;
    }
  }

  function blank() {
    var doc = { version: 2, volumes: {}, settings: {}, stats: {} };
    VOLUME_IDS.forEach(function (id) {
      doc.volumes[id] = { progress: {}, session: null };
    });
    return doc;
  }

  function normalize(doc) {
    if (!isObj(doc)) return blank();
    if (doc.version !== 2) doc.version = 2;
    if (!isObj(doc.volumes)) doc.volumes = {};
    VOLUME_IDS.forEach(function (id) {
      if (!isObj(doc.volumes[id])) doc.volumes[id] = {};
      var vol = doc.volumes[id];
      if (!isObj(vol.progress)) vol.progress = {};
      if (!('session' in vol)) vol.session = null;
    });
    if (!isObj(doc.settings)) doc.settings = {};
    if (!isObj(doc.stats)) doc.stats = {};
    return doc;
  }

  var doc = null;
  var migratedNow = false;

  function lookup() {
    if (doc) return doc;

    var existing = readJSON(KEY, null);
    if (isObj(existing)) {
      doc = normalize(existing);
      return doc;
    }

    var migrated = blank();
    var progress = readJSON(LEGACY_KEYS.progress, {});
    var session = readJSON(LEGACY_KEYS.session, null);
    var settings = readJSON(LEGACY_KEYS.settings, {});
    var stats = readJSON(LEGACY_KEYS.stats, {});

    migrated.volumes.rings.progress = isObj(progress) ? progress : {};
    migrated.volumes.rings.session = isObj(session) ? session : null;
    migrated.settings = isObj(settings) ? settings : {};
    migrated.stats = isObj(stats) ? stats : {};

    // 全新安装没有旧键：这是空档案，不是迁移。只有真的读到旧数据才记账。
    var legacyPresent = Object.keys(LEGACY_KEYS).filter(function (k) {
      return readRaw(LEGACY_KEYS[k]) !== null;
    });
    if (legacyPresent.length) {
      migrated.legacy = {
        from: legacyPresent,
        migratedAt: new Date().toISOString(),
        keepUntil: new Date(Date.now() + KEEP_DAYS * 864e5).toISOString()
      };
      migratedNow = true;
    }

    doc = normalize(migrated);
    writeJSON(KEY, doc);
    return doc;
  }

  JW.core.store = {
    KEY: KEY,
    LEGACY_KEYS: LEGACY_KEYS,
    KEEP_DAYS: KEEP_DAYS,
    VOLUME_IDS: VOLUME_IDS,

    blank: blank,
    normalize: normalize,
    readLegacy: readJSON,

    doc: lookup,
    volume: function (id) { return lookup().volumes[id]; },
    settings: function () { return lookup().settings; },
    stats: function () { return lookup().stats; },
    save: function () { return writeJSON(KEY, lookup()); },

    exportJSON: function () { return JSON.stringify(lookup()); },
    inspect: function () {
      var current = lookup();
      return {
        key: KEY,
        version: current.version,
        migrated: !!current.legacy,
        migratedNow: migratedNow,
        volumes: Object.keys(current.volumes),
        hasLegacy: Object.keys(LEGACY_KEYS).some(function (k) {
          return readRaw(LEGACY_KEYS[k]) !== null;
        })
      };
    }
  };
})(window);
