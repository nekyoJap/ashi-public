/* =========================================================
   競輪情報サイト 共通ユーティリティ
   ========================================================= */
(function (global) {
  'use strict';

  const GCS_BASE = 'https://storage.googleapis.com/asilogkeirin';

  /* ---------- 文字列 ---------- */
  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------- 日付 ---------- */
  function ymd(date) {
    return date.toLocaleDateString('sv-SE'); // YYYY-MM-DD
  }

  function compact(dateStr) {
    return dateStr.replace(/-/g, '');
  }

  function shiftDate(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return ymd(d);
  }

  /* 「今日」と時刻は日本時間で判定する（端末の時計が日本時間とは限らないため） */
  function jstNow() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date());
    const get = t => (parts.find(p => p.type === t) || {}).value;
    return { ymd: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
  }

  /* 出走表の既定日: 日本時間22時以降は翌日 */
  function defaultRaceDate() {
    const now = jstNow();
    return now.hour >= 22 ? shiftDate(now.ymd, 1) : now.ymd;
  }

  /* 結果の既定日: 日本時間19時より前は前日 */
  function defaultResultDate() {
    const now = jstNow();
    return now.hour < 19 ? shiftDate(now.ymd, -1) : now.ymd;
  }

  function labelDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return dateStr;
    const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    return `${d.getMonth() + 1}月${d.getDate()}日(${w})`;
  }

  /* ---------- グレード ---------- */
  const GRADE_LABEL = {
    GP: 'GP', G1: 'GⅠ', G2: 'GⅡ', G3: 'GⅢ', F1: 'FⅠ', F2: 'FⅡ'
  };

  function gradeKey(grade) {
    return String(grade || '').toUpperCase().replace(/[Ⅰ]/g, '1')
      .replace(/[Ⅱ]/g, '2').replace(/[Ⅲ]/g, '3').replace(/\s/g, '');
  }

  function gradeBadge(grade) {
    const key = gradeKey(grade);
    const cls = GRADE_LABEL[key] ? key.toLowerCase() : 'f2';
    const label = GRADE_LABEL[key] || esc(grade || '-');
    return `<span class="grade grade--${cls}">${label}</span>`;
  }

  /* ---------- 車番 ---------- */
  function bikeBadge(num, size) {
    const n = Number(num);
    const cls = n >= 1 && n <= 9 ? `bike-${n}` : 'bike-1';
    const sz = size === 'lg' ? ' bike--lg' : '';
    return `<span class="bike ${cls}${sz}">${esc(num)}</span>`;
  }

  /* 欠場選手は出走表で車番が「欠」になる。並び順が本来の車番と一致するので、
     その車番の色で「欠」を表示する（直近120日・81件で結果の車番と全件一致） */
  function racerCarNo(racer, index) {
    const n = Number(racer['車番']);
    return n >= 1 && n <= 9 ? n : index + 1;
  }

  function racerBikeBadge(racer, index) {
    const car = racerCarNo(racer, index);
    const label = String(racer['車番']) === '欠' ? '欠' : car;
    return `<span class="bike bike-${car}">${esc(label)}</span>`;
  }

  /* ---------- 脚質 ---------- */
  function legBadge(leg) {
    const v = String(leg || '').trim();
    let cls = 'other';
    if (v.indexOf('逃') === 0) cls = 'nige';
    else if (v.indexOf('両') === 0) cls = 'makuri';
    else if (v.indexOf('追') === 0 || v.indexOf('差') === 0) cls = 'sashi';
    return `<span class="leg leg--${cls}">${esc(v || '-')}</span>`;
  }

  /* ---------- 決まり手 ---------- */
  const KIMARITE_CLASS = { '逃': 'nige', '捲': 'makuri', '差': 'sashi', 'マ': 'mark' };

  function kimariteBadge(k) {
    const v = String(k || '').trim();
    if (!v) return '';
    return `<span class="leg leg--${KIMARITE_CLASS[v] || 'other'}">${esc(v)}</span>`;
  }

  /* ---------- ライン ---------- */
  function linesHtml(lines) {
    const raw = String(lines || '').trim();
    if (!raw) return '<span class="muted">並び情報なし</span>';

    const groups = raw.split(/[・\s]+/).filter(Boolean);
    const html = groups.map(g => {
      const cars = g.split('').filter(c => /[1-9]/.test(c));
      if (!cars.length) return `<span class="lines__group">${esc(g)}</span>`;
      return `<span class="lines__group">${cars.map(c => bikeBadge(c)).join('')}</span>`;
    }).join('');

    return `<span class="lines__body">${html}</span>`;
  }

  /* ---------- 開催ラベル ---------- */
  function dayLabel(day) {
    return `${day.place} ${GRADE_LABEL[gradeKey(day.grade)] || day.grade} ${day.race_day}日目`;
  }

  /* ---------- データ取得 ---------- */
  async function fetchJson(kind, dateStr) {
    const file = `${kind}_${compact(dateStr)}.json`;
    const res = await fetch(`${GCS_BASE}/${kind}/${file}`);
    if (!res.ok) throw new Error(`not found: ${file}`);
    return res.json();
  }

  function fetchRaceInfo(dateStr) {
    return fetchJson('race_info', dateStr);
  }

  function fetchRaceResult(dateStr) {
    return fetchJson('race_result', dateStr);
  }

  /* ---------- 発走済みの判定 ----------
     結果 JSON に着順が載っているレースを発走済みとみなす（発走時刻は GCS に無い）。
     結果 JSON はレース翌日の 00:12 ごろ置かれるため、当日の日中は全レースが発走前扱いになる */
  function finishedByPlace(results) {
    const map = {};
    (Array.isArray(results) ? results : []).forEach(m => {
      const done = map[m.place] || (map[m.place] = new Set());
      (m.races || []).forEach(r => { if ((r.racers || []).length) done.add(Number(r.race_num)); });
    });
    return map;
  }

  /* 次に発走するレース（結果の無い最小のレース番号）。全レース発走済みなら null */
  function nextRaceNum(races, done) {
    const r = (races || []).find(r => !(done && done.has(Number(r.race_num))));
    return r ? Number(r.race_num) : null;
  }

  /* ---------- 評価（localStorage） ---------- */
  function evalKey(raceId, racerName) {
    return `eval:${raceId}:${racerName}`;
  }

  function loadEvalRaw(raceId, racerName) {
    try {
      const raw = localStorage.getItem(evalKey(raceId, racerName));
      if (!raw) return null;
      const data = JSON.parse(raw);
      data.comments = data.comments || [];
      return data;
    } catch (e) {
      return null;
    }
  }

  /* その開催日（day）の評価と評価コメント。評価は開催を通して1つ、コメントは日目ごと */
  function loadEvaluation(day, racerName) {
    const data = loadEvalRaw(day.race_id, racerName);
    if (!data) return { value: '', comment: '' };
    return {
      value: data.value || '',
      comment: data.comments[day.race_day - 1] || ''
    };
  }

  /* ---------- オッズ表示 ----------
     rows: [{ betType, combination: '1-2-3', odds, minOdds?, maxOdds?, popularity }]
     本番アプリ（asilog-project の components/odds-panel.tsx）と同じ並び・見せ方。
     opts.sample が true なら「サンプル（固定値）」と明記する */
  const ODDS_SECTIONS = [
    { betType: '2車複', ordered: false },
    { betType: '2車単', ordered: true },
    { betType: 'ワイド', ordered: false },
    { betType: '3連複', ordered: false, limit: 20 },
    { betType: '3連単', ordered: true, limit: 20 }
  ];

  function oddsCombo(value, ordered) {
    return `<span class="odds-combo">${String(value).split('-')
      .map((c, i) => (i ? `<span class="odds-sep">${ordered ? '-' : '='}</span>` : '') + bikeBadge(c)).join('')}</span>`;
  }

  function oddsValue(r, betType) {
    const f = v => (v === null || v === undefined ? '-' : Number(v).toFixed(1));
    return betType === 'ワイド' ? `${f(r.minOdds)}<span class="odds__range">〜</span>${f(r.maxOdds)}` : f(r.odds);
  }

  function oddsPanel(rows, opts) {
    if (!rows || !rows.length) return '';
    const o = opts || {};
    const sections = ODDS_SECTIONS.map((sec, i) => {
      const list = rows.filter(r => r.betType === sec.betType);
      if (!list.length) return '';
      const shown = sec.limit ? list.slice(0, sec.limit) : list;
      const count = sec.limit && list.length > sec.limit
        ? `人気順 上位${sec.limit}件 / 全${list.length}件` : `全${list.length}件`;
      return `
        <details class="odds__section"${i === 0 ? ' open' : ''}>
          <summary>${sec.betType}<span class="small muted">${count}</span></summary>
          <ol class="odds__list">
            ${shown.map(r => `
              <li class="${r.popularity === 1 ? 'is-fav' : ''}">
                <span class="odds__pop">${esc(r.popularity ?? '-')}</span>
                ${oddsCombo(r.combination, sec.ordered)}
                <span class="odds__value">${oddsValue(r, sec.betType)}</span>
              </li>`).join('')}
          </ol>
        </details>`;
    }).join('');

    return `
      <div class="odds">
        <div class="odds__head">
          <b>オッズ</b>
          ${o.sample ? '<span class="badge badge--gold">サンプル（固定値）</span>' : ''}
          ${o.note ? `<span class="section-head__tail small muted">${esc(o.note)}</span>` : ''}
        </div>
        ${sections}
      </div>`;
  }

  /* ---------- 選手メモ（利用者向け。管理者の脚評価とは別） ----------
     レースではなく選手に紐付く。キーは「選手名の先頭5文字＋期別の数字」。
     出走表の選手名は5文字で切れ、結果には完全な名前が入るため先頭5文字で揃える。
     府県は移籍で変わるのでキーに入れない（asilog-project の docs/rider-key-check.md）。
     端末の localStorage に保存するだけなので、別の端末・ブラウザには出ない */
  const NOTE_PREFIX = 'asilog:note:';

  function riderKey(name, kibetsu) {
    const n = String(name || '').replace(/\s/g, '').slice(0, 5);
    // 外国人選手は出走表で期別が空、結果では「0期」になるので、0 は空に揃える
    const k = String(kibetsu || '').replace(/[^0-9]/g, '').replace(/^0+$/, '');
    return `${n}|${k}`;
  }

  function loadNote(key) {
    try {
      const raw = localStorage.getItem(NOTE_PREFIX + key);
      const data = raw ? JSON.parse(raw) : null;
      return data && data.text ? data : null;
    } catch (e) {
      return null;
    }
  }

  function saveNote(key, text, meta) {
    const value = String(text || '').trim();
    storageSet(NOTE_PREFIX + key, value
      ? JSON.stringify(Object.assign({}, meta, { text: value, updatedAt: new Date().toISOString() }))
      : null);
  }

  /* 選手名のボタン。メモがあれば 📝 を付け、title にメモの先頭を入れる */
  function racerNameButton(name, kibetsu, prefecture) {
    const note = loadNote(riderKey(name, kibetsu));
    const title = note ? `メモ: ${note.text.slice(0, 60)}` : 'タップしてメモを付ける';
    return `<button type="button" class="racer-btn" data-note-name="${esc(name)}"
      data-note-kibetsu="${esc(kibetsu)}" data-note-pref="${esc(prefecture)}" title="${esc(title)}">`
      + `<span class="racer-name">${esc(name)}</span>${note ? '<span class="note-mark" aria-label="メモあり">📝</span>' : ''}</button>`;
  }

  let noteDialog = null;

  function buildNoteDialog() {
    const d = document.createElement('dialog');
    d.className = 'note-modal';
    d.innerHTML = `
      <form method="dialog" class="note-modal__body">
        <div class="note-modal__head">
          <div>
            <div class="note-modal__name"></div>
            <div class="note-modal__meta small muted"></div>
          </div>
          <button class="note-modal__close" value="cancel" type="submit" aria-label="閉じる">×</button>
        </div>
        <p class="small muted" style="margin:0 0 6px;">この選手へのメモ（レースをまたいで残ります。この端末に保存）</p>
        <textarea class="textarea note-modal__text" rows="4" placeholder="例: 地元戦は積極的。先行意欲あり"></textarea>
        <div class="note-modal__updated small muted"></div>
        <div class="note-modal__actions">
          <button class="btn" type="button" data-act="delete">削除</button>
          <button class="btn btn--navy" type="button" data-act="save">保存</button>
        </div>
      </form>`;
    document.body.appendChild(d);

    const text = d.querySelector('.note-modal__text');
    text.addEventListener('input', () => autoResize(text));
    // 背景（dialog 自身）をタップしたら閉じる
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    d.querySelector('[data-act="save"]').addEventListener('click', () => {
      saveNote(d.dataset.key, text.value, JSON.parse(d.dataset.meta));
      d.close();
      document.dispatchEvent(new CustomEvent('kui:note-saved', { detail: { key: d.dataset.key } }));
    });
    d.querySelector('[data-act="delete"]').addEventListener('click', () => {
      saveNote(d.dataset.key, '', null);
      d.close();
      document.dispatchEvent(new CustomEvent('kui:note-saved', { detail: { key: d.dataset.key } }));
    });
    return d;
  }

  function openNoteModal(rider) {
    if (!noteDialog) noteDialog = buildNoteDialog();
    const d = noteDialog;
    const key = riderKey(rider.name, rider.kibetsu);
    const note = loadNote(key);
    d.dataset.key = key;
    d.dataset.meta = JSON.stringify({ name: rider.name, kibetsu: rider.kibetsu });
    d.querySelector('.note-modal__name').textContent = rider.name;
    d.querySelector('.note-modal__meta').textContent = [rider.kibetsu, rider.prefecture].filter(Boolean).join(' ');
    const text = d.querySelector('.note-modal__text');
    text.value = note ? note.text : '';
    d.querySelector('.note-modal__updated').textContent = note && note.updatedAt
      ? `最終更新 ${new Date(note.updatedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
      : '';
    d.querySelector('[data-act="delete"]').hidden = !note;
    d.showModal();
    autoResize(text);
    text.focus();
  }

  /* 表の中の選手名ボタン（racerNameButton）のタップでメモを開く。root に1回だけ付ける */
  function bindNoteButtons(root) {
    root.addEventListener('click', e => {
      const btn = e.target.closest('[data-note-name]');
      if (!btn) return;
      openNoteModal({
        name: btn.dataset.noteName,
        kibetsu: btn.dataset.noteKibetsu,
        prefecture: btn.dataset.notePref
      });
    });
  }

  /* ---------- textarea 自動リサイズ ---------- */
  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  /* ---------- ログイン（仮） ----------
     注意: 表示の出し分けを確かめるための仮実装で、認証ではない。
     ログイン状態は端末の localStorage に置くだけなので、誰でも書き換えられる。
     本番は asilog-project でサーバー側の認証（L-12）に置き換える。

     RESULT_MEMBERS_ONLY を false にすると、レース結果をログイン前でも見せる */
  const RESULT_MEMBERS_ONLY = true;
  const AUTH_KEY = 'asilog:member';   // race.html の会員限定表示と共通
  const USER_KEY = 'asilog:user';
  const ROLE_KEY = 'asilog:role';     // 'admin' なら管理者

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) { /* プライベートモード等で保存できないときはログインしない扱い */ }
  }

  function isLoggedIn() { return storageGet(AUTH_KEY) === '1'; }
  function loginUser() { return storageGet(USER_KEY) || ''; }
  function isAdmin() { return isLoggedIn() && storageGet(ROLE_KEY) === 'admin'; }
  function login(user, opts) {
    storageSet(AUTH_KEY, '1');
    storageSet(USER_KEY, user || '');
    storageSet(ROLE_KEY, opts && opts.admin ? 'admin' : null);
  }
  function logout() { storageSet(AUTH_KEY, '0'); storageSet(USER_KEY, null); storageSet(ROLE_KEY, null); }
  function canSeeResults() { return !RESULT_MEMBERS_ONLY || isLoggedIn(); }

  /* ログイン後の戻り先。同じサイトのページ（xxx.html と検索条件）だけ許す */
  function safeNext(next) {
    return /^[a-z][a-z0-9-]*\.html(\?[^#]*)?$/.test(String(next || '')) ? next : 'index.html';
  }
  function loginUrl(next) {
    const here = location.pathname.split('/').pop() || 'index.html';
    return `login.html?next=${encodeURIComponent(next || here + location.search)}`;
  }

  /* ---------- 共通ヘッダー ---------- */
  const NAV = [
    { href: 'channel.html', label: '飛びつきチャンネル', short: 'チャンネル' },
    { href: 'race.html', label: 'レース情報', short: '出走表' },
    { href: 'result.html', label: 'レース結果', short: '結果', membersOnly: RESULT_MEMBERS_ONLY },
    { href: 'admin.html', label: '結果管理', short: '管理', adminOnly: true }
  ];

  function renderHeader(currentHref) {
    const loggedIn = isLoggedIn();
    const admin = isAdmin();
    const links = NAV.filter(n => (!n.membersOnly || loggedIn) && (!n.adminOnly || admin)).map(n =>
      `<a href="${n.href}"${n.href === currentHref ? ' aria-current="page"' : ''}>`
      + `<span class="gnav__long">${n.label}</span><span class="gnav__short">${n.short}</span></a>`
    ).join('');
    const auth = loggedIn
      ? `<button class="auth-btn" type="button" data-logout>ログアウト</button>`
      : (currentHref === 'login.html' ? '' : `<a class="auth-btn auth-btn--login" href="${esc(loginUrl())}">ログイン</a>`);

    return `
      <header class="site-header">
        <div class="site-header__inner">
          <a class="brand" href="channel.html">
            <span class="brand__mark">飛</span>
            <span>
              <span class="brand__name">飛びつき</span>
              <span class="brand__sub">KEIRIN NAVI</span>
            </span>
          </a>
          <nav class="gnav">${links}</nav>
          ${auth}
        </div>
      </header>`;
  }

  function renderFooter() {
    return `
      <footer class="site-footer">
        <div class="site-footer__inner">
          <div>
            <div class="site-footer__name">飛びつきチャンネル</div>
            <p class="site-footer__note">
              当サイトはレースを楽しむための情報提供サービスです。車券の的中を保証するものではありません。<br>
              車券の購入はご自身の判断と責任において行ってください。
            </p>
          </div>
          <div class="site-footer__note">&copy; 飛びつきチャンネル</div>
        </div>
      </footer>`;
  }

  function mountChrome(currentHref) {
    const head = document.getElementById('siteHeader');
    if (head) head.outerHTML = renderHeader(currentHref);
    const out = document.querySelector('.site-header [data-logout]');
    if (out) out.addEventListener('click', () => { logout(); location.reload(); });
    const foot = document.getElementById('siteFooter');
    if (foot) foot.outerHTML = renderFooter();
  }

  global.KUI = {
    GCS_BASE, esc, ymd, compact, shiftDate, labelDate,
    jstNow, defaultRaceDate, defaultResultDate,
    gradeKey, gradeBadge, bikeBadge, racerCarNo, racerBikeBadge, legBadge, kimariteBadge,
    linesHtml, dayLabel,
    fetchRaceInfo, fetchRaceResult, finishedByPlace, nextRaceNum,
    evalKey, loadEvalRaw, loadEvaluation, autoResize,
    riderKey, loadNote, saveNote, racerNameButton, openNoteModal, bindNoteButtons, oddsPanel,
    RESULT_MEMBERS_ONLY, isLoggedIn, isAdmin, loginUser, login, logout, canSeeResults, safeNext, loginUrl,
    renderHeader, renderFooter, mountChrome
  };
})(window);
