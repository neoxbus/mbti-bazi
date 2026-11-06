// สคริปต์ฝั่งผู้ใช้ — เมนูมือถือ, ตัวกรองตาราง, เครื่องมือหา "ธาตุของตัวเอง"
(function () {
  'use strict';

  // ---------- เมนูมือถือ ----------
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('siteNav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.textContent = open ? '✕' : '☰';
    });
  }

  // ---------- ตัวกรองตาราง 16 × 10 ----------
  var matrix = document.getElementById('matrix');
  if (matrix) {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-filter-group]'));
    var colButtons = Array.prototype.slice.call(document.querySelectorAll('[data-filter-element]'));
    var counter = document.getElementById('matrixCount');

    function apply() {
      var group = (document.querySelector('[data-filter-group][aria-pressed="true"]') || {}).dataset;
      var g = group ? group.filterGroup : 'all';
      var eBtn = document.querySelector('[data-filter-element][aria-pressed="true"]');
      var e = eBtn ? eBtn.dataset.filterElement : 'all';
      var shown = 0;

      matrix.querySelectorAll('tbody tr').forEach(function (row) {
        var rowOk = g === 'all' || row.dataset.group === g;
        row.hidden = !rowOk;
        // ซ่อนทุกช่องเสมอ แล้วค่อยแสดงเฉพาะช่องที่ผ่านทั้งสองตัวกรอง
        // (เดิมแถวที่ถูกซ่อนด้วยตัวกรองกลุ่มไม่ได้ถูกแตะ ทำให้สถานะช่องค้างจากรอบก่อน)
        row.querySelectorAll('td').forEach(function (cell) {
          var cellOk = e === 'all' || cell.dataset.element === e;
          cell.hidden = !cellOk;
          if (rowOk && cellOk) shown++;
        });
      });

      matrix.querySelectorAll('thead th').forEach(function (th) {
        var el = th.dataset.element;
        // หัวมุมซ้ายไม่มีธาตุ ต้องอยู่เสมอ ไม่ให้ถูกซ่อนตอนกรองตามธาตุ
        if (!el) return;
        th.hidden = !(e === 'all' || el === e);
      });

      if (counter) counter.textContent = shown;
    }

    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        buttons.forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        apply();
      });
    });
    colButtons.forEach(function (b) {
      b.addEventListener('click', function () {
        var already = b.getAttribute('aria-pressed') === 'true';
        colButtons.forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
        if (already) {
          document.querySelector('[data-filter-element="all"]').setAttribute('aria-pressed', 'true');
        } else {
          b.setAttribute('aria-pressed', 'true');
        }
        apply();
      });
    });
    apply();
  }

  // ---------- เครื่องมือหา "ธาตุของตัวเอง" ----------
  var finder = document.getElementById('finder');
  if (finder && window.__PAIRS__) {
    // ข้อมูลมาเป็นอาร์เรย์ — สร้างดัชนีสำหรับค้นด้วยคีย์ "TYPE|stem"
    var pairList = window.__PAIRS__;
    var pairs = {};
    pairList.forEach(function (p) { pairs[p.t + '|' + p.s] = p; });
    var state = { type: null, stem: null };

    var TONE = { peak: '#4fd6a0', high: '#7fd06a', good: '#e6c07a', mixed: '#e08b5a', hard: '#c96a6a' };

    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    var typeButtons = Array.prototype.slice.call(finder.querySelectorAll('[data-pick-type]'));
    var stemButtons = Array.prototype.slice.call(finder.querySelectorAll('[data-pick-stem]'));
    var result = document.getElementById('finderResult');
    var dateInput = document.getElementById('birthDate');
    var dateNote = document.getElementById('birthNote');

    function pickType(code) {
      state.type = code;
      typeButtons.forEach(function (b) {
        b.setAttribute('aria-pressed', b.dataset.pickType === code ? 'true' : 'false');
      });
      render();
    }

    function pickStem(key, fromCalc) {
      state.stem = key;
      stemButtons.forEach(function (b) {
        b.setAttribute('aria-pressed', b.dataset.pickStem === key ? 'true' : 'false');
      });
      if (!fromCalc && dateNote) {
        dateNote.textContent = 'เลือกเองแทนคำนวณจากวันเกิด — ถ้าอยากให้คำนวณใหม่ ให้กรอกวันเกิดอีกครั้ง';
      }
      render();
    }

    function render() {
      if (!state.type || !state.stem || !result) return;
      var p = pairs[state.type + '|' + state.stem];
      if (!p) return;
      var tone = TONE[p.band] || TONE.good;
      result.innerHTML =
        '<div class="result-head">' +
          '<div class="pair-score"><div class="num" style="color:' + tone + '">' + p.score + '</div>' +
          '<div class="band" style="color:' + tone + '">' + esc(p.bandLabel) + '</div></div>' +
          '<div style="flex:1;min-width:220px">' +
          '<p class="result-title">' + esc(p.typeName) + ' × ' + esc(p.stemName) + '</p>' +
          '<p class="result-sub">' + esc(p.stemSymbol) + ' · ธาตุ' + esc(p.elementTh) + ' (' + esc(p.polarityTh) + ') · ' + esc(p.relationLabel) + '</p>' +
          '</div></div>' +
        '<div class="result-body">' +
          '<div class="god-card" style="margin-bottom:16px">' +
          '<div class="god-label">บทบาทสิบเทพ (十神)</div>' +
          '<div class="god-name">' + esc(p.godName) + '</div>' +
          '<div class="god-role">' + esc(p.godRole) + '</div>' +
          '</div>' +
          '<div class="shared-note shared-note--' + esc(p.sharedKind) + '" style="margin-top:16px">' +
          '<div class="shared-note-head">' + esc(p.sharedText) + '</div>' +
          '<p>' + esc(p.sharedDetail) + '</p></div>' +
          p.reading.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') +
          '<div class="advice-box"><b>คำแนะนำ:</b> ' + esc(p.advice) + '</div>' +
          '<p style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap">' +
          '<a class="btn btn-primary" href="' + esc(p.url) + '">ดูรายละเอียดคู่นี้เต็ม ๆ →</a>' +
          '<button class="btn" type="button" id="copyResult">คัดลอกลิงก์ของผลนี้</button>' +
          '</p>' +
        '</div>';
      result.classList.add('show');
      result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      syncUrl();
    }

    // เก็บผลไว้ในลิงก์ เพื่อให้ส่งต่อหรือกลับมาดูภายหลังได้
    function syncUrl() {
      if (!window.history || !window.history.replaceState) return;
      var qs = [];
      if (state.type) qs.push('type=' + encodeURIComponent(state.type));
      if (state.stem) qs.push('stem=' + encodeURIComponent(state.stem));
      var url = location.pathname + (qs.length ? '?' + qs.join('&') : '');
      window.history.replaceState(null, '', url);
    }

    var copyBtn = null;
    document.addEventListener('click', function (e) {
      if (!e.target || e.target.id !== 'copyResult') return;
      copyBtn = e.target;
      var url = location.origin + location.pathname + location.search;
      var done = function () {
        copyBtn.textContent = 'คัดลอกแล้ว ✓';
        setTimeout(function () { copyBtn.textContent = 'คัดลอกลิงก์ของผลนี้'; }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () { window.prompt('คัดลอกลิงก์นี้:', url); });
      } else {
        window.prompt('คัดลอกลิงก์นี้:', url);
      }
    });

    typeButtons.forEach(function (b) {
      b.addEventListener('click', function () { pickType(b.dataset.pickType); });
    });
    stemButtons.forEach(function (b) {
      b.addEventListener('click', function () { pickStem(b.dataset.pickStem, false); });
    });

    // คำนวณเสาวันเกิดจากวันเกิด
    if (dateInput) {
      dateInput.addEventListener('change', function () {
        var v = dateInput.value;
        if (!v) {
          if (dateNote) dateNote.textContent = '';
          return;
        }
        var calc = window.__BAZI__ ? window.__BAZI__(v) : null;
        if (!calc) {
          if (dateNote) dateNote.textContent = 'วันที่ไม่ถูกต้อง กรอกปี 1900-2100';
          return;
        }
        if (dateNote) {
          dateNote.textContent = 'วันเกิด ' + v + ' → เสาวันเกิด ' + calc.stem + ' ' + calc.branch +
            ' (ธาตุ' + calc.elementTh + ' ' + calc.polarityTh + ') · ปีนักษัตร' + calc.zodiac;
        }
        pickStem(calc.stemKey, true);
      });
    }

    // เปิดจากลิงก์ที่มี ?type=...&stem=... เช่น ลิงก์ที่แชร์ต่อไปได้
    (function restoreFromUrl() {
      var params = new URLSearchParams(location.search);
      var t = (params.get('type') || '').toUpperCase();
      var s = (params.get('stem') || '').toLowerCase();
      var tOk = typeButtons.some(function (b) { return b.dataset.pickType === t; });
      var sOk = stemButtons.some(function (b) { return b.dataset.pickStem === s; });
      if (tOk) pickType(t);
      if (sOk) pickStem(s, true);
      if (tOk && sOk && dateNote) {
        dateNote.textContent = 'เปิดจากลิงก์ที่แชร์มา — เลือกเองใหม่ได้ทุกเมื่อ';
      }
    })();
  }
})();
