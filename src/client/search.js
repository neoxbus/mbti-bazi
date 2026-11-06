// ช่องค้นหาของทั้งเว็บ — หา MBTI 16, เสา 10 และคู่ทั้ง 160 ได้จากทุกหน้า
(function () {
  'use strict';

  var IDX = window.__SEARCH__;
  var btn = document.getElementById('searchBtn');
  var modal = document.getElementById('searchModal');
  if (!IDX || !btn || !modal) return;

  var input = document.getElementById('searchInput');
  var results = document.getElementById('searchResults');
  var closeBtn = document.getElementById('searchClose');
  var lastFocused = null;
  var cursor = -1;

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // แปลงข้อความให้เทียบง่าย: ตัดช่องว่าง ตัวพิมพ์ใหญ่ และเครื่องหมายคูณ
  function norm(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[×x]/g, '');
  }

  var TYPE_MAP = {};
  IDX.types.forEach(function (t) { TYPE_MAP[t[0]] = t; });
  var STEM_MAP = {};
  IDX.stems.forEach(function (s) { STEM_MAP[s[0]] = s; });

  // รายการที่ค้นหาได้ — รวมชื่อที่เกี่ยวข้องเพื่อให้พิมพ์คร่าว ๆ ก็เจอ
  var ALL = [];

  IDX.types.forEach(function (t) {
    ALL.push({
      group: 'MBTI 16 ชนิด',
      label: t[0] + ' · ' + t[1],
      hint: t[3],
      url: t[4],
      color: IDX.groupColors[t[2]] || '#e6c07a',
      blob: norm(t[0] + t[1] + t[2] + t[3]),
    });
  });

  IDX.stems.forEach(function (s) {
    ALL.push({
      group: '10 เสาแบบ bazi',
      label: s[1] + ' · ' + s[2],
      hint: 'ธาตุ' + s[4] + ' · ' + s[5],
      url: s[6],
      color: IDX.colors[s[3]] || '#e6c07a',
      blob: norm(s[0] + s[1] + s[2] + s[3] + s[4] + s[5]),
    });
  });

  IDX.pairs.forEach(function (p) {
    var t = TYPE_MAP[p[0]];
    var s = STEM_MAP[p[1]];
    ALL.push({
      group: 'คู่ MBTI × เสา',
      label: p[0] + ' × ' + s[2],
      hint: 'คะแนน ' + p[2] + '/100 · ธาตุ' + s[4],
      url: p[3],
      color: IDX.colors[s[3]] || '#e6c07a',
      blob: norm(p[0] + t[1] + p[1] + s[1] + s[2] + s[3] + s[4] + s[5]),
    });
  });

  function render(q) {
    var query = norm(q);
    cursor = -1;

    if (!query) {
      results.innerHTML =
        '<p class="search-empty">พิมพ์ชื่อ MBTI, ชื่อเสา หรือชื่อธาตุ เช่น <b>ENFJ</b>, <b>แก้ไม้</b>, <b>甲</b>, <b>ไม้</b></p>';
      return;
    }

    var hits = ALL.filter(function (r) { return r.blob.indexOf(query) !== -1; });

    // ให้รายการที่ตรงคำที่พิมพ์ตรง ๆ ขึ้นก่อน
    var exact = hits.filter(function (r) {
      var l = norm(r.label);
      return l === query || l.indexOf(query) === 0;
    });
    hits = exact.concat(hits.filter(function (r) { return exact.indexOf(r) === -1; }));

    if (!hits.length) {
      results.innerHTML = '<p class="search-empty">ไม่พบ "' + escapeHtml(q) + '" — ลองพิมพ์ชื่อ MBTI, เสา หรือธาตุ</p>';
      return;
    }

    var shown = hits.slice(0, 40);
    var html = '';
    var lastGroup = '';
    shown.forEach(function (r, i) {
      if (r.group !== lastGroup) {
        html += '<div class="search-group">' + r.group + '</div>';
        lastGroup = r.group;
      }
      html +=
        '<a class="search-hit" href="' + r.url + '" data-i="' + i + '">' +
        '<span class="hit-dot" style="background:' + r.color + '"></span>' +
        '<span class="hit-label">' + escapeHtml(r.label) + '</span>' +
        '<span class="hit-hint">' + escapeHtml(r.hint) + '</span>' +
        '</a>';
    });
    if (hits.length > shown.length) {
      html += '<p class="search-more">แสดง ' + shown.length + ' จาก ' + hits.length +
        ' รายการ — พิมพ์เพิ่มเพื่อจำกัดให้แคบ</p>';
    }
    results.innerHTML = html;
  }

  function mark() {
    var hits = results.querySelectorAll('.search-hit');
    for (var i = 0; i < hits.length; i++) {
      hits[i].classList.toggle('sel', i === cursor);
    }
    if (cursor >= 0 && hits[cursor]) hits[cursor].scrollIntoView({ block: 'nearest' });
  }

  function open() {
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('search-open');
    input.value = '';
    render('');
    input.focus();
  }

  function close() {
    modal.hidden = true;
    document.body.classList.remove('search-open');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  btn.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', close);

  modal.addEventListener('click', function (e) {
    if (e.target === modal || (e.target.classList && e.target.classList.contains('search-panel'))) close();
  });

  input.addEventListener('input', function () { render(input.value); });

  input.addEventListener('keydown', function (e) {
    var hits = results.querySelectorAll('.search-hit');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      cursor = Math.min(cursor + 1, hits.length - 1);
      mark();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      cursor = Math.max(cursor - 1, 0);
      mark();
    } else if (e.key === 'Enter') {
      if (cursor >= 0 && hits[cursor]) {
        e.preventDefault();
        window.location.href = hits[cursor].getAttribute('href');
      }
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) {
      close();
      return;
    }
    if (!modal.hidden) return;
    var tag = (e.target && e.target.tagName) || '';
    var typing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable);
    if (typing) return;
    if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      open();
    }
  });
})();
