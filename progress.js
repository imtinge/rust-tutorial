// 《Rust 从入门到上手实战》学习进度追踪
// 功能一：每章末尾"读完打卡"按钮 + 侧栏完成标记 + 侧栏顶部进度条
// 功能二：自检清单交互化——点击条目打勾/取消，状态持久保存
// 存储：localStorage（键 rust-tutorial-progress-v1 / rust-tutorial-checklist-v1），
// 全部数据只保存在你的浏览器里，不上传任何内容。
(function () {
  "use strict";

  var PROGRESS_KEY = "rust-tutorial-progress-v1";
  var CHECKLIST_KEY = "rust-tutorial-checklist-v1";
  var MAX_WAIT_MS = 4000;

  function loadJson(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || fallback);
      return v;
    } catch (e) {
      return JSON.parse(fallback);
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* localStorage 不可用时静默降级（仅本次会话内生效） */
    }
  }

  function loadProgress() {
    var v = loadJson(PROGRESS_KEY, "[]");
    return Array.isArray(v) ? v : [];
  }

  function isDone(list, page) {
    return list.indexOf(page) !== -1;
  }

  function toggleDone(page) {
    var list = loadProgress();
    var i = list.indexOf(page);
    if (i === -1) {
      list.push(page);
    } else {
      list.splice(i, 1);
    }
    saveJson(PROGRESS_KEY, list);
  }

  function currentPage() {
    var p = decodeURIComponent(location.pathname.split("/").pop() || "index.html");
    return p === "" ? "index.html" : p;
  }

  function hrefToPage(href) {
    var clean = String(href).split("#")[0].split("?")[0];
    var p = clean.split("/").pop() || "index.html";
    return decodeURIComponent(p);
  }

  // ---------- 侧栏：打勾 + 进度条 ----------

  function decorateSidebar() {
    var box = document.querySelector("mdbook-sidebar-scrollbox");
    if (!box || !box.children.length) return false;

    var links = box.querySelectorAll("a[href]");
    if (!links.length) return false;

    var progress = loadProgress();
    var total = 0;
    var doneCount = 0;

    links.forEach(function (a) {
      var raw = String(a.getAttribute("href") || "");
      // 新版 mdbook 会把当前页的小节锚点（#xxx）也注入侧栏，
      // 它们不是独立页面，不参与统计——否则打卡"前言"会误判一堆锚点为已完成
      if (raw.charAt(0) === "#") return;
      total++;
      var page = hrefToPage(raw);
      var li = a.closest("li");
      if (!li) li = a.parentElement;
      var oldTick = a.querySelector(".done-tick");
      if (isDone(progress, page)) {
        doneCount++;
        if (li) li.classList.add("chapter-done");
        if (!oldTick) {
          var tick = document.createElement("span");
          tick.className = "done-tick";
          tick.textContent = " ✓";
          a.appendChild(tick);
        }
      } else {
        if (li) li.classList.remove("chapter-done");
        if (oldTick) oldTick.remove();
      }
    });

    renderBadge(doneCount, total);
    return true;
  }

  function renderBadge(done, total) {
    var badge = document.getElementById("rust-progress-badge");
    if (!badge) {
      var box = document.querySelector("mdbook-sidebar-scrollbox");
      if (!box || !box.parentElement) return;
      badge = document.createElement("div");
      badge.id = "rust-progress-badge";
      box.parentElement.insertBefore(badge, box);
    }
    var pct = total ? Math.round((done / total) * 100) : 0;
    badge.className = pct >= 100 ? "all-done" : "";
    badge.innerHTML =
      '<div class="rp-line"><span>📚 学习进度</span><span>' +
      done +
      " / " +
      total +
      " · " +
      pct +
      "%</span></div>" +
      '<div class="rp-bar"><div class="rp-fill" style="width:' +
      pct +
      '%"></div></div>';
  }

  // ---------- 正文：章节末尾的打卡按钮 ----------

  function addChapterButton() {
    var page = currentPage();
    if (page === "print.html" || page === "404.html" || page === "search.html") return;
    var content = document.getElementById("mdbook-content");
    if (!content) return;
    var main = content.querySelector("main");
    if (!main) return;
    if (document.getElementById("rust-done-btn")) return;

    var btn = document.createElement("button");
    btn.id = "rust-done-btn";
    btn.type = "button";

    function renderBtn() {
      var done = isDone(loadProgress(), page);
      btn.className = done ? "done" : "";
      btn.textContent = done ? "✓ 本章已完成（点击撤销）" : "读完本章？点我打卡 ✅";
      btn.setAttribute("aria-pressed", done ? "true" : "false");
    }

    btn.addEventListener("click", function () {
      toggleDone(page);
      renderBtn();
      decorateSidebar();
    });

    renderBtn();
    main.appendChild(btn);
  }

  // ---------- 自检清单：点击打勾 + 状态持久化 ----------

  function makeChecklistInteractive() {
    var main = document.querySelector("#mdbook-content main");
    if (!main) return;
    var page = currentPage();
    var store = loadJson(CHECKLIST_KEY, "{}");
    if (!store || typeof store !== "object") store = {};

    var headings = main.querySelectorAll("h2, h3");
    var i, h, text;
    for (i = 0; i < headings.length; i++) {
      h = headings[i];
      text = (h.textContent || "").replace(/\s/g, "");
      if (text === "自检清单") break;
      h = null;
    }
    if (!h) return;

    // 自检清单标题后面的第一个列表就是清单本体
    var list = null;
    var el = h.nextElementSibling;
    while (el && el !== main) {
      if (el.tagName === "UL" || el.tagName === "OL") {
        list = el;
        break;
      }
      el = el.nextElementSibling;
    }
    if (!list) return;

    list.classList.add("self-check-list");
    var items = list.querySelectorAll("li");
    var keyBase = page + "::" + (h.id || "checklist");

    items.forEach(function (li, idx) {
      li.classList.add("check-item");
      var itemKey = keyBase + "::" + idx;
      if (store[itemKey]) {
        li.classList.add("checked");
      }
      li.addEventListener("click", function (ev) {
        ev.preventDefault();
        var s = loadJson(CHECKLIST_KEY, "{}");
        if (!s || typeof s !== "object") s = {};
        if (s[itemKey]) {
          delete s[itemKey];
          li.classList.remove("checked");
        } else {
          s[itemKey] = true;
          li.classList.add("checked");
        }
        saveJson(CHECKLIST_KEY, s);
      });
    });
  }

  // ---------- 启动 ----------

  function init() {
    addChapterButton();
    makeChecklistInteractive();
    if (!decorateSidebar()) {
      // 侧栏由 mdbook 的 toc.js（自定义元素）异步填充，轮询等待
      var waited = 0;
      var timer = setInterval(function () {
        waited += 150;
        if (decorateSidebar() || waited > MAX_WAIT_MS) {
          clearInterval(timer);
        }
      }, 150);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
