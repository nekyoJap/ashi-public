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
  function login(user) { storageSet(AUTH_KEY, '1'); storageSet(USER_KEY, user || ''); }
  function logout() { storageSet(AUTH_KEY, '0'); storageSet(USER_KEY, null); }
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
    { href: 'result.html', label: 'レース結果', short: '結果', membersOnly: RESULT_MEMBERS_ONLY }
  ];

  function renderHeader(currentHref) {
    const loggedIn = isLoggedIn();
    const links = NAV.filter(n => !n.membersOnly || loggedIn).map(n =>
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
    evalKey, loadEvalRaw, autoResize,
    RESULT_MEMBERS_ONLY, isLoggedIn, loginUser, login, logout, canSeeResults, safeNext, loginUrl,
    renderHeader, renderFooter, mountChrome
  };
})(window);
