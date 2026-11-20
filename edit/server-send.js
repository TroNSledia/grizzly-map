/* Grizzly Edit → сервер: кнопка «⇪ На сервер». Работает, когда редактор открыт из Telegram-бота (/edit):
   Worker проверяет подпись Telegram, бот — права (админ бота ≥ 2), делает копию, пишет файл, по галочке перезапускает ресурс. */
(function () {
  "use strict";
  var API = "https://grizzly.kuzea1945.workers.dev";
  var tg = window.Telegram && window.Telegram.WebApp;
  function initData() { return tg && tg.initData ? tg.initData : ""; }

  // запрос как у /editor: text/plain (без CORS-preflight), длинный текст — кусками
  function parts(t) { var a = []; for (var i = 0; i < t.length; i += 15000) a.push(t.slice(i, i + 15000)); return a.length ? a : [""]; }
  async function call(req) {
    var ac = new AbortController(), timer = setTimeout(function () { ac.abort(); }, 30000);
    try {
      var r = await fetch(API, { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify({ initData: initData(), req: req }), signal: ac.signal });
      var txt = await r.text();
      try { return JSON.parse(txt); } catch (e) { return { ok: false, err: "HTTP " + r.status + ": " + txt.slice(0, 200) }; }
    } catch (e) {
      return { ok: false, err: e.name === "AbortError" ? "Сервер не ответил за 30 с" : "Нет связи с сервером: " + e.message };
    } finally { clearTimeout(timer); }
  }

  var css = document.createElement("style");
  css.textContent =
    "#gzs-back{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:none;align-items:flex-end;justify-content:center}" +
    "#gzs-back.show{display:flex}" +
    "#gzs{width:100%;max-width:560px;background:#16181b;color:#eee;border-top:2px solid #ff8a00;border-radius:14px 14px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom));font:15px system-ui,sans-serif;max-height:90vh;overflow:auto}" +
    "#gzs h2{margin:0 0 12px;font-size:17px;color:#ff8a00}" +
    "#gzs label{display:block;font-size:13px;color:#aaa;margin:10px 0 4px}" +
    "#gzs select,#gzs input[type=text]{width:100%;box-sizing:border-box;background:#0e0f11;color:#eee;border:1px solid #333;border-radius:8px;padding:10px;font-size:15px}" +
    "#gzs .row{display:flex;gap:8px;margin-top:14px}#gzs .row button{flex:1}" +
    "#gzs button{background:#25282c;color:#eee;border:0;border-radius:8px;padding:12px;font-size:15px}" +
    "#gzs button.go{background:#ff8a00;color:#111;font-weight:700}#gzs button:disabled{opacity:.45}" +
    "#gzs .chk{display:flex;align-items:center;gap:8px;margin-top:12px;color:#ddd}" +
    "#gzs .msg{margin-top:12px;padding:10px;border-radius:8px;background:#0e0f11;white-space:pre-wrap;font-size:14px;min-height:20px}" +
    "#gzs .msg.err{color:#ff7b7b}#gzs .msg.ok{color:#7be08a}#gzs .msg.warn{color:#ffc061}" +
    "#btn-send{background:#ff8a00;color:#111;font-weight:700}";
  document.head.appendChild(css);

  var back = document.createElement("div");
  back.id = "gzs-back";
  back.innerHTML =
    '<div id="gzs"><h2>⇪ Отправить на сервер</h2>' +
    '<div id="gzs-body">' +
    '<label>Ресурс</label><select id="gzs-res"><option>Загрузка…</option></select>' +
    '<label>Файл в ресурсе</label><input type="text" id="gzs-rel" list="gzs-files" autocomplete="off" spellcheck="false"><datalist id="gzs-files"></datalist>' +
    '<div class="chk"><input type="checkbox" id="gzs-restart" checked><span>Перезапустить ресурс после записи</span></div>' +
    '</div>' +
    '<div class="msg" id="gzs-msg"></div>' +
    '<div class="row"><button id="gzs-cancel">Закрыть</button><button id="gzs-dry">Проверить</button><button class="go" id="gzs-go" disabled>Отправить</button></div></div>';
  document.body.appendChild(back);
  var $ = function (id) { return document.getElementById(id); };
  var selRes = $("gzs-res"), inRel = $("gzs-rel"), dl = $("gzs-files"), msg = $("gzs-msg"), btnGo = $("gzs-go"), btnDry = $("gzs-dry");
  var file = null, checked = null, busy = false;

  function say(text, kind) { msg.textContent = text; msg.className = "msg" + (kind ? " " + kind : ""); }
  function key() { return "gzs-target:" + (file ? file.name : ""); }
  function remember() { try { localStorage.setItem(key(), JSON.stringify({ res: selRes.value, rel: inRel.value.trim() })); localStorage.setItem("gzs-last-res", selRes.value); } catch (e) {} }
  function recall() { try { return JSON.parse(localStorage.getItem(key()) || "null"); } catch (e) { return null; } }
  function invalidate() { checked = null; btnGo.disabled = true; }

  async function loadFiles() {
    dl.innerHTML = "";
    if (!selRes.value) return;
    var d = await call({ a: "ed_files", res: selRes.value });
    if (!d.ok) return;
    d.files.forEach(function (f) { var o = document.createElement("option"); o.value = f.p; o.label = f.t; dl.appendChild(o); });
  }

  async function open() {
    file = window.GZEdit && window.GZEdit.current();
    if (!file) return;
    back.classList.add("show");
    invalidate();
    $("gzs-body").style.display = "";
    btnDry.style.display = "";
    btnGo.style.display = "";
    if (!initData()) {
      $("gzs-body").style.display = "none";
      btnDry.style.display = "none";
      btnGo.style.display = "none";
      return say("Отправка работает, когда Grizzly Edit открыт из Telegram-бота.\nНапиши боту /edit → «📝 Открыть Grizzly Edit».\nФайлы приложения с экрана «Домой» хранятся отдельно: «Экспорт» → отправь файл боту (или «Импорт» в редакторе, открытом из бота).", "warn");
    }
    say("Загружаю список ресурсов…");
    var saved = recall();
    var d = await call({ a: "ed_res" });
    if (!d.ok) return say(d.err === "auth" ? "Telegram не подтвердил вход — закрой и открой редактор из бота ещё раз" : (d.err || "Ошибка"), "err");
    selRes.innerHTML = "";
    var last = saved ? saved.res : (localStorage.getItem("gzs-last-res") || "");
    d.res.forEach(function (r) {
      var o = document.createElement("option");
      o.value = r.n; o.textContent = r.n + (r.s === "running" ? "" : " (" + r.s + ")");
      if (r.n === last) o.selected = true;
      selRes.appendChild(o);
    });
    inRel.value = saved ? saved.rel : file.name;
    await loadFiles();
    say("Файл: " + file.name + " (" + file.text.split("\n").length + " строк). Нажми «Проверить».");
  }

  async function lint() {
    if (!/\.lua$/i.test(inRel.value)) return [];
    if (!window.GZEdit || !window.GZEdit.checkLua) return [];
    return await window.GZEdit.checkLua(inRel.value, file.text);   // бросит ошибку синтаксиса Lua 5.1
  }

  async function dry() {
    if (busy) return;
    var rel = inRel.value.trim();
    if (!selRes.value || !rel) return say("Выбери ресурс и укажи файл", "err");
    if (/(^|\/)\.\.(\/|$)/.test(rel) || /^\//.test(rel)) return say("Путь без «..» и без / в начале", "err");
    busy = true; btnDry.disabled = true; invalidate();
    try {
      var warns = [];
      try { warns = await lint(); } catch (e) { return say("🛑 Ошибка синтаксиса — не отправляю:\n" + e.message, "err"); }
      say("Сравниваю с сервером…");
      var d = await call({ a: "ed_save", res: selRes.value, rel: rel, text: parts(file.text), dry: true, allowNew: true });
      if (!d.ok) return say("❌ " + (d.err || "Ошибка") + (d.detail ? "\n" + d.detail : ""), "err");
      if (d.same) return say("Файл на сервере уже такой же — отправлять нечего", "ok");
      checked = { res: selRes.value, rel: rel, text: file.text };
      btnGo.disabled = false;
      remember();
      say((d.new ? "🆕 Новый файл: " + d.add + " строк.\nПосле отправки пропиши его в meta.xml ресурса (иначе сервер его не загрузит)."
        : "Изменения: +" + d.add + " −" + d.del + " строк.\nНа сервере перед записью будет сделана копия (откат — /undo в боте).")
        + (warns.length ? "\n\n⚠️ Проверь:\n" + warns.slice(0, 8).join("\n") : ""), warns.length ? "warn" : "ok");
    } finally { busy = false; btnDry.disabled = false; }
  }

  async function go() {
    if (busy || !checked) return;
    if (checked.res !== selRes.value || checked.rel !== inRel.value.trim() || checked.text !== file.text) return invalidate(), say("Что-то поменялось — нажми «Проверить» ещё раз", "warn");
    busy = true; btnGo.disabled = true; btnDry.disabled = true;
    say("Отправляю…");
    try {
      var d = await call({ a: "ed_save", res: checked.res, rel: checked.rel, text: parts(checked.text), restart: $("gzs-restart").checked, allowNew: true });
      if (!d.ok) return say("❌ " + (d.err || "Ошибка") + (d.detail ? "\n" + d.detail : ""), "err");
      if (d.same) return say("Файл на сервере уже такой же", "ok");
      say("✅ Отправлено: " + checked.res + "/" + checked.rel +
        (d.new ? "\n🆕 Новый файл — пропиши в meta.xml" : "\nКопия на сервере #" + d.backup + " (откат: /undo " + checked.res + "/" + checked.rel + ")") +
        (d.restarted ? "\n🔄 Ресурс перезапущен — ошибки смотри в боте: /errors " + checked.res : ""), "ok");
      if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
      checked = null;
    } finally { busy = false; btnDry.disabled = false; }
  }

  selRes.addEventListener("change", function () { invalidate(); loadFiles(); });
  inRel.addEventListener("input", invalidate);
  btnDry.addEventListener("click", dry);
  btnGo.addEventListener("click", go);
  $("gzs-cancel").addEventListener("click", function () { back.classList.remove("show"); });
  back.addEventListener("click", function (e) { if (e.target === back) back.classList.remove("show"); });

  // кнопка в нижней панели редактора
  function addButton() {
    var save = document.getElementById("btn-save");
    if (!save || document.getElementById("btn-send")) return;
    var b = document.createElement("button");
    b.type = "button"; b.id = "btn-send"; b.textContent = "⇪"; b.title = "Отправить на сервер";
    b.addEventListener("click", open);
    save.parentNode.insertBefore(b, save);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addButton); else addButton();
})();
