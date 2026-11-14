/*
 * 解物 · 馆入口「夜案长廊」
 *
 * 只负责「选卷」这一层：四座器台、展签、进入已上线卷、回到馆。
 * 各卷规则与渲染不在这里；卷一 / 卷二通过 JW.toys.<id>.enter() 接管。
 * 深链：?play=rings / ?play=huarong 或 #rings / #huarong 直接入局。
 */
(function (global) {
  'use strict';

  var JW = global.JW || (global.JW = {});
  JW.core = JW.core || {};
  JW.data = JW.data || {};

  var root = document.getElementById('hub');
  if (!root) return;

  var volumes = JW.data.volumes || [];
  var byId = {};
  volumes.forEach(function (v) { byId[v.id] = v; });

  var selected = 'rings';
  var activeId = 'rings';
  var isOpen = false;
  var pendingDeep = null;

  function shortAlgorithm(v) {
    return String(v.algorithm || '').split(' / ')[0];
  }

  function appFor(id) {
    return document.querySelector('.app[data-volume="' + id + '"]');
  }

  function apps() {
    return Array.prototype.slice.call(document.querySelectorAll('.app'));
  }

  function toyFor(id) {
    return JW.toys && JW.toys[id];
  }

  function volSession(id) {
    try {
      var vol = JW.core.store.volume(id);
      var s = vol && vol.session;
      var d = vol && vol.sessionDigital;
      var best = null;
      if (s && ((s.moves || 0) > 0 || (s.elapsed || 0) > 0)) best = s;
      if (d && ((d.moves || 0) > 0 || (d.elapsed || 0) > 0)) {
        if (!best || !s || !s.at || (d.at && d.at > s.at)) best = d;
      }
      return best;
    } catch (e) {}
    return null;
  }

  function volDone(id) {
    try {
      var vol = JW.core.store.volume(id);
      return vol && vol.progress ? Object.keys(vol.progress).length : 0;
    } catch (e) { return 0; }
  }

  function hasData(id) {
    return volDone(id) > 0 || !!volSession(id);
  }

  function cardState(v) {
    if (v.status === 'ready') return hasData(v.id) ? '继续' : '可入卷';
    if (v.status === 'next') return '下一卷 · 开发中';
    return '筹备中';
  }

  function statusLong(v) {
    if (v.status === 'ready') return '已上线';
    if (v.status === 'next') return '下一卷 · 开发中';
    return '筹备中';
  }

  function ringName(index) {
    var rings = toyFor('rings');
    if (rings && typeof rings.levelName === 'function') {
      return rings.levelName(index);
    }
    return '第 ' + (Number(index) + 1) + ' 局';
  }

  function huarongName(index) {
    var hr = toyFor('huarong');
    if (hr && typeof hr.levelName === 'function') {
      return hr.levelName(index);
    }
    var list = JW.data.huarong ? JW.data.huarong.levels : [];
    return list[index] ? list[index].name : '第 ' + (Number(index) + 1) + ' 局';
  }

  function huarongLevelCount() {
    var hr = toyFor('huarong');
    var wood = hr && hr.levelCount ? hr.levelCount : (JW.data.huarong ? JW.data.huarong.levels.length : 2);
    var digital = JW.data.digital ? JW.data.digital.levels.length : 0;
    return wood + digital;
  }

  function digitalName(index) {
    var list = JW.data.digital ? JW.data.digital.levels : [];
    return list[index] ? list[index].name : '第 ' + (Number(index) + 1) + ' 盘';
  }

  function tangramName(index) {
    var tg = toyFor('tangram');
    if (tg && typeof tg.levelName === 'function') {
      return tg.levelName(index);
    }
    var list = JW.data.tangram ? JW.data.tangram.levels : [];
    return list[index] ? list[index].name : '第 ' + (Number(index) + 1) + ' 关';
  }

  function tangramLevelCount() {
    var tg = toyFor('tangram');
    return tg && tg.levelCount ? tg.levelCount : (JW.data.tangram ? JW.data.tangram.levels.length : 4);
  }

  function burrName(index) {
    var br = toyFor('burr');
    if (br && typeof br.levelName === 'function') {
      return br.levelName(index);
    }
    var list = JW.data.burr ? JW.data.burr.levels : [];
    return list[index] ? list[index].name : '第 ' + (Number(index) + 1) + ' 关';
  }

  function burrLevelCount() {
    var br = toyFor('burr');
    return br && br.levelCount ? br.levelCount : (JW.data.burr ? JW.data.burr.levels.length : 8);
  }

  function sessionLine(v) {
    if (v.status === 'next') return '技术路线已定：4×5 网格 + 反向 BFS，三种计步口径。平台化完成后开工。';
    if (v.status !== 'ready') return '等前两卷跑通后再开卷；先保证每一卷都能拆能装、能键盘走通。';

    var s = volSession(v.id);
    if (s) {
      if (v.id === 'rings') {
        return '上次停在「' + ringName(s.levelIndex) + '」 · ' + (s.moves || 0) + ' 步。进去接着走，不会丢。';
      }
      if (v.id === 'tangram') {
        return '上次停在「' + tangramName(s.levelIndex) + '」 · ' + (s.moves || 0) + ' 步。进去接着拼，不会丢。';
      }
      if (v.id === 'burr') {
        var bm = s.mode === 'asm' ? '装' : '拆';
        return '上次停在「' + burrName(s.levelIndex) + ' · ' + bm + '」 · ' + (s.moves || 0) + ' 步。进去接着走，不会丢。';
      }
      if (s.mode === 'digital') {
        return '上次停在「数局 · ' + digitalName(s.levelIndex) + '」 · ' + (s.moves || 0) + ' 步。进去接着走，不会丢。';
      }
      var steps = (s.metrics && s.metrics.straight) || s.moves || 0;
      return '上次停在「' + huarongName(s.levelIndex) + '」 · 直线 ' + steps + ' 步。进去接着走，不会丢。';
    }

    var done = volDone(v.id);
    if (v.id === 'rings') {
      if (done) return '已完成 ' + done + ' / ' + (toyFor('rings') && toyFor('rings').levelCount || 9) + ' 局。';
      return '尚未开始。三环引导会带你走第一步。';
    }
    if (v.id === 'huarong') {
      var woodCount = JW.data.huarong ? JW.data.huarong.levels.length : 2;
      var digitalCount = JW.data.digital ? JW.data.digital.levels.length : 0;
      if (done) return '已解开 ' + done + ' / ' + huarongLevelCount() + ' 局（木局 ' + woodCount + ' · 数局 ' + digitalCount + '）。';
      return '尚未开始。先走一局「小试」，十步之内学会推块。';
    }
    if (v.id === 'tangram') {
      if (done) return '已拼成 ' + done + ' / ' + tangramLevelCount() + ' 个剪影。';
      return '尚未开始。两块小三角先拼一方，七块最后归位。';
    }
    if (v.id === 'burr') {
      if (done) return '已拆合 ' + done + ' / ' + burrLevelCount() + ' 关。拆与装分别记最佳步数。';
      return '尚未开始。三片「三通」先练手，六根「六子连芳」与平板「六合」「九重」在后，另有「四象」「八方」「十全」「十二楼」别式。';
    }
    return '尚未开始。';
  }

  function svgFor(id) {
    if (id === 'rings') {
      return '<svg viewBox="0 0 160 160" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">' +
        '<line x1="10" y1="88" x2="150" y2="88" opacity=".78"/>' +
        '<circle cx="52" cy="88" r="27"/>' +
        '<circle cx="52" cy="88" r="17" opacity=".28"/>' +
        '<circle cx="92" cy="88" r="27" opacity=".55"/>' +
        '<circle cx="125" cy="88" r="20" opacity=".30"/>' +
        '</svg>';
    }
    if (id === 'huarong') {
      return '<svg viewBox="0 0 160 160" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
        '<rect x="38" y="10" width="84" height="140" rx="2" opacity=".55"/>' +
        '<line x1="38" y1="45" x2="122" y2="45" opacity=".22"/>' +
        '<line x1="38" y1="80" x2="122" y2="80" opacity=".22"/>' +
        '<line x1="38" y1="115" x2="122" y2="115" opacity=".22"/>' +
        '<line x1="66" y1="10" x2="66" y2="150" opacity=".22"/>' +
        '<line x1="94" y1="10" x2="94" y2="150" opacity=".22"/>' +
        '<rect x="40" y="12" width="52" height="66" rx="1" fill="currentColor" stroke="none" opacity=".28"/>' +
        '<rect x="96" y="12" width="24" height="66" rx="1" fill="currentColor" stroke="none" opacity=".14"/>' +
        '<rect x="40" y="82" width="24" height="32" rx="1" fill="currentColor" stroke="none" opacity=".20"/>' +
        '<rect x="68" y="82" width="24" height="32" rx="1" fill="currentColor" stroke="none" opacity=".12"/>' +
        '<rect x="96" y="82" width="24" height="32" rx="1" fill="currentColor" stroke="none" opacity=".20"/>' +
        '<rect x="40" y="118" width="80" height="30" rx="1" fill="currentColor" stroke="none" opacity=".10"/>' +
        '</svg>';
    }
    if (id === 'tangram') {
      return '<svg viewBox="0 0 160 160" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M24 20 L78 20 L24 74 Z" fill="currentColor" fill-opacity=".22"/>' +
        '<path d="M24 20 L24 74 L78 20 Z" fill="none" opacity=".55"/>' +
        '<path d="M136 140 L82 140 L136 86 Z" fill="currentColor" fill-opacity=".18"/>' +
        '<path d="M78 20 L136 20 L107 49 Z" fill="currentColor" fill-opacity=".14"/>' +
        '<path d="M24 86 L56 86 L40 102 Z" fill="currentColor" fill-opacity=".26"/>' +
        '<path d="M82 140 L114 140 L98 124 Z" fill="currentColor" fill-opacity=".26"/>' +
        '<rect x="56" y="86" width="16" height="16" fill="currentColor" fill-opacity=".20"/>' +
        '<path d="M72 102 L104 102 L88 118 L56 118 Z" fill="currentColor" fill-opacity=".12"/>' +
        '<path d="M40 102 L56 86 L72 102 L56 118 Z" opacity=".35"/>' +
        '</svg>';
    }
    return '<svg viewBox="0 0 160 160" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="30" y="62" width="100" height="20" rx="2" opacity=".85"/>' +
      '<rect x="70" y="34" width="20" height="92" rx="2" opacity=".62"/>' +
      '<rect x="42" y="48" width="18" height="62" rx="2" opacity=".34"/>' +
      '<rect x="100" y="50" width="18" height="58" rx="2" opacity=".34"/>' +
      '<path d="M38 48 L56 48 L56 34 L38 34 Z" opacity=".45"/>' +
      '<path d="M104 112 L122 112 L122 96 L104 96 Z" opacity=".45"/>' +
      '<line x1="30" y1="72" x2="130" y2="72" opacity=".25"/>' +
      '</svg>';
  }

  function cards() {
    return Array.prototype.slice.call(root.querySelectorAll('.hub-item'));
  }

  function cardHTML(v) {
    return '<button class="hub-item" type="button" data-hub-id="' + v.id + '" data-status="' + v.status + '"' +
      ' aria-label="' + v.label + ' ' + v.title + '，' + v.thinking + '，' + cardState(v) + '">' +
      '<span class="hub-figure" aria-hidden="true">' + svgFor(v.id) + '</span>' +
      '<span class="hub-no">' + v.label + '</span>' +
      '<span class="hub-name">' + v.title + '</span>' +
      '<span class="hub-think">' + v.thinking + ' · ' + shortAlgorithm(v) + '</span>' +
      '<span class="hub-state ' + v.status + '" data-hub-state>' + cardState(v) + '</span>' +
      '</button>';
  }

  function detailHTML(v) {
    var ready = v.status === 'ready';
    var label = ready ? (hasData(v.id) ? '继续' + v.label : '进入' + v.label) : (v.status === 'next' ? '即将开启' : '筹备中');
    return '<p class="hub-label-no">' + v.label + ' · ' + v.thinking + '</p>' +
      '<h2>' + v.title + '</h2>' +
      '<p class="hub-alias">' + (v.alias ? '又名「' + v.alias + '」' : '　') + '</p>' +
      '<p class="hub-line">' + v.line + '</p>' +
      '<dl class="hub-meta">' +
        '<div><dt>思维</dt><dd>' + v.thinking + '</dd></div>' +
        '<div><dt>算法</dt><dd>' + v.algorithm + '</dd></div>' +
        '<div><dt>状态</dt><dd>' + statusLong(v) + '</dd></div>' +
      '</dl>' +
      '<p class="hub-session">' + sessionLine(v) + '</p>' +
      '<button class="btn hub-enter" type="button" data-hub-enter' + (ready ? '' : ' disabled') + '>' + label + '</button>';
  }

  function select(id, opts) {
    if (!byId[id]) return;
    selected = id;
    cards().forEach(function (card) {
      var on = card.dataset.hubId === id;
      card.setAttribute('aria-current', on ? 'true' : 'false');
      card.tabIndex = on ? 0 : -1;
    });
    var label = root.querySelector('.hub-label');
    if (label) label.innerHTML = detailHTML(byId[id]);
    if (opts && opts.focus) {
      var target = root.querySelector('.hub-item[data-hub-id="' + id + '"]');
      if (target) {
        try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
      }
    }
  }

  function refresh() {
    cards().forEach(function (card) {
      var v = byId[card.dataset.hubId];
      if (!v) return;
      var state = card.querySelector('[data-hub-state]');
      if (state) state.textContent = cardState(v);
      card.setAttribute('aria-label', v.label + ' ' + v.title + '，' + v.thinking + '，' + cardState(v));
    });
    var label = root.querySelector('.hub-label');
    if (label) label.innerHTML = detailHTML(byId[selected]);
  }

  function build() {
    var gallery = volumes.map(cardHTML).join('');
    root.innerHTML =
      '<header class="hub-head">' +
        '<span class="hub-seal" aria-hidden="true">物</span>' +
        '<p class="hub-kicker">解物 · 中国古典益智玩具馆</p>' +
        '<h1 id="hubTitle">夜案长廊</h1>' +
        '<p class="hub-lead">四件器物，四种思维。递归、搜索、变换、结构——一条关于「人如何解决问题」的展览线。</p>' +
      '</header>' +
      '<div class="hub-body">' +
        '<div class="hub-gallery" role="group" aria-label="四卷器物">' + gallery + '</div>' +
        '<aside class="hub-label" aria-live="polite"></aside>' +
      '</div>' +
      '<footer class="hub-foot">' +
        '<span class="path">递归 → 搜索 → 变换 → 结构</span>' +
        '<span class="hint">← → 选择 · Enter 入馆</span>' +
      '</footer>';

    select(selected);
  }

  function setAppInert(on) {
    apps().forEach(function (app) {
      if (on) {
        app.setAttribute('inert', '');
        app.setAttribute('aria-hidden', 'true');
      } else {
        app.removeAttribute('inert');
        app.removeAttribute('aria-hidden');
      }
    });
  }

  function hideAllApps() {
    apps().forEach(function (app) { app.hidden = true; });
  }

  function showVolume(id, opts) {
    var v = byId[id];
    if (!v || v.status !== 'ready') return;
    activeId = id;
    apps().forEach(function (app) {
      var on = app.dataset.volume === id;
      app.hidden = !on;
      if (on) {
        app.removeAttribute('inert');
        app.removeAttribute('aria-hidden');
      } else {
        app.setAttribute('inert', '');
        app.setAttribute('aria-hidden', 'true');
      }
    });
    document.body.setAttribute('data-volume', id);
    var toy = toyFor(id);
    if (toy && toy.enter) toy.enter();
  }

  function pauseActive() {
    var toy = toyFor(activeId);
    if (toy && toy.pause) toy.pause();
  }

  function focusCard() {
    var card = root.querySelector('.hub-item[aria-current="true"]') || root.querySelector('.hub-item');
    if (!card) return;
    try { card.focus({ preventScroll: true }); } catch (e) { try { card.focus(); } catch (e2) {} }
  }

  function openHub(opts) {
    if (isOpen) return;
    isOpen = true;
    refresh();
    root.hidden = false;
    document.body.classList.add('hub-open');
    setAppInert(true);
    if (opts && opts.fromGame) pauseActive();
    setTimeout(focusCard, 0);
  }

  function closeHub(opts) {
    if (!isOpen) return;
    isOpen = false;
    root.hidden = true;
    document.body.classList.remove('hub-open');
    setAppInert(false);
    showVolume(activeId);
    if (opts && opts.focus === false) return;
  }

  function enter() {
    var v = byId[selected];
    if (!v || v.status !== 'ready') return;
    activeId = selected;
    closeHub({ focus: false });
  }

  function moveFocus(step) {
    var list = cards();
    if (!list.length) return;
    var current = list.indexOf(document.activeElement);
    if (current < 0) {
      current = list.map(function (c) { return c.dataset.hubId; }).indexOf(selected);
    }
    var next = (current + step + list.length) % list.length;
    select(list[next].dataset.hubId, { focus: true });
  }

  root.addEventListener('click', function (e) {
    var card = e.target.closest('.hub-item');
    var v = card ? byId[card.dataset.hubId] : null;
    if (v) {
      if (v.status === 'ready') {
        select(v.id);
        enter();
      } else {
        select(v.id, { focus: true });
      }
      return;
    }
    if (e.target.closest('[data-hub-enter]')) enter();
  });

  root.addEventListener('focusin', function (e) {
    var card = e.target.closest('.hub-item');
    if (card && card.dataset.hubId !== selected) select(card.dataset.hubId);
  });

  root.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
      var list = Array.prototype.slice.call(root.querySelectorAll('button:not([disabled])'));
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(-1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      if (cards()[0]) select(cards()[0].dataset.hubId, { focus: true });
    } else if (e.key === 'End') {
      var all = cards();
      if (all.length) select(all[all.length - 1].dataset.hubId, { focus: true });
    } else if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('hub-item')) {
      e.preventDefault();
      var v = byId[e.target.dataset.hubId];
      if (v && v.status === 'ready') {
        select(v.id);
        enter();
      }
    }
    // 馆内按键不再传给各卷的全局快捷键。
    e.stopPropagation();
  });

  var back = document.createElement('button');
  back.id = 'btnHub';
  back.className = 'hub-return';
  back.type = 'button';
  back.setAttribute('aria-label', '回到解物馆');
  back.textContent = '馆';
  back.addEventListener('click', function () { openHub({ fromGame: true }); });
  document.body.appendChild(back);

  build();

  var params = new URLSearchParams(global.location.search || '');
  var deep = params.get('play');
  var hash = String(global.location.hash || '').replace(/^#/, '');
  if (!byId[deep] && byId[hash]) deep = hash;
  if (!byId[deep] || byId[deep].status !== 'ready') deep = null;

  if (deep) {
    pendingDeep = deep;
    selected = deep;
    activeId = deep;
    hideAllApps();
    root.hidden = true;
    isOpen = false;
  } else {
    openHub({});
  }

  function volumeReady(id) {
    if (pendingDeep === id) {
      pendingDeep = null;
      showVolume(id);
    }
    if (isOpen) refresh();
  }

  document.addEventListener('jiewu:rings-ready', function () { volumeReady('rings'); });
  document.addEventListener('jiewu:huarong-ready', function () { volumeReady('huarong'); });
  document.addEventListener('jiewu:tangram-ready', function () { volumeReady('tangram'); });
  document.addEventListener('jiewu:burr-ready', function () { volumeReady('burr'); });

  // 兜底：深链目标若在本模块之后才注册完，也能接上。
  if (pendingDeep && toyFor(pendingDeep)) volumeReady(pendingDeep);

  JW.hub = {
    open: openHub,
    close: closeHub,
    enter: enter,
    select: select,
    isOpen: function () { return isOpen; },
    selected: function () { return selected; },
    active: function () { return activeId; }
  };
})(window);
