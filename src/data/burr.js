/*
 * 解物 · 卷四 鲁班锁数据
 *
 * 体素坐标：每根木条由若干单位格组成，格点 [x, y, z]，z 为世界竖直方向。
 * 六根锁使用 chinesejoinery.com 页面里的实物 3D 体素（每根落在 6×6×6 格内）。
 * 三根「三通」是自设计平板件：常规 2×2×6 方木在纯轴向平移下无解，
 * 平板三通保留三轴互锁与槽口，且可拆可装。
 *
 * 所有木条只做轴向平移；偏移分量的绝对值达到 5 即视为拆下。
 */
(function (global) {
  'use strict';

  var JW = global.JW || (global.JW = {});
  JW.data = JW.data || {};

  function box(x0, x1, y0, y1, z0, z1) {
    var out = [];
    for (var x = x0; x <= x1; x++) {
      for (var y = y0; y <= y1; y++) {
        for (var z = z0; z <= z1; z++) out.push([x, y, z]);
      }
    }
    return out;
  }

  function key(c) {
    return c[0] + ',' + c[1] + ',' + c[2];
  }

  function without(cells, holes) {
    var dead = {};
    holes.forEach(function (c) { dead[key(c)] = true; });
    return cells.filter(function (c) { return !dead[key(c)]; });
  }

  /* ───────── 六根锁 · 六子连芳 ───────── */

  var sixPieces = [
    {
      id: '1',
      name: '钥匙',
      short: '钥匙',
      color: '#c8a05a',
      pull: [1, 0, 0],
      cells: box(0, 5, 2, 3, 3, 4),
      note: '实心长条，标准拆序里第一根抽出。'
    },
    {
      id: '928',
      name: '双榫',
      short: '双榫',
      color: '#a97a45',
      pull: [1, 0, 0],
      cells: [
        [0,2,1],[0,2,2],[0,3,1],[0,3,2],
        [1,2,1],[1,3,1],
        [2,2,1],[2,2,2],
        [3,2,1],[3,2,2],
        [4,2,1],[4,3,1],
        [5,2,1],[5,2,2],[5,3,1],[5,3,2]
      ],
      note: '两端各有双榫，扣住上下两根横条。'
    },
    {
      id: '1024',
      name: '三叉',
      short: '三叉',
      color: '#8f6238',
      pull: [0, 0, 1],
      cells: [
        [1,0,2],[1,0,3],[1,1,2],[1,1,3],[1,2,2],[1,3,2],
        [1,4,2],[1,4,3],[1,5,2],[1,5,3],
        [2,0,2],[2,0,3],[2,5,2],[2,5,3]
      ],
      note: '中段留口，给钥匙让出第一步行道。'
    },
    {
      id: '824',
      name: '云头',
      short: '云头',
      color: '#b98b55',
      pull: [0, 0, 1],
      cells: [
        [3,0,2],[3,0,3],[3,3,2],[3,4,2],[3,4,3],[3,5,2],[3,5,3],
        [4,0,2],[4,0,3],[4,1,2],[4,1,3],[4,2,2],[4,3,2],
        [4,4,2],[4,4,3],[4,5,2],[4,5,3]
      ],
      note: '一侧连开三缺，像云头，也像给邻条留的门。'
    },
    {
      id: '975',
      name: '燕尾',
      short: '燕尾',
      color: '#7d542e',
      pull: [0, 1, 0],
      cells: [
        [2,3,0],[2,3,1],[2,3,2],[2,3,5],
        [2,4,0],[2,4,1],[2,4,2],[2,4,3],[2,4,4],[2,4,5],
        [3,3,0],[3,3,1],[3,3,5],
        [3,4,0],[3,4,1],[3,4,4],[3,4,5]
      ],
      note: '燕尾开口朝外，抽出时让过中间两根。'
    },
    {
      id: '256',
      name: '边柱',
      short: '边柱',
      color: '#9c7040',
      pull: [0, 0, 1],
      cells: [
        [2,1,0],[2,1,1],[2,1,2],[2,1,3],[2,1,4],[2,1,5],
        [2,2,0],[2,2,5],
        [3,1,0],[3,1,1],[3,1,2],[3,1,3],[3,1,4],[3,1,5],
        [3,2,0],[3,2,5]
      ],
      note: '最后一根，四边皆空，却仍被整座锁压着。'
    }
  ];

  /* ───────── 三根锁 · 三通 ───────── */

  var aCells = without(box(0, 5, 0, 2, 0, 0), [
    [2, 1, 0], [3, 1, 0], [4, 1, 0]
  ]);
  var bCells = without(box(2, 4, 1, 1, 0, 5), [
    [2, 1, 2], [2, 1, 3]
  ]);
  var cCells = without(box(2, 2, 0, 5, 1, 3), [
    [2, 1, 1]
  ]);

  var threePieces = [
    {
      id: 'A',
      name: '槽板',
      short: '槽板',
      color: '#a97a45',
      pull: [0, 0, -1],
      cells: aCells,
      note: '底板，中间开一道横槽，先向下抽出。'
    },
    {
      id: 'B',
      name: '舌板',
      short: '舌板',
      color: '#c0955f',
      pull: [1, 0, 0],
      cells: bCells,
      note: '舌板穿过槽板与压板，拆完底板后向 +x 推出。'
    },
    {
      id: 'C',
      name: '压板',
      short: '压板',
      color: '#8a5e34',
      pull: [1, 0, 0],
      cells: cCells,
      note: '压板压住舌板中段，最后向 +x 松开。'
    }
  ];

  /* ───────── 六片平板 · 六合（自设计教学形制） ───────── */

  var w1Cells = without(box(0, 5, 0, 2, 0, 0), [
    [2, 1, 0], [3, 1, 0], [4, 1, 0]
  ]);
  var w2Cells = without(box(2, 4, 1, 1, 0, 5), [
    [2, 1, 2], [2, 1, 3]
  ]);
  var w3Cells = without(box(2, 2, 0, 4, 1, 3), [
    [2, 1, 1]
  ]);
  var w4Cells = without(box(0, 5, 0, 4, 4, 4), [
    [2, 1, 4], [3, 1, 4], [4, 1, 4]
  ]);
  var w5Cells = box(5, 5, 0, 4, 5, 5);
  var w6Cells = box(0, 5, 5, 5, 4, 5);

  var plateSixPieces = [
    {
      id: 'W1',
      name: '底板',
      short: '底板',
      color: '#a97a45',
      pull: [0, 0, -1],
      cells: w1Cells,
      note: '与三通同式的底板，中间开槽，向下抽出。'
    },
    {
      id: 'W2',
      name: '舌板',
      short: '舌板',
      color: '#c0955f',
      pull: [1, 0, 0],
      cells: w2Cells,
      note: '穿过底板与压盖，拆到中段时向 +x 推出。'
    },
    {
      id: 'W3',
      name: '压板',
      short: '压板',
      color: '#8a5e34',
      pull: [1, 0, 0],
      cells: w3Cells,
      note: '横压舌板，等舌板退出后才松开。'
    },
    {
      id: 'W4',
      name: '压盖',
      short: '压盖',
      color: '#b98b55',
      pull: [0, 0, 1],
      cells: w4Cells,
      note: '盖住整座锁的上层，边销不移就抬不起。'
    },
    {
      id: 'W5',
      name: '边销',
      short: '边销',
      color: '#7d542e',
      pull: [0, 1, 0],
      cells: w5Cells,
      note: '侧面插销，压住压盖；先向 +y 抽出。'
    },
    {
      id: 'W6',
      name: '边梁',
      short: '边梁',
      color: '#9c7040',
      pull: [0, 0, 1],
      cells: w6Cells,
      note: '最外一道边梁，向上提起后，边销才有退路。'
    }
  ];

  /* ───────── 九片平板 · 九重（自设计长链教学形制） ───────── */

  var o3Cells = box(0, 5, 5, 5, 6, 6);
  var o2Cells = box(0, 5, 6, 6, 6, 6);
  var o1Cells = box(0, 5, 6, 6, 7, 7);

  var plateNinePieces = [
    {
      id: 'O1',
      name: '顶盖',
      short: '顶盖',
      color: '#b58a52',
      pull: [0, 1, 0],
      cells: o1Cells,
      note: '最上面一道盖板，向上提起后才轮到压销。'
    },
    {
      id: 'O2',
      name: '压销',
      short: '压销',
      color: '#9a6b3c',
      pull: [0, 0, 1],
      cells: o2Cells,
      note: '压住上梁的中销，顶盖移走后向 +z 退出。'
    },
    {
      id: 'O3',
      name: '上梁',
      short: '上梁',
      color: '#86592f',
      pull: [0, 1, 0],
      cells: o3Cells,
      note: '贴着边梁的外封，压销退出后向上提起。'
    }
  ];

  /* ───────── 四片平板 · 四象（自设计穿销形制） ───────── */

  var d1Cells = without(box(0, 5, 0, 2, 0, 0), [
    [2, 1, 0], [3, 1, 0], [4, 1, 0],
    [0, 1, 0], [1, 1, 0]
  ]);
  var d4Cells = [
    [0, 1, 0], [1, 1, 0]
  ].concat(box(0, 1, 0, 2, -1, -1));

  var plateFourPieces = [
    {
      id: 'D1',
      name: '底板',
      short: '底板',
      color: '#a97a45',
      pull: [0, 0, -1],
      cells: d1Cells,
      note: '底板多开一个销孔，穿销不退就抽不动。'
    },
    {
      id: 'D2',
      name: '舌板',
      short: '舌板',
      color: '#c0955f',
      pull: [1, 0, 0],
      cells: w2Cells,
      note: '穿过底板与压板，拆到底板后向 +x 推出。'
    },
    {
      id: 'D3',
      name: '压板',
      short: '压板',
      color: '#8a5e34',
      pull: [1, 0, 0],
      cells: w3Cells,
      note: '压住舌板中段，最后向 +x 松开。'
    },
    {
      id: 'D4',
      name: '穿销',
      short: '穿销',
      color: '#6f4a28',
      pull: [-1, 0, 0],
      cells: d4Cells,
      note: '横穿底板销孔，前端有挡块；先向 -x 退出，底板才松。'
    }
  ];

  /* ───────── 八片 / 十片 / 十二片 · 别式长链 ───────── */

  var e1Cells = box(0, 5, 6, 6, 6, 6);
  var e2Cells = box(0, 5, 5, 5, 6, 6);
  var t1Cells = box(0, 5, 7, 7, 7, 7);
  var l1Cells = box(0, 5, 8, 8, 8, 8);
  var l2Cells = box(0, 5, 7, 7, 8, 8);
  var l3Cells = box(0, 5, 7, 7, 7, 7);

  var eightSealPieces = [
    {
      id: 'E1',
      name: '顶梁',
      short: '顶梁',
      color: '#b58a52',
      pull: [0, 1, 0],
      cells: e1Cells,
      note: '六合最上面再加的一根梁，先向上提起。'
    },
    {
      id: 'E2',
      name: '外销',
      short: '外销',
      color: '#9a6b3c',
      pull: [0, 0, 1],
      cells: e2Cells,
      note: '顶梁移走后，外销向 +z 退出，边梁才松。'
    }
  ];

  var tenSealPieces = [
    {
      id: 'T1',
      name: '天锁',
      short: '天锁',
      color: '#b58a52',
      pull: [0, 0, 1],
      cells: t1Cells,
      note: '压在九重顶盖之上的锁条，先向 +z 退出。'
    }
  ];

  var twelveSealPieces = [
    {
      id: 'L1',
      name: '顶封',
      short: '顶封',
      color: '#b58a52',
      pull: [0, 1, 0],
      cells: l1Cells,
      note: '十二楼最上面一道封条，先向上提起。'
    },
    {
      id: 'L2',
      name: '上销',
      short: '上销',
      color: '#9a6b3c',
      pull: [0, 1, 0],
      cells: l2Cells,
      note: '顶封移走后向上提起。'
    },
    {
      id: 'L3',
      name: '中销',
      short: '中销',
      color: '#86592f',
      pull: [0, 0, 1],
      cells: l3Cells,
      note: '上销移走后向 +z 退出，九重的外封才启动。'
    }
  ];

  /* ───────── 关卡 ───────── */

  var levels = [
    {
      id: 'burr-three',
      name: '三通',
      sub: '三片平板 · 一横两竖',
      chapter: '教学 · 三片',
      note: '三片平板互相咬住：先抽底板，再推舌板，最后压板自松。装回去时把顺序倒过来。',
      pieces: ['A', 'B', 'C'],
      pullOrder: ['A', 'B', 'C'],
      assembleOrder: ['C', 'B', 'A'],
      stage: {
        'A': [0, 0, -5],
        'B': [5, 0, 0],
        'C': [5, 0, 5]
      },
      targetTime: 120,
      fact: '「三通」是鲁班锁的入门式：三片木片在一处交会，拆开只要两三步，装回去却要看清槽口。'
    },
    {
      id: 'burr-six',
      name: '六子连芳',
      sub: '六根木条 · 三轴相扣',
      chapter: '经典 · 六根',
      note: '六根木条三轴相扣。钥匙先出，最后一根叫「锁」。拆与装互为逆序；卡住时按提示。',
      pieces: ['1', '928', '1024', '824', '975', '256'],
      pullOrder: ['1', '1024', '975', '824', '928', '256'],
      assembleOrder: ['256', '928', '824', '975', '1024', '1'],
      stage: {
        '1': [5, 0, 0],
        '928': [5, 0, 5],
        '1024': [0, 0, 5],
        '824': [0, 5, 5],
        '975': [0, 5, 0],
        '256': [5, 5, 0]
      },
      targetTime: 300,
      fact: '六根锁的 6 根木条各占 2×2×6 的格点范围；本卷使用 chinesejoinery 的实物体素数据，标准拆序为 +x、+z、+y、+z、+x、+z。'
    },
    {
      id: 'burr-sixplate',
      name: '六合',
      sub: '六片平板 · 边梁压顶',
      chapter: '进阶 · 六片',
      note: '三通的三片之外，又叠了压盖、边销与边梁。先提边梁，再抽边销，压盖才抬得起；装回去按逆序落位。',
      pieces: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'],
      pullOrder: ['W6', 'W5', 'W4', 'W1', 'W2', 'W3'],
      assembleOrder: ['W3', 'W2', 'W1', 'W4', 'W5', 'W6'],
      stage: {
        'W1': [0, 0, -5],
        'W2': [5, 0, 0],
        'W3': [5, 0, 5],
        'W4': [0, 0, 5],
        'W5': [0, 5, 0],
        'W6': [0, 5, 5]
      },
      targetTime: 240,
      fact: '「六合」是为《解物》卷四自设计的平板六片锁：在三通的三轴互锁上再叠压盖、边销与边梁，用来练「先解外锁、再解内锁」的次序感；不是传统实物复原。'
    },
    {
      id: 'burr-nine',
      name: '九重',
      sub: '九片 · 三重外封',
      chapter: '进阶 · 九片',
      note: '六合之外再叠顶盖、压销、上梁三道外封：顶盖先提，压销才退；外封尽去，里面仍是六合的次序。',
      pieces: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'O3', 'O2', 'O1'],
      pullOrder: ['O1', 'O2', 'O3', 'W6', 'W5', 'W4', 'W1', 'W2', 'W3'],
      assembleOrder: ['W3', 'W2', 'W1', 'W4', 'W5', 'W6', 'O3', 'O2', 'O1'],
      stage: {
        'W1': [0, 0, -5],
        'W2': [5, 0, 0],
        'W3': [5, 0, 5],
        'W4': [0, 0, 5],
        'W5': [0, 5, 0],
        'W6': [0, 5, 5],
        'O3': [0, 6, -6],
        'O2': [0, 0, -6],
        'O1': [0, 6, 0]
      },
      targetTime: 360,
      fact: '「九重」是为《解物》卷四自设计的九片长链教学关：在六合之上再加顶盖、压销、上梁三道外封，把拆装链拉长到九件，用来练长依赖链的读图与记忆；不是传统实物复原。'
    },
    {
      id: 'burr-four',
      name: '四象',
      sub: '四片平板 · 穿销',
      chapter: '别式 · 四片',
      note: '三通之外多一根穿销，横穿底板销孔。销不退出，底板就抽不动；销一退，里面仍是三通的次序。',
      pieces: ['D1', 'D2', 'D3', 'D4'],
      pullOrder: ['D4', 'D1', 'D2', 'D3'],
      assembleOrder: ['D3', 'D2', 'D1', 'D4'],
      stage: {
        'D1': [0, 0, -5],
        'D2': [5, 0, 0],
        'D3': [5, 0, 5],
        'D4': [0, 5, 0]
      },
      targetTime: 150,
      fact: '「四象」是为《解物》卷四自设计的穿销教学关：在平板三通上横穿一根带挡块的销子，用来练「先拔销、再抽板」的次序；不是传统实物复原。'
    },
    {
      id: 'burr-eight',
      name: '八方',
      sub: '八片 · 双封压梁',
      chapter: '别式 · 八片',
      note: '六合之上再加顶梁与外销：顶梁先提，外销才退，边梁才松；装回去仍是逆序。',
      pieces: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'E2', 'E1'],
      pullOrder: ['E1', 'E2', 'W6', 'W5', 'W4', 'W1', 'W2', 'W3'],
      assembleOrder: ['W3', 'W2', 'W1', 'W4', 'W5', 'W6', 'E2', 'E1'],
      stage: {
        'W1': [0, 0, -5],
        'W2': [5, 0, 0],
        'W3': [5, 0, 5],
        'W4': [0, 0, 5],
        'W5': [0, 5, 0],
        'W6': [0, 5, 5],
        'E1': [-6, 0, 0],
        'E2': [-6, 0, 0]
      },
      targetTime: 300,
      fact: '「八方」是为《解物》卷四自设计的八片别式：六合再叠顶梁与外销，把外锁从两道加到三道；不是传统实物复原。'
    },
    {
      id: 'burr-ten',
      name: '十全',
      sub: '十片 · 天锁',
      chapter: '别式 · 十片',
      note: '九重之外再加一道天锁，压在顶盖之上。天锁先退，九重的长链才启动。',
      pieces: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'O3', 'O2', 'O1', 'T1'],
      pullOrder: ['T1', 'O1', 'O2', 'O3', 'W6', 'W5', 'W4', 'W1', 'W2', 'W3'],
      assembleOrder: ['W3', 'W2', 'W1', 'W4', 'W5', 'W6', 'O3', 'O2', 'O1', 'T1'],
      stage: {
        'W1': [0, 0, -5],
        'W2': [5, 0, 0],
        'W3': [5, 0, 5],
        'W4': [0, 0, 5],
        'W5': [0, 5, 0],
        'W6': [0, 5, 5],
        'O3': [0, 6, -6],
        'O2': [0, 0, -6],
        'O1': [0, 6, 0],
        'T1': [-6, 0, 0]
      },
      targetTime: 420,
      fact: '「十全」是为《解物》卷四自设计的十片别式：在九重上再加一道天锁，拆装链正好十件；不是传统实物复原。'
    },
    {
      id: 'burr-twelve',
      name: '十二楼',
      sub: '十二片 · 三重天封',
      chapter: '别式 · 十二片',
      note: '九重之上再叠顶封、上销、中销三道天封。一层压一层，拆到最后仍是三通。',
      pieces: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'O3', 'O2', 'O1', 'L3', 'L2', 'L1'],
      pullOrder: ['L1', 'L2', 'L3', 'O1', 'O2', 'O3', 'W6', 'W5', 'W4', 'W1', 'W2', 'W3'],
      assembleOrder: ['W3', 'W2', 'W1', 'W4', 'W5', 'W6', 'O3', 'O2', 'O1', 'L3', 'L2', 'L1'],
      stage: {
        'W1': [0, 0, -5],
        'W2': [5, 0, 0],
        'W3': [5, 0, 5],
        'W4': [0, 0, 5],
        'W5': [0, 5, 0],
        'W6': [0, 5, 5],
        'O3': [0, 6, -6],
        'O2': [0, 0, -6],
        'O1': [0, 6, 0],
        'L3': [-6, 0, 0],
        'L2': [-6, 0, 0],
        'L1': [-6, 0, 0]
      },
      targetTime: 480,
      fact: '「十二楼」是为《解物》卷四自设计的十二片长链别式：在九重之上再叠顶封、上销、中销，把拆装链拉到十二件；不是传统实物复原。'
    }
  ];

  var pieces = threePieces.concat(
    plateSixPieces, plateNinePieces, sixPieces,
    plateFourPieces, eightSealPieces, tenSealPieces, twelveSealPieces
  );
  var byId = {};
  pieces.forEach(function (p) { byId[p.id] = p; });

  var levelById = {};
  levels.forEach(function (L) { levelById[L.id] = L; });

  JW.data.burr = {
    grid: 6,
    threshold: 5,
    pieces: pieces,
    pieceById: byId,
    levels: levels,
    levelById: levelById,
    facts: [
      '鲁班锁不靠钉子与胶，只靠六根木条的榫口互相压住。',
      '拆与装是同一组约束的两个方向：拆时找唯一能动的件，装时按逆序放回。',
      '三通是平板件；常规 2×2×6 方木的三根锁在纯轴向平移下无解（IBM 三件 burr 定理）。',
      '标准六根拆序：钥匙 +x、三叉 +z、燕尾 +y、云头 +z、双榫 +x，最后边柱 +z。',
      '「六合」在平板三通上叠两层外锁：边梁、边销、压盖依次退让，内层才松。',
      '「九重」把外封加到三重，拆装链拉到九件；逐件读依赖，比记顺序更可靠。'
    ]
  };
})(window);
