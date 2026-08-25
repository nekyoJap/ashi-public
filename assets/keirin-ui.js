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

  /* ---------- 脚質 ---------- */
  function legBadge(leg) {
    const v = String(leg || '').trim();
    let cls = 'other';
    if (v.indexOf('逃') === 0) cls = 'nige';
    else if (v.indexOf('両') === 0) cls = 'makuri';
    else if (v.indexOf('追') === 0 || v.indexOf('差') === 0) cls = 'sashi';
    return `<span class="leg leg--${cls}">${esc(v || '-')}</span>`;
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

  /* ---------- 会員状態（仮実装） ----------

     注意: これは認証ではない。静的サイトである以上、
     クライアント側の状態は誰でも書き換えられる。
     本番の出し分けは Phase 2 でサーバー側に実装し、
     非会員には有料データ自体を配信しない方式へ置き換える。
     ------------------------------------------------- */
  const MEMBER_KEY = 'asilog:member';

  function isMember() {
    try {
      if (new URLSearchParams(location.search).get('preview') === 'member') return true;
      return localStorage.getItem(MEMBER_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function setMember(on) {
    try {
      localStorage.setItem(MEMBER_KEY, on ? '1' : '0');
    } catch (e) { /* プライベートモード等では保持できない */ }
  }

  /* ログイン後に戻る先を保持したログインURL */
  function loginUrl(next) {
    const to = next || (location.pathname.split('/').pop() || 'index.html') + location.search;
    return 'login.html?next=' + encodeURIComponent(to);
  }

  /* ---------- 共通ヘッダー ---------- */
  const NAV = [
    { href: 'channel.html', label: '飛びつきチャンネル' },
    { href: 'race.html', label: 'レース情報' },
    { href: 'result.html', label: 'レース結果' }
  ];

  function renderHeader(currentHref) {
    const links = NAV.map(n =>
      `<a href="${n.href}"${n.href === currentHref ? ' aria-current="page"' : ''}>${n.label}</a>`
    ).join('');

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
        </div>
      </header>`;
  }

  function renderFooter() {
    return `
      <footer class="site-footer">
        <div class="site-footer__inner">
          <div>
            <div style="color:#fff;font-weight:800;">飛びつきチャンネル</div>
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
    const foot = document.getElementById('siteFooter');
    if (foot) foot.outerHTML = renderFooter();
  }

  global.KUI = {
    GCS_BASE, esc, ymd, compact, shiftDate, labelDate,
    gradeKey, gradeBadge, bikeBadge, legBadge, linesHtml, dayLabel,
    fetchRaceInfo, fetchRaceResult,
    evalKey, loadEvalRaw, autoResize,
    MEMBER_KEY, isMember, setMember, loginUrl,
    renderHeader, renderFooter, mountChrome
  };
})(window);
