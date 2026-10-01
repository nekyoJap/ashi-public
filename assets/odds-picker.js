/* =========================================================
   投票パネル風のオッズ表示（車券は買えない。オッズを調べるだけ）

   券種を選び、1着・2着・3着（複系は 1車目・2車目・3車目）の欄で車番にチェックすると、
   その組み合わせ（フォーメーション）のオッズと人気を一覧で出す。ボックスにも切り替えられる。
   何も選んでいないときは、その券種の人気順上位を出す。

   OddsPicker.html(key, race, rows, opts) で描画し、OddsPicker.bind(root) でクリックを拾う。
   rows: [{ betType, combination: '1-2-3', odds, minOdds?, maxOdds?, popularity }]
   （複系の combination は車番の小さい順）。選択状態は key（開催ID＋レース番号）ごとに覚えておき、
   ページ全体を描き直しても消えない。
   ========================================================= */
(function (global) {
  'use strict';

  const KUI = global.KUI;
  const esc = KUI.esc;

  const TYPES = [
    { id: '3連単', size: 3, ordered: true },
    { id: '3連複', size: 3, ordered: false },
    { id: '2車単', size: 2, ordered: true },
    { id: '2車複', size: 2, ordered: false },
    { id: 'ワイド', size: 2, ordered: false }
  ];
  const TOP_WHEN_EMPTY = 10;   // 何も選んでいないときに出す人気順の件数
  const MAX_SHOWN = 120;       // 選んだ組がこれより多いときは先頭だけ出す

  const store = new Map();     // key -> { race, rows, byKey, opts, ui }

  const typeOf = id => TYPES.find(t => t.id === id) || TYPES[0];

  function entry(key, race, rows, opts) {
    let e = store.get(key);
    if (!e) {
      e = { ui: { type: TYPES[0].id, box: false, cols: [new Set(), new Set(), new Set()] } };
      store.set(key, e);
    }
    if (race) {
      e.race = race;
      e.rows = rows || [];
      e.opts = opts || {};
      e.byKey = {};
      e.rows.forEach(r => { e.byKey[`${r.betType}|${r.combination}`] = r; });
    }
    return e;
  }

  /* 出走選手（車番順）。欠場は選べない */
  function racersOf(race) {
    return (race.racers || []).map((r, i) => ({
      car: KUI.racerCarNo(r, i),
      badge: KUI.racerBikeBadge(r, i),   // 欠場は本来の車番の色で「欠」
      name: r['選手名'] || '',
      meta: [r['府県'], r['級班'], r['期別'], r['競走得点']].filter(v => v !== undefined && v !== '').join(' '),
      out: String(r['車番']) === '欠'
    })).sort((a, b) => a.car - b.car);
  }

  /* 選んだ車番から組み合わせを作る */
  function combinations(ui) {
    const t = typeOf(ui.type);
    const key = cars => (t.ordered ? cars : cars.slice().sort((a, b) => a - b)).join('-');
    const out = new Set();

    if (ui.box) {
      const picked = [...ui.cols[0]].sort((a, b) => a - b);
      const walk = (chosen) => {
        if (chosen.length === t.size) { out.add(key(chosen)); return; }
        picked.forEach(c => { if (!chosen.includes(c)) walk(chosen.concat(c)); });
      };
      walk([]);
    } else {
      const cols = ui.cols.slice(0, t.size).map(s => [...s].sort((a, b) => a - b));
      const walk = (i, chosen) => {
        if (i === t.size) { out.add(key(chosen)); return; }
        cols[i].forEach(c => { if (!chosen.includes(c)) walk(i + 1, chosen.concat(c)); });
      };
      walk(0, []);
    }

    // 車番順に並べる
    return [...out].sort((a, b) => {
      const x = a.split('-').map(Number), y = b.split('-').map(Number);
      for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
      return 0;
    });
  }

  function comboHtml(combination, ordered) {
    return `<span class="odds-combo">${combination.split('-')
      .map((c, i) => (i ? `<span class="odds-sep">${ordered ? '-' : '='}</span>` : '') + KUI.bikeBadge(c)).join('')}</span>`;
  }

  const fmt = v => (v === null || v === undefined ? '-' : Number(v).toFixed(1));

  function oddsText(r, typeId) {
    if (!r) return '<span class="muted">-</span>';
    return typeId === 'ワイド' ? `${fmt(r.minOdds)}<span class="odds__range">〜</span>${fmt(r.maxOdds)}` : fmt(r.odds);
  }

  function resultRow(r, combination, t) {
    return `
      <li class="${r && r.popularity === 1 ? 'is-fav' : ''}">
        ${comboHtml(combination, t.ordered)}
        <span class="picker__odds">${oddsText(r, t.id)}</span>
        <span class="picker__pop">${r && r.popularity ? `${r.popularity}人気` : ''}</span>
      </li>`;
  }

  function resultHtml(e) {
    const t = typeOf(e.ui.type);
    const combos = combinations(e.ui);

    if (!combos.length) {
      const top = e.rows.filter(r => r.betType === t.id).slice(0, TOP_WHEN_EMPTY);
      return `
        <div class="picker__summary"><b>${t.id} 人気順 上位${top.length}</b>
          <span class="small muted">車番を選ぶと、その組み合わせのオッズが出ます</span></div>
        <ol class="picker__list">${top.map(r => resultRow(r, r.combination, t)).join('')}</ol>`;
    }

    const found = combos.map(c => e.byKey[`${t.id}|${c}`]).filter(Boolean);
    const values = found.map(r => (t.id === 'ワイド' ? r.minOdds : r.odds)).filter(v => v !== null && v !== undefined);
    const range = values.length
      ? `${fmt(Math.min(...values))} 〜 ${fmt(t.id === 'ワイド' ? Math.max(...found.map(r => r.maxOdds)) : Math.max(...values))}`
      : '';
    const shown = combos.slice(0, MAX_SHOWN);
    return `
      <div class="picker__summary"><b>${combos.length}組 選択中</b><span class="picker__range">${range}</span></div>
      <ol class="picker__list">${shown.map(c => resultRow(e.byKey[`${t.id}|${c}`], c, t)).join('')}</ol>
      ${combos.length > shown.length ? `<p class="small muted" style="margin:6px 0 0;">ほか ${combos.length - shown.length}組</p>` : ''}`;
  }

  function columnLabels(ui) {
    const t = typeOf(ui.type);
    if (ui.box) return ['選択'];
    return Array.from({ length: t.size }, (_, i) => (t.ordered ? `${i + 1}着` : `${i + 1}車目`));
  }

  function html(key, race, rows, opts) {
    const e = entry(key, race, rows, opts);
    if (!e.rows.length) return '';
    const ui = e.ui;
    const labels = columnLabels(ui);
    const racers = racersOf(e.race);
    const check = (col, r) => {
      const on = ui.cols[col].has(r.car);
      return `<button type="button" class="picker__check${on ? ' is-on' : ''}" data-op="toggle" data-col="${col}"
        data-car="${r.car}" aria-pressed="${on}" aria-label="${r.car}番 ${labels[col]}"${r.out ? ' disabled' : ''}>✓</button>`;
    };

    return `
      <div class="picker" data-picker="${esc(key)}" style="--picker-cols:${labels.length}">
        <div class="odds__head">
          <b>オッズ</b>
          ${e.opts.sample ? '<span class="badge badge--gold">サンプル（固定値）</span>' : ''}
          ${e.opts.note ? `<span class="section-head__tail small muted">${esc(e.opts.note)}</span>` : ''}
        </div>

        <div class="picker__tabs" role="tablist">
          ${TYPES.map(t => `<button type="button" role="tab" class="picker__tab${t.id === ui.type ? ' is-active' : ''}"
            aria-selected="${t.id === ui.type}" data-op="type" data-type="${t.id}">${t.id}</button>`).join('')}
        </div>

        <div class="picker__grid">
          <div class="picker__row picker__row--head">
            <span>車</span><span>選手</span>${labels.map(l => `<span class="picker__col">${l}</span>`).join('')}
          </div>
          ${racers.map(r => `
            <div class="picker__row${r.out ? ' is-out' : ''}">
              <span>${r.badge}</span>
              <span class="picker__racer"><b>${esc(r.name)}</b><span class="small muted">${esc(r.meta)}</span></span>
              ${labels.map((_, col) => check(col, r)).join('')}
            </div>`).join('')}
          <div class="picker__row picker__row--tools">
            <span></span>
            <span><button type="button" class="btn btn--sm" data-op="box">⇄ ${ui.box ? 'フォーメーションに切替' : 'ボックスに切替'}</button></span>
            ${labels.map((_, col) => `<button type="button" class="picker__all" data-op="all" data-col="${col}">全</button>`).join('')}
          </div>
          <div class="picker__row picker__row--tools">
            <span></span><span></span>
            ${labels.map((_, col) => `<button type="button" class="picker__clear" data-op="clear" data-col="${col}">消</button>`).join('')}
          </div>
        </div>

        <div class="picker__result">${resultHtml(e)}</div>
      </div>`;
  }

  function bind(root) {
    root.addEventListener('click', ev => {
      const btn = ev.target.closest('.picker [data-op]');
      if (!btn) return;
      const node = btn.closest('[data-picker]');
      const key = node.dataset.picker;
      const e = store.get(key);
      if (!e) return;
      const ui = e.ui;
      const col = Number(btn.dataset.col);
      const selectable = racersOf(e.race).filter(r => !r.out).map(r => r.car);

      switch (btn.dataset.op) {
        case 'type':
          ui.type = btn.dataset.type;
          break;
        case 'toggle': {
          const car = Number(btn.dataset.car);
          if (ui.cols[col].has(car)) ui.cols[col].delete(car); else ui.cols[col].add(car);
          break;
        }
        case 'all':
          selectable.forEach(c => ui.cols[col].add(c));
          break;
        case 'clear':
          ui.cols[col].clear();
          break;
        case 'box':
          ui.box = !ui.box;
          ui.cols.forEach(s => s.clear());
          break;
      }
      node.outerHTML = html(key);
    });
  }

  global.OddsPicker = { html, bind, combinations };
})(window);
