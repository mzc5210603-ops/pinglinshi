/* ═══ TermKit · CRT 终端工具箱 ═══
   纯命令行驱动的日常杂活工具集 */

(() => {
  "use strict";

  const term = document.getElementById("term");
  const boot = document.getElementById("boot");
  const statusbar = document.getElementById("statusbar");
  const sbLeft = document.getElementById("sbLeft");

  const history = [];
  let hIdx = -1;

  /* ---------- 工具命令表 ---------- */
  const CMD = {
    help: {
      desc: "列出全部命令",
      run() {
        print("可用命令 ─────────────────────────", "dim");
        const names = Object.keys(CMD);
        const width = Math.max(...names.map((n) => n.length)) + 2;
        names.forEach((n) => {
          print("  " + n.padEnd(width, " ") + CMD[n].desc, "out");
        });
        print("", "dim");
        print("用法：<命令> <参数>（多参数用空格分隔）", "dim");
      }
    },

    b64e: {
      desc: "Base64 编码  b64e <文本>",
      run(args) {
        if (!args.length) return usage("b64e 你好");
        print(btoa(unescape(encodeURIComponent(args.join(" ")))), "out");
      }
    },

    b64d: {
      desc: "Base64 解码  b64d <编码>",
      run(args) {
        if (!args.length) return usage("b64d 5L2g5aW9");
        try {
          print(escape(atob(args[0].trim())).replace(/%([0-9A-F]{2})/gi, (_, h) =>
            String.fromCharCode(parseInt(h, 16))
          ).split("").map((c) => c.charCodeAt(0) < 128 ? c : decodeURIComponent(escape(c))).join(""), "out");
        } catch (e) {
          print("ERR: 不是合法的 Base64 字符串", "err");
        }
      }
    },

    urle: {
      desc: "URL 编码    urle <文本>",
      run(args) {
        if (!args.length) return usage("urle 你好 world");
        print(encodeURIComponent(args.join(" ")), "out");
      }
    },

    urld: {
      desc: "URL 解码    urld <编码>",
      run(args) {
        if (!args.length) return usage("urld %E4%BD%A0%E5%A5%BD");
        try { print(decodeURIComponent(args.join(" ")), "out"); }
        catch (e) { print("ERR: 解码失败，请检查格式", "err"); }
      }
    },

    ts: {
      desc: "时间戳转换  ts [秒级时间戳]",
      run(args) {
        if (!args.length) {
          const now = Math.floor(Date.now() / 1000);
          print("当前秒级时间戳: " + now, "out");
          print("当前毫秒级     : " + Date.now(), "out");
          print("本地时间       : " + fmt(new Date()), "out");
          return;
        }
        const raw = args[0].trim();
        const num = Number(raw);
        if (!/^\d+$/.test(raw) || !isFinite(num)) return print("ERR: 请输入纯数字时间戳", "err");
        const ms = raw.length > 11 ? num : num * 1000;
        print(fmt(new Date(ms)), "out");
      }
    },

    uuid: {
      desc: "生成 UUID   uuid [数量]",
      run(args) {
        const n = Math.min(Math.max(parseInt(args[0]) || 1, 1), 20);
        for (let i = 0; i < n; i++) print(crypto.randomUUID(), "out");
      }
    },

    pwd: {
      desc: "生成密码    pwd [长度] [份数]",
      run(args) {
        const len = Math.min(Math.max(parseInt(args[0]) || 16, 6), 64);
        const n = Math.min(Math.max(parseInt(args[1]) || 3, 1), 10);
        const pool = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*-_=+";
        const buf = new Uint32Array(len * n);
        crypto.getRandomValues(buf);
        for (let i = 0; i < n; i++) {
          let s = "";
          for (let j = 0; j < len; j++) s += pool[buf[i * len + j] % pool.length];
          print(s, "out");
        }
        print("（去掉了易混淆的 I l O 0 1，长度 " + len + "）", "dim");
      }
    },

    color: {
      desc: "颜色转换    color <#hex 或 rgb>",
      run(args) {
        const raw = (args[0] || "").trim();
        let r, g, b;
        if (/^#[0-9a-f]{6}$/i.test(raw)) {
          r = parseInt(raw.slice(1, 3), 16);
          g = parseInt(raw.slice(3, 5), 16);
          b = parseInt(raw.slice(5, 7), 16);
        } else {
          const m = raw.match(/^(\d{1,3})\s*[,，\s]\s*(\d{1,3})\s*[,，\s]\s*(\d{1,3})$/);
          if (!m) return print("ERR: 请传入 #RRGGBB 或 217,63,21 格式", "err");
          r = +m[1]; g = +m[2]; b = +m[3];
        }
        if ([r, g, b].some((v) => v > 255)) return print("ERR: 数值超出 0-255", "err");
        const hex = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
        print("HEX : " + hex.toUpperCase(), "out");
        print("RGB : rgb(" + r + ", " + g + ", " + b + ")", "out");
        print("HSL : " + rgbToHsl(r, g, b), "out");
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        print("亮度: " + (lum * 100).toFixed(1) + "% → " + (lum > 0.55 ? "偏亮，配深色文字" : "偏暗，配浅色文字"), "out");
      }
    },

    json: {
      desc: "JSON 美化  json <JSON串>",
      run(args) {
        if (!args.length) return usage("json {\"a\":1}");
        try {
          const obj = JSON.parse(args.join(" "));
          print(JSON.stringify(obj, null, 2), "out");
        } catch (e) {
          print("ERR: JSON 解析失败 —— " + e.message, "err");
        }
      }
    },

    count: {
      desc: "字数统计    count <文本>",
      run(args) {
        const text = args.join(" ");
        if (!text) return usage("count 这里放要统计的文本");
        const cjk = (text.match(/[\u4e00-\u9fff\u3040-\u30ff]/g) || []).length;
        const words = (text.replace(/[^\w\s-]/g, " ").match(/\b[\w-]+\b/g) || []).length;
        print("字符总数: " + text.length, "out");
        print("中文字数: " + cjk, "out");
        print("英文单词: " + words, "out");
        print("空格数量: " + (text.match(/ /g) || []).length, "out");
      }
    },

    lorem: {
      desc: "占位文本    lorem [段数]",
      run(args) {
        const n = Math.min(Math.max(parseInt(args[0]) || 1, 1), 5);
        const bank = [
          "独坐幽篁里，弹琴复长啸。深林人不知，明月来相照。",
          "山不在高，有仙则名。水不在深，有龙则灵。斯是陋室，惟吾德馨。",
          "落霞与孤鹜齐飞，秋水共长天一色。渔舟唱晚，响穷彭蠡之滨。",
          "且将新火试新茶，诗酒趁年华。回首向来萧瑟处，归去，也无风雨也无晴。",
          "大漠孤烟直，长河落日圆。萧关逢候骑，都护在燕然。"
        ];
        for (let i = 0; i < n; i++) print(bank[i % bank.length], "out");
      }
    },

    roll: {
      desc: "掷骰子      roll [面数]",
      run(args) {
        const faces = Math.min(Math.max(parseInt(args[0]) || 6, 2), 1000);
        const v = 1 + Math.floor(Math.random() * faces);
        print("🎲 d" + faces + " →【 " + v + " 】", "out");
      }
    },

    calc: {
      desc: "安全计算    calc <算式>",
      run(args) {
        const expr = args.join("");
        if (!/^[\d+\-*/%.()\s]+$/.test(expr)) return print("ERR: 只支持数字与 + - * / % ( ) .", "err");
        try {
          const r = Function('"use strict";return (' + expr + ")")();
          if (typeof r !== "number" || !isFinite(r)) throw 0;
          print(expr + " = " + r, "out");
        } catch (e) { print("ERR: 算式无法计算", "err"); }
      }
    },

    whoami: { desc: "关于本机", run() { print("访客@TermKit · 屏幕尺寸 " + screen.width + "×" + screen.height + " · 时区 " + Intl.DateTimeFormat().resolvedOptions().timeZone, "out"); } },

    clear: {
      desc: "清屏（保留命令行）",
      run() {
        term.querySelectorAll(".line:not(.input-line)").forEach((l) => l.remove());
        document.getElementById("cmdInput")?.focus();
      }
    }
  };

  /* ---------- 辅助 ---------- */
  function print(text, cls) {
    const el = document.createElement("div");
    el.className = "line" + (cls ? " " + cls : "");
    el.textContent = text;
    term.insertBefore(el, term.querySelector(".input-line"));
    term.scrollTop = term.scrollHeight;
  }

  function usage(example) { print("用法: " + example, "dim"); }

  function fmt(d) {
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
      " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return "hsl(" + Math.round(h * 360) + ", " + Math.round(s * 100) + "%, " + Math.round(l * 100) + "%)";
  }

  /* ---------- 输入行 ---------- */
  function buildInput() {
    const line = document.createElement("div");
    line.className = "line input-line";
    line.innerHTML =
      '<span class="prompt-sign">C:\\TK&gt;</span>' +
      '<input id="cmdInput" autocomplete="off" spellcheck="false" />' +
      '<span class="caret" id="caret"></span>';
    term.appendChild(line);
    const input = line.querySelector("#cmdInput");
    input.focus();
    term.scrollTop = term.scrollHeight;

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const raw = input.value;
        print("C:\\TK> " + raw, "dim");
        if (raw.trim()) {
          history.push(raw);
          hIdx = history.length;
          exec(raw);
        }
        input.value = "";
        syncCaret();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (hIdx > 0) { hIdx--; input.value = history[hIdx] || ""; syncCaret(); }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (hIdx < history.length) { hIdx++; input.value = history[hIdx] || ""; syncCaret(); }
      } else if (e.key === "Escape") {
        CMD.clear.run();
      }
      sbLeft.textContent = "COL " + (input.value.length + 1);
    });

    input.addEventListener("input", syncCaret);

    function syncCaret() {
      const caret = document.getElementById("caret");
      // 用隐藏 span 测量文本宽度，让光标跟在文字后
      const measure = document.createElement("span");
      measure.style.cssText = "position:absolute;visibility:hidden;white-space:pre;font:14px var(--mono)";
      measure.textContent = input.value || "";
      document.body.appendChild(measure);
      const mono = 8.4; // 单字符近似宽
      caret.style.marginLeft = Math.min(measure.offsetWidth || input.value.length * mono, input.clientWidth - 10) + "px";
      caret.style.position = "relative";
      caret.style.left = "0";
      measure.remove();
    }
  }

  function exec(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const [name, ...args] = trimmed.split(/\s+/);
    const cmd = CMD[name.toLowerCase()];
    if (!cmd) {
      print("ERR: 未知命令「" + name + "」", "err");
      print("输入 help 查看全部命令", "dim");
      return;
    }
    try { cmd.run(args); }
    catch (e) { print("ERR: " + e.message, "err"); }
  }

  /* ---------- 开机 ---------- */
  function powerOn() {
    boot.remove();
    term.hidden = false;
    statusbar.hidden = false;
    print("PHOSPHOR-9000 终端就绪。今天是 " + fmt(new Date()), "dim");
    print("输入 help 查看全部命令；工具都在本地运行，不联网。", "dim");
    print("", "dim");
    buildInput();
  }

  window.addEventListener("keydown", function once(e) {
    if (!boot.isConnected) return;
    powerOn();
  }, { once: true });
  boot.addEventListener("click", () => {
    if (boot.isConnected) powerOn();
  }, { once: true });

  // 点击屏幕任意处聚焦输入框
  document.querySelector(".screen").addEventListener("click", (e) => {
    if (e.target.tagName !== "INPUT") document.getElementById("cmdInput")?.focus();
  });
})();
