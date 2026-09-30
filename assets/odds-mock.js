/* =========================================================
   オッズのサンプル（デザイン確認用の固定値）

   本物のオッズではない。出走表の競走得点から「それらしい」数字を計算して出すだけで、
   同じレースなら毎回同じ値になる（乱数は使わない）。
   本物のオッズを入れるときは、このファイルを外して KUI.oddsPanel に実データを渡す。

   計算:
     1着の確率  p = exp((得点 - 平均) / 8) を合計1に正規化
     2車単 a-b    = p(a) * p(b)/(1-p(a))
     3連単 a-b-c  = 2車単(a-b) * p(c)/(1-p(a)-p(b))
     2車複・3連複 = 並び順を問わない組の合計、ワイド = その2車が3着以内に入る確率
     オッズ      = 0.75 / 確率（払戻率75%）。1.0 未満は 1.0、9999.9 で打ち止め
   ========================================================= */
(function (global) {
  'use strict';

  function toOdds(p) {
    if (!(p > 0)) return 9999.9;
    return Math.min(9999.9, Math.max(1.0, Math.round((0.75 / p) * 10) / 10));
  }

  /* 人気順に並べて人気（1〜）を振る */
  function ranked(rows) {
    rows.sort((a, b) => a.odds - b.odds || a.combination.localeCompare(b.combination));
    rows.forEach((r, i) => { r.popularity = i + 1; });
    return rows;
  }

  function mockOdds(race) {
    // 欠場を除いた出走選手（車番と競走得点）
    const cars = (race.racers || [])
      .map((r, i) => ({ car: global.KUI.racerCarNo(r, i), score: Number(r['競走得点']) || 0, out: String(r['車番']) === '欠' }))
      .filter(c => !c.out);
    if (cars.length < 3) return [];

    const mean = cars.reduce((s, c) => s + c.score, 0) / cars.length;
    const w = cars.map(c => Math.exp((c.score - mean) / 8));
    const total = w.reduce((s, x) => s + x, 0);
    const p = {};
    cars.forEach((c, i) => { p[c.car] = w[i] / total; });
    const ids = cars.map(c => c.car);

    const exacta = (a, b) => p[a] * p[b] / (1 - p[a]);
    const trifecta = (a, b, c) => exacta(a, b) * p[c] / (1 - p[a] - p[b]);

    const rows = { '2車単': [], '2車複': [], 'ワイド': [], '3連単': [], '3連複': [] };
    const sorted = ids.slice().sort((a, b) => a - b);

    ids.forEach(a => ids.forEach(b => {
      if (a !== b) rows['2車単'].push({ combination: `${a}-${b}`, odds: toOdds(exacta(a, b)) });
    }));

    sorted.forEach((a, i) => sorted.slice(i + 1).forEach(b => {
      rows['2車複'].push({ combination: `${a}-${b}`, odds: toOdds(exacta(a, b) + exacta(b, a)) });
      // ワイド: a と b が両方3着以内
      let pw = 0;
      ids.forEach(c => {
        if (c === a || c === b) return;
        [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]]
          .forEach(t => { pw += trifecta(t[0], t[1], t[2]); });
      });
      const o = toOdds(pw);
      rows['ワイド'].push({
        combination: `${a}-${b}`, odds: o,
        minOdds: Math.max(1.0, Math.round(o * 0.8 * 10) / 10),
        maxOdds: Math.round(o * 1.4 * 10) / 10
      });
    }));

    ids.forEach(a => ids.forEach(b => ids.forEach(c => {
      if (a !== b && b !== c && a !== c) {
        rows['3連単'].push({ combination: `${a}-${b}-${c}`, odds: toOdds(trifecta(a, b, c)) });
      }
    })));

    sorted.forEach((a, i) => sorted.slice(i + 1).forEach((b, j) => sorted.slice(i + j + 2).forEach(c => {
      const pt = [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]]
        .reduce((s, t) => s + trifecta(t[0], t[1], t[2]), 0);
      rows['3連複'].push({ combination: `${a}-${b}-${c}`, odds: toOdds(pt) });
    })));

    return Object.keys(rows).reduce((all, betType) =>
      all.concat(ranked(rows[betType]).map(r => Object.assign({ betType }, r))), []);
  }

  global.OddsMock = { mockOdds };
})(window);
