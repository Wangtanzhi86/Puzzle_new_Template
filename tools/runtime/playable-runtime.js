/*
 * 单文件 HTML 的浏览器侧运行时。由 tools/pack-playable.mjs 原样注入产物，不是工程模块：
 * 它跑的时候引擎还没起，禁止 import，禁止引用工程里的任何东西。
 *
 * Cocos 3.8.8 / web-mobile 的产物靠五个入口加载，逐个拦：
 *   1. SystemJS 取模块源码   —— shouldFetch/fetch 是官方扩展点，相对 URL 照常解析
 *   2. XMLHttpRequest        —— settings.json、bundle config、图片字节
 *   3. HTMLImageElement.src  —— 引擎的 downloadDomImage 走 new D.Image，不经过 XHR
 *   4. HTMLScriptElement.src —— bundle 的 index.js，既不经过 XHR 也不经过 SystemJS
 *   5. window.fetch          —— Emscripten 的 wasm 运行时走裸 fetch
 * 没命中的一律回落给原生实现，所以同一份产物传服务器上也照常跑。
 */
(function () {
  'use strict';

  var ALPHABET = '__ALPHABET__';
  var ENCODING = '__ENCODING__';
  var CC = (window.__CC_PACK__ = { files: null, ready: false, fail: null });
  var blobUrls = Object.create(null);

  function fatal(msg) {
    CC.fail = msg;
    var d = document.createElement('div');
    d.style.cssText =
      'position:absolute;left:0;top:0;right:0;z-index:99999;padding:16px;' +
      'background:#400;color:#fff;font:14px/1.6 monospace;white-space:pre-wrap';
    d.textContent = '打包产物启动失败：\n' + msg;
    (document.body || document.documentElement).appendChild(d);
  }

  function decodeBase85(str) {
    var rev = new Int16Array(128).fill(-1);
    for (var i = 0; i < ALPHABET.length; i++) rev[ALPHABET.charCodeAt(i)] = i;
    var n = Math.floor(str.length / 5);
    var out = new Uint8Array(n * 4);
    var p = 0;
    for (var g = 0; g < n; g++) {
      var v = 0, base = g * 5;
      for (var j = 0; j < 5; j++) v = v * 85 + rev[str.charCodeAt(base + j)];
      out[p++] = (v >>> 24) & 255;
      out[p++] = (v >>> 16) & 255;
      out[p++] = (v >>> 8) & 255;
      out[p++] = v & 255;
    }
    return out;
  }

  function decodeBase64(str) {
    var bin = atob(str), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function gunzip(bytes) {
    if (typeof DecompressionStream !== 'function') {
      return Promise.reject(new Error('浏览器不支持 DecompressionStream（需 Chrome 80+ / Safari 16.4+ / Firefox 113+）'));
    }
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
  }

  // 容器：u32le 头长度 + JSON 头 [[路径, 偏移, 长度], ...] + 拼接的字节体
  function parseContainer(buf) {
    var view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    var headLen = view.getUint32(0, true);
    var head = JSON.parse(new TextDecoder().decode(buf.subarray(4, 4 + headLen)));
    var bodyStart = 4 + headLen;
    var map = new Map();
    for (var i = 0; i < head.length; i++) {
      var e = head[i];
      map.set(e[0], buf.subarray(bodyStart + e[1], bodyStart + e[1] + e[2]));
    }
    return map;
  }

  // ── URL → 构建目录内的相对路径 ────────────────────────────────────────
  // 引擎请求的 URL 形态很杂：'assets/main/config.json'、'./../cocos-js/cc.js'、
  // 绝对 file:///D:/…/index.js、还可能带 ?v=xxx。先按 baseURI 解析出相对路径，
  // 解析不出来或对不上就退回「后缀撞」——撞到唯一一个才认，避免误命中。
  var baseDir = (function () {
    var p = decodeURIComponent(location.pathname || '');
    return p.slice(1, p.lastIndexOf('/') + 1);
  })();

  function candidates(url) {
    var out = [];
    try {
      var abs = new URL(url, document.baseURI);
      var p = decodeURIComponent(abs.pathname || '');
      out.push(p.charAt(0) === '/' ? p.slice(1) : p);
    } catch (e) { /* 不是合法 URL */ }
    var stripped = String(url).replace(/[?#].*$/, '').replace(/^\.\//, '');
    out.push(stripped);
    if (stripped.charAt(0) === '/') out.push(stripped.slice(1));
    return out;
  }

  function lookup(url) {
    if (!CC.files) return null;
    var cands = candidates(url);
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (CC.files.has(c)) return CC.files.get(c);
      if (baseDir && c.indexOf(baseDir) === 0 && CC.files.has(c.slice(baseDir.length))) {
        return CC.files.get(c.slice(baseDir.length));
      }
    }
    var tail = cands[cands.length - 1];
    var hit = null;
    CC.files.forEach(function (v, k) {
      if (k.length <= tail.length && tail.slice(-k.length) === k) {
        if (hit) { hit = null; return; } // 撞到多个，放弃
        hit = v;
      }
    });
    return hit;
  }

  function blobUrlFor(url, mime) {
    var key = String(url);
    if (!blobUrls[key]) {
      var bytes = lookup(url);
      if (!bytes) return null;
      // 图片不给 MIME：浏览器按魔数认，正好配合 PNG→无损 WebP 的字节替换。
      // 脚本必须给 text/javascript，否则 blob 不执行。
      blobUrls[key] = URL.createObjectURL(new Blob([bytes], mime ? { type: mime } : undefined));
    }
    return blobUrls[key];
  }

  // ── 拦截 1：XMLHttpRequest ────────────────────────────────────────────
  function installXhr() {
    var Native = window.XMLHttpRequest;

    function Shim() {
      this.readyState = 0;
      this.status = 0;
      this.statusText = '';
      this.response = null;
      this.responseText = '';
      this.responseType = '';
      this.timeout = 0;
      this.withCredentials = false;
      this.onload = null;
      this.onerror = null;
      this.ontimeout = null;
      this.onprogress = null;
      this.onreadystatechange = null;
      this._headers = {};
    }
    Shim.prototype.open = function (method, url) { this._url = url; this.readyState = 1; };
    Shim.prototype.setRequestHeader = function (k, v) { this._headers[k] = v; };
    Shim.prototype.overrideMimeType = function () {};
    Shim.prototype.getResponseHeader = function () { return null; };
    Shim.prototype.getAllResponseHeaders = function () { return ''; };
    Shim.prototype.abort = function () {};
    Shim.prototype.addEventListener = function () {};
    Shim.prototype.removeEventListener = function () {};
    Shim.prototype.send = function () {
      var self = this;
      var bytes = lookup(this._url);
      if (!bytes) {
        var real = new Native();
        real.open('GET', this._url, true);
        real.responseType = this.responseType;
        real.timeout = this.timeout;
        real.withCredentials = this.withCredentials;
        for (var k in this._headers) real.setRequestHeader(k, this._headers[k]);
        real.onload = function () {
          self.status = real.status;
          self.response = real.response;
          self.responseText = real.responseType === '' || real.responseType === 'text' ? real.response : '';
          if (self.onload) self.onload();
        };
        real.onerror = function () { self.status = 0; if (self.onerror) self.onerror(); };
        real.ontimeout = function () { if (self.ontimeout) self.ontimeout(); };
        return real.send();
      }
      setTimeout(function () {
        var data = bytes;
        self.status = 200;
        self.statusText = 'OK';
        self.readyState = 4;
        var rt = self.responseType;
        if (rt === 'arraybuffer') {
          // 给一份独立的 ArrayBuffer：引擎会拿去做 Blob / createImageBitmap，
          // 直接给 subarray 的 buffer 会把整个容器都带进去
          self.response = data.slice().buffer;
        } else if (rt === 'blob') {
          self.response = new Blob([data]);
        } else if (rt === 'json') {
          self.response = JSON.parse(new TextDecoder().decode(data));
        } else {
          self.response = self.responseText = new TextDecoder().decode(data);
        }
        if (self.onprogress) self.onprogress({ lengthComputable: true, loaded: data.length, total: data.length });
        if (self.onreadystatechange) self.onreadystatechange();
        if (self.onload) self.onload();
      }, 0);
    };

    window.XMLHttpRequest = Shim;
  }

  // ── 拦截 2：img / audio / video 的 src ────────────────────────────────
  function installElementSrc() {
    [window.HTMLImageElement, window.HTMLMediaElement].forEach(function (Ctor) {
      if (!Ctor) return;
      var desc = Object.getOwnPropertyDescriptor(Ctor.prototype, 'src');
      if (!desc || !desc.set) return;
      Object.defineProperty(Ctor.prototype, 'src', {
        configurable: true,
        enumerable: desc.enumerable,
        get: function () { return desc.get.call(this); },
        set: function (v) {
          desc.set.call(this, blobUrlFor(v) || v);
        },
      });
    });
  }

  // ── 拦截 4：bundle 脚本的 src ─────────────────────────────────────────
  function installScriptSrc() {
    var proto = window.HTMLScriptElement && window.HTMLScriptElement.prototype;
    if (!proto) return;
    var desc = Object.getOwnPropertyDescriptor(proto, 'src');
    if (!desc || !desc.set) return;
    Object.defineProperty(proto, 'src', {
      configurable: true,
      enumerable: desc.enumerable,
      get: function () { return desc.get.call(this); },
      set: function (v) {
        desc.set.call(this, blobUrlFor(v, 'text/javascript') || v);
      },
    });
  }

  // ── 拦截 5：裸 fetch（wasm）──────────────────────────────────────────
  function installFetch() {
    var nativeFetch = window.fetch;
    if (!nativeFetch) return;
    window.fetch = function (input, init) {
      var url = String(typeof input === 'string' ? input : (input && input.url) || input);
      var bytes = lookup(url);
      if (!bytes) return nativeFetch.call(this, input, init);
      var s = url.replace(/[?#].*$/, '');
      var type = /\.wasm$/i.test(s) ? 'application/wasm'
        : /\.json$/i.test(s) ? 'application/json'
          : /\.(js|txt|css)$/i.test(s) ? 'text/javascript'
            : 'application/octet-stream';
      return Promise.resolve(new Response(bytes, { status: 200, headers: { 'Content-Type': type } }));
    };
  }

  // ── 拦截 3：SystemJS 取模块源码 ──────────────────────────────────────
  // 打开 shouldFetch 后它不再插 <script src>，而是问我们要源码，
  // 于是相对 URL 的解析照常走，index.js 里那句 System.import('./application.js') 不用改写。
  function installSystemFetch() {
    if (!window.System || !window.System.constructor) return;
    var proto = window.System.constructor.prototype;
    var nativeFetch = proto.fetch || window.fetch;
    proto.shouldFetch = function () { return true; };
    proto.fetch = function (url, opts) {
      var bytes = lookup(url);
      if (!bytes) return nativeFetch.call(this, url, opts);
      var text = new TextDecoder().decode(bytes);
      var type = 'application/javascript';
      if (/\.json([?#]|$)/i.test(String(url))) type = 'application/json';
      else if (/\.css([?#]|$)/i.test(String(url))) type = 'text/css';
      else if (/\.wasm([?#]|$)/i.test(String(url))) type = 'application/wasm';
      return Promise.resolve(new Response(text, { status: 200, headers: { 'Content-Type': type } }));
    };
  }

  // 地址加 #debug 打开启动日志（file:///D:/x/playable.html#debug）
  var DBG = /debug/.test(location.hash);
  function log(msg) { if (DBG) console.log('[单文件] ' + msg); }

  // ── 前置检查 1：mraid ready（Core #10）────────────────────────────────
  // 三种情况都要覆盖：
  //   1. 压根没有 mraid（本地双击 / 非 AppLovin 容器）→ 轮询一小会儿确认它不来就放行
  //   2. 有 mraid 且状态不是 loading → 它早 ready 了。ready 事件只发一次，
  //      错过就永远没有，这时还去等事件就是永久白屏
  //   3. 有 mraid 且 loading → 等 ready 事件 + 超时兜底
  // 超时兜底不能省：不 ready 却没有兜底 = 永久白屏，比降级启动糟得多。
  var MRAID_WAIT_MS = 5000;
  var MRAID_POLL_MS = 1500;
  var MRAID_POLL_STEP = 50;

  function probeMraid() {
    return new Promise(function (resolve) {
      var started = Date.now();

      function done(found, ready, timedOut) {
        resolve({ found: found, ready: ready, timedOut: timedOut });
      }

      (function step() {
        var m = window.mraid;
        if (!m || typeof m !== 'object') {
          if (Date.now() - started < MRAID_POLL_MS) { setTimeout(step, MRAID_POLL_STEP); return; }
          done(false, false, false);
          return;
        }

        var state = null;
        try { state = m.getState ? m.getState() : null; } catch (e) { state = null; }
        if (state && state !== 'loading') { done(true, true, false); return; }

        var settled = false;
        function finish(timedOut) {
          if (settled) return;
          settled = true;
          done(true, !timedOut, timedOut);
        }
        try { m.addEventListener('ready', function () { finish(false); }); } catch (e) { /* 只剩超时兜底 */ }
        setTimeout(function () { finish(true); }, MRAID_WAIT_MS);
      })();
    });
  }

  // ── 前置检查 2：WebGL（Core #12）─────────────────────────────────────
  // 有些 WebView 在页面刚加载那一瞬间拿不到 GPU context，过几百毫秒就好了。
  // 超时之后照样启动：真没有 WebGL 时白屏等下去也不会变好。
  var WEBGL_WAIT_MS = 5000;
  var WEBGL_POLL_STEP = 200;

  function hasWebgl() {
    try {
      var canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch (e) {
      return false;
    }
  }

  function probeWebgl() {
    if (hasWebgl()) return Promise.resolve(true);
    log('WebGL 初次检测失败，开始周期重查');
    return new Promise(function (resolve) {
      var started = Date.now();
      (function retry() {
        if (hasWebgl()) { resolve(true); return; }
        if (Date.now() - started >= WEBGL_WAIT_MS) {
          console.warn('[单文件] WebGL 一直不可用，仍然启动引擎');
          resolve(false);
          return;
        }
        setTimeout(retry, WEBGL_POLL_STEP);
      })();
    });
  }

  var el = document.getElementById('__cc_payload');
  var payload = (el && el.textContent) || '';
  var raw;
  try {
    log('载荷 ' + payload.length + ' 字符');
    raw = ENCODING === 'base85' ? decodeBase85(payload) : decodeBase64(payload);
    // base85 是 4 字节一组，末尾不足 4 字节要补零才凑得满 5 个字符。补出来的零字节
    // 对 gzip 是「结束标记之后的垃圾」：Node 的 gunzip 默默忽略，浏览器的
    // DecompressionStream 会抛 "Junk found after end of compressed data"，整包起不来。
    var want = el && parseInt(el.getAttribute('data-len'), 10);
    if (want > 0 && raw.length > want) {
      log('裁掉末尾 ' + (raw.length - want) + ' 个补齐字节');
      raw = raw.subarray(0, want);
    }
    log('解码完成 ' + raw.length + ' 字节');
  } catch (err) {
    // 同步阶段的异常进不了下面的 .catch，不单独兜住页面就是一片安静的黑
    console.error(err);
    fatal('解码载荷失败：' + ((err && err.stack) || String(err)));
    return;
  }

  gunzip(raw).then(function (container) {
    log('解压完成 ' + container.length + ' 字节');
    CC.files = parseContainer(container);
    CC.ready = true;
    log('容器里 ' + CC.files.size + ' 个文件');
    installXhr();
    installElementSrc();
    installScriptSrc();
    installSystemFetch();
    // 必须排在 SystemJS 那条后面：它内部记原生 fetch 用的是 proto.fetch || window.fetch，
    // 先装的话它会把我们的替身记成「原生」，此后每次没命中都要多绕一层
    installFetch();
    log('五处拦截已装好，等 mraid / WebGL');

    // 两条前置并行等，互不依赖。结果留给 TS 侧读：那边只知道「mraid 能不能用」，
    // 「为什么不能用」只有这里知道。
    return Promise.all([probeMraid(), probeWebgl()]).then(function (r) {
      var mraid = r[0];
      window.__ccAdEnv = {
        mraid: mraid.found,
        ready: mraid.ready,
        timedOut: mraid.timedOut,
        webgl: r[1],
      };
      log('mraid：' + (mraid.found ? (mraid.ready ? 'ready' : '超时降级') : '无容器') + '，WebGL：' + r[1]);
      return window.System.import('./index.js');
    });
  }).then(function () {
    log('index.js 起来了');
  }).catch(function (err) {
    console.error(err);
    fatal((err && err.stack) || String(err));
  });
})();
