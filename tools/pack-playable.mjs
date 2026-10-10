#!/usr/bin/env node
/**
 * 把 Cocos 的 build/web-mobile 打成能投放的产物。默认一次出三份：
 *
 *   build/playable.html         AppLovin  单文件 HTML，CTA 走 mraid.open
 *   build/playable.moloco.html  Moloco    单文件 HTML，CTA 走 FbPlayableAd.onCTAClick()
 *   build/playable.google.zip   Google    同一个 HTML 套个 zip，CTA 走 ExitApi.exit()
 *
 * 三份共用同一份构建产物、同一套玩法代码，差别只有 <head> 里注入的那段 CTA 适配器
 * 和 Google 那份多出来的 ad.orientation / exitapi.js。见 tools/lib/channels.mjs。
 *
 * 用法：
 *   node tools/pack-playable.mjs                  # 三份都出
 *   node tools/pack-playable.mjs --channel google # 只出某一份
 *   node tools/pack-playable.mjs --report         # 只打印体积明细，不写文件
 *   node tools/pack-playable.mjs --no-webp        # 不转 WebP（也就不需要 @jsquash 依赖）
 *   node tools/pack-playable.mjs --base64         # 用 base64 代替 base85（体积约 +6%）
 *   node tools/pack-playable.mjs --allow-placeholder  # 商店链接还是占位符也放行（只用于开发期）
 *   node tools/pack-playable.mjs --in <目录> --out <文件>   # --out 隐含「只出 AppLovin 那一份」
 *
 * 编辑器里构建 web-mobile 之后，extensions/playable-builder 会自动调这个脚本。
 *
 * 不碰引擎、不碰构建配置、不碰素材：构建产物一律原样保留，只在浏览器里拦五个入口
 * 把字节喂进去（见 tools/runtime/playable-runtime.js 的文件头）。
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { CHANNELS, ctaHeadScript } from './lib/channels.mjs';
import { ALPHABET, buildContainer, checkPayload, encodeBase64, encodeBase85 } from './lib/payload.mjs';
import { assertComplete, readBuild, toWebp } from './lib/assets.mjs';
import { makeZip } from './lib/zip.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const LIMIT = 5 * 1024 * 1024;

/** .invalid 是 RFC 2606 留给「永远不解析」的顶级域 */
const FAKE_BASE = 'http://single-file.invalid/';

const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
const kb = (n) => (n / 1024).toFixed(1) + ' KB';

let failures = 0;
const ok = (m) => console.log('  ✅ ' + m);
const bad = (m) => { failures++; console.error('  ❌ ' + m); };
const warn = (m) => console.warn('  ⚠️  ' + m);

// ── 参数 ────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const o = { build: 'build/web-mobile', out: null, channel: null, webp: true, base64: false, report: false, allowPlaceholder: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--build' || a === '--in') o.build = argv[++i];
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--channel') o.channel = argv[++i];
    else if (a === '--no-webp') o.webp = false;
    else if (a === '--base64') o.base64 = true;
    else if (a === '--report') o.report = true;
    else if (a === '--allow-placeholder') o.allowPlaceholder = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else throw new Error('不认识的参数：' + a);
  }
  return o;
}

// ── 组装 HTML ───────────────────────────────────────────────────────────────

/** 把 JS 源码安全地塞进 <script>：只要不出现 `</script` 就不会提前闭合。
 *  JS 里 `<\/script` 和 `</script` 等价（字符串里转义 / 是空操作，正则里也是）。 */
const jsSafe = (src) => src.replace(/<\/(script)/gi, '<\\/$1');

/** 搬构建产物 index.html 的 <body>（画布那些 DOM 结构引擎要认），
 *  但摘掉外链 css/script 和内联启动脚本，换成我们自己的 */
function extractBody(html) {
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let body = m ? m[1] : '';
  body = body.replace(/<script[^>]*\bsrc=[^>]*>\s*<\/script>/gi, '');
  body = body.replace(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi, '');
  body = body.replace(/<link[^>]*rel=["']?stylesheet["']?[^>]*>/gi, '');
  return body.trim();
}

/** import map 里写的是 './../cocos-js/cc.js'（相对 src/）。内联后基准变成页面自身
 *  所在目录，所以按 src/ 归一化再写成相对页面根目录的 './xxx'。
 *  只按 '../' 开头替换会漏掉 './../'，那种要靠运行时后缀兜底，栈里会显示成不存在的路径。 */
function normalizeImportMap(files) {
  let raw = { imports: {} };
  try {
    const f = files.find((x) => x.rel === 'src/import-map.json');
    if (f) raw = JSON.parse(f.data.toString('utf8'));
  } catch { /* 保持空表 */ }
  raw.imports = raw.imports || {};
  for (const k in raw.imports) {
    const v = raw.imports[k];
    if (/^\.\.?\//.test(v)) {
      raw.imports[k] = './' + path.posix.normalize(path.posix.join('src', v))
        .replace(/^(\.\.\/)+/, '').replace(/^\.\//, '');
    }
  }
  return raw;
}

function buildHtml(files, options, channel, pre) {
  const byRel = new Map(files.map((f) => [f.rel, f]));
  const read = (rel) => {
    const f = byRel.get(rel);
    if (!f) throw new Error(`构建产物里没有 ${rel}，产物结构跟预期不一样`);
    return f.data.toString('utf8');
  };

  const body = extractBody(fs.readFileSync(path.join(options.build, 'index.html'), 'utf8'));
  const importMap = normalizeImportMap(files);

  const runtime = fs.readFileSync(path.join(HERE, 'runtime', 'playable-runtime.js'), 'utf8')
    .replace('__ALPHABET__', ALPHABET)
    .replace('__ENCODING__', options.base64 ? 'base64' : 'base85');

  // 必须排在 <head> 最前面：SystemJS 的 base 是它执行那一刻读的，而它被内联在 body 开头
  const baseFix = '<script>' + jsSafe(
    fs.readFileSync(path.join(HERE, 'runtime', 'base-fix.js'), 'utf8').replace('__FAKE_BASE__', FAKE_BASE),
  ) + '<\/script>';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
${baseFix}
${ctaHeadScript(channel)}
${channel.extraHead}
<title>Playable</title>
<meta name="viewport" content="width=device-width,user-scalable=no,initial-scale=1,minimum-scale=1,maximum-scale=1,minimal-ui=true">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="format-detection" content="telephone=no">
<meta name="msapplication-tap-highlight" content="no">
<meta name="full-screen" content="yes">
<style>
${read('style.css').trim()}
</style>
</head>
<body>
${body}

<script>${jsSafe(read('src/polyfills.bundle.js'))}</script>
<script>${jsSafe(read('src/system.bundle.js'))}</script>
<script type="systemjs-importmap">${JSON.stringify(importMap)}</script>

<script id="__cc_payload" type="text/plain" data-len="${pre.gzLen}">${pre.encoded}</script>
<script>${jsSafe(runtime)}</script>
</body>
</html>
`;
  return { html };
}

// ── 验产物 ──────────────────────────────────────────────────────────────────

/**
 * 扫之前必须剥掉 HTML 注释：模板里那句「不许加 <script src="mraid.js">」的忠告
 * 本身会被判成违规。剥掉是对的 —— 注入出来的引用是活标记，不可能在注释里。
 */
function verify(html, channel) {
  console.log(`\n【验产物 · ${channel.label}】`);
  const noComments = html.replace(/<!--[\s\S]*?-->/g, '');

  if (html.includes('__ccAdEnv')) ok('启动闸门在产物里（mraid ready + WebGL 重试）');
  else bad('启动闸门不在产物里 —— Core #10 / #12 那两条没生效');

  // PDF §2.1：Do not include mraid.js，SDK 由容器注入。要拦的是「让浏览器去加载 mraid
  // 的那种引用」——相对路径的 mraid.js 外链检查拦不住，所以这条单独存在。
  const mraidRefs = [...noComments.matchAll(/(?:src|href)\s*=\s*["']([^"']*mraid[^"']*)["']/gi)].map((m) => m[1]);
  if (mraidRefs.length === 0) ok('没有会去加载 mraid 的 src/href 引用（PDF §2.1）');
  else bad(`产物里有 ${mraidRefs.length} 处会去加载 mraid 的 src/href：${[...new Set(mraidRefs)].join(' / ')}`);

  // CTA 适配器注入在 <head>，是明文。缺了就是装错了 —— 点了会静默不跳。
  // Moloco 那家还要求这个串本身在 HTML 里能被搜到，明文正是为此。
  if (noComments.includes(channel.ctaApi)) {
    ok(`CTA 适配器是明文注入的（${channel.ctaApi}）`);
  } else {
    bad(`产物里没有明文的 ${channel.ctaApi} —— ${channel.label} 的 CTA 会静默失效`);
  }

  if (new RegExp(`__CC_CHANNEL\\s*=\\s*["']${channel.id}["']`).test(noComments)) {
    ok(`通道标识是 ${channel.id}（真机调试时能一眼认出手上是哪份产物）`);
  } else {
    bad(`产物里没有 __CC_CHANNEL=${channel.id} —— 这份产物不知道是给谁的`);
  }

  const externals = [...html.matchAll(/(?:src|href)\s*=\s*["'](https?:[^"']+)["']/gi)].map((m) => m[1]);
  const allowed = externals.filter((u) => channel.allowExternal.some((re) => re.test(u)));
  const strays = externals.filter((u) => !allowed.includes(u));
  if (strays.length) {
    bad(`${strays.length} 处外链不在白名单里 —— 三家的规范都不许引用外部托管文件（Core #4）`);
    for (const u of [...new Set(strays)].slice(0, 10)) console.log('        ' + u);
  } else if (allowed.length) {
    ok(`外链只有 ${allowed.length} 处白名单项（${[...new Set(allowed)].join(' / ')}）`);
  } else {
    ok('零外链（src/href 全是内联或 data:）');
  }

  if (channel.requireOrientation) {
    // Google 要靠这个 meta 判定创意的方向；不写就是「方向不受支持的创意」
    if (/name=["']ad\.orientation["']/i.test(noComments)) {
      ok('ad.orientation 元信息在（横竖屏都声明了）');
    } else {
      bad('缺 ad.orientation 元信息 —— Google 会判成方向不受支持的创意');
    }
  } else if (/ad\.orientation/i.test(noComments)) {
    bad(`产物里有 ad.orientation 元信息 —— ${channel.label} 不需要它，且可能把方向锁死（Core #5）`);
  }

  for (const s of channel.forbid) {
    const n = noComments.split(s).length - 1;
    if (n === 0) ok(`不含禁项 ${s}`);
    else bad(`产物里有 ${n} 处 ${s} —— ${channel.label} 的素材检查会拒收`);
  }

  for (const s of channel.softForbid) {
    const n = noComments.split(s.text).length - 1;
    if (n === 0) ok(`不含 ${s.text}`);
    else warn(`产物里有 ${n} 处 ${s.text}：${s.why}`);
  }
}

/**
 * 商店链接占位符检查。
 *
 * 注意不能在打包后的 HTML 里找 —— 产物已经 gzip + base85 编码，链接是找不着的。
 * 要扫构建目录里已编译的 JS/JSON 原文。
 *
 * 占位符没换掉的后果特别隐蔽：CTA 点下去跳到 404 商店页，mraid.open 不报错，
 * AppLovin 后台也看不出异常，只有真人点了才知道。
 */
function checkStoreLinks(files, options) {
  console.log('\n【商店链接】');
  const text = files
    .filter((f) => f.rel.endsWith('.js') || f.rel.endsWith('.json'))
    .map((f) => f.data.toString('utf8'))
    .join('\n');

  const urls = [...new Set(
    [...text.matchAll(/https:\/\/(?:apps\.apple\.com|play\.google\.com)\/[^"'`\s<>)\\]*/g)].map((m) => m[0]),
  )];

  if (!urls.length) {
    bad('构建产物里一条商店链接都没有 —— PlayableConfig 可能没被引用到，CTA 点了不会有反应');
    return;
  }

  const bad_ = urls.filter((u) => /XXXX|example|id0{6,}/i.test(u));
  if (bad_.length) {
    const msg = `${bad_.length} 条商店链接还是占位符，点了会跳 404 商店页：\n        ${bad_.join('\n        ')}`;
    if (options.allowPlaceholder) warn(msg + '\n        （--allow-placeholder 放行，交付前必须换掉）');
    else bad(msg + '\n        改 assets/scripts/config/PlayableConfig.ts；开发期可加 --allow-placeholder');
    return;
  }

  ok(`${urls.length} 条商店链接已填实，无占位符`);

  const hasIos = urls.some((u) => u.includes('apps.apple.com'));
  const hasAndroid = urls.some((u) => u.includes('play.google.com'));
  if (hasIos && hasAndroid) ok('iOS / Android 两条都有');
  else warn(`只找到 ${hasIos ? 'iOS' : 'Android'} 一条 —— 另一个平台点了会没反应（§8.3）`);
}

// ── 主流程 ──────────────────────────────────────────────────────────────────

/** 选中哪些通道。没给 --channel 就三份都出；给了 --out（老用法）就只出 AppLovin 那一份。 */
function selectChannels(options) {
  if (options.channel) {
    const c = CHANNELS.find((x) => x.id === options.channel);
    if (!c) throw new Error(`不认识的通道：${options.channel}（可选 ${CHANNELS.map((x) => x.id).join(' / ')}）`);
    return [c];
  }
  if (options.out) return [CHANNELS[0]];
  return CHANNELS;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^\/\*\*?/, ''));
    return;
  }

  const channels = selectChannels(options);
  const outDir = path.dirname(options.build);
  const outFor = (ch) => (options.out && channels.length === 1 ? options.out : path.join(outDir, ch.out));

  console.log('★ 试玩打包　' + channels.map((c) => c.label).join(' + '));
  console.log(`  ${path.resolve(options.build)} → ${path.resolve(outDir)}`);

  if (!fs.existsSync(options.build)) {
    throw new Error(`找不到构建目录：${options.build}（先在 Creator 里构建一次）`);
  }
  const indexPath = path.join(options.build, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`构建目录里没有 index.html：${options.build}（这不像是 web-mobile 的构建产物）`);
  }
  assertComplete(options.build);

  // 引擎裁剪写在 settings 里，要重新构建才会进产物
  const engineCfg = path.join(ROOT, 'settings/v2/packages/engine.json');
  if (fs.existsSync(engineCfg) && fs.statSync(engineCfg).mtimeMs > fs.statSync(indexPath).mtimeMs) {
    warn('引擎裁剪设置比这次构建新，产物里还没有裁剪的效果。想省下那部分体积，先重新构建一次。');
  }

  const files = readBuild(options.build);
  const rawTotal = files.reduce((t, f) => t + f.data.length, 0);
  console.log(`\n构建产物：${files.length} 个文件，${mb(rawTotal)}`);

  checkStoreLinks(files, options);

  if (options.webp) {
    const w = await toWebp(files);
    const after = files.reduce((t, f) => t + f.data.length, 0);
    if (!w.skipped) console.log(`WebP：${w.converted} 张转了，省 ${mb(w.saved)}，现在 ${mb(after)}`);
  }

  // 三份产物共用的那一大块：拼容器 → gzip → 编码 → 自检。只算一次 ——
  // gzip level 9 跑一遍要一两秒，放进通道循环就是白跑三遍。
  const container = buildContainer(files);
  const gz = zlib.gzipSync(container, { level: 9 });
  const pre = {
    encoded: options.base64 ? encodeBase64(gz) : encodeBase85(gz),
    gzLen: gz.length,
    container: container.length,
  };
  pre.padded = checkPayload(pre.encoded, gz, options.base64);

  const built = channels.map((ch) => ({ channel: ch, ...buildHtml(files, options, ch, pre) }));

  console.log('\n拼容器 + gzip：' + mb(pre.container) + ' → ' + mb(pre.gzLen));
  console.log(`编码（${options.base64 ? 'base64' : 'base85'}，尾部补 ${pre.padded} 字节）`);

  if (options.report) {
    console.log('\n【体积预估·不写文件】');
    for (const b of built) {
      const bytes = Buffer.byteLength(b.html, 'utf8');
      console.log(`  ${b.channel.label.padEnd(18)} ${mb(bytes)}${bytes > LIMIT ? '  ❌ 超 5MB' : '  ✅ 在 5MB 内'}`);
    }
    return;
  }

  console.log('');
  for (const b of built) {
    const ch = b.channel;
    const out = outFor(ch);
    // 格式由通道决定，不看后缀 —— --out 写了个 .html 出来的是 zip 的情况要拦一下，
    // Google 的上传口收的必须是 .zip
    if (ch.zip && !/\.zip$/i.test(out)) {
      warn(`${ch.label} 交的是 zip，产物名却是 ${path.basename(out)} —— 后缀改成 .zip，否则上传会被拒`);
    }
    // HTML 原样写；zip 通道套一层 store 壳 —— 同一份 HTML，只是换个交付格式
    const payload = ch.zip ? makeZip([{ name: 'index.html', data: Buffer.from(b.html, 'utf8') }]) : b.html;
    fs.writeFileSync(out, payload);
    ok(`${ch.label.padEnd(18)} → ${path.resolve(out)}`);

    verify(b.html, ch);

    console.log('【体积】');
    // 5MB 那条线看的是原样大小：图/音本来就是压缩过的，base64 之后反而涨 33%，
    // gzip 基本压不动 —— 所以近似等于「原样 5MB」。
    console.log(`  ${mb(payload.length)}　（HTML 原样 ${mb(Buffer.byteLength(b.html, 'utf8'))}，gzip 后 ${kb(zlib.gzipSync(Buffer.from(b.html, 'utf8')).length)}，仅供参考）`);
    if (payload.length > LIMIT) bad(`超了 5MB 上限 ${mb(payload.length - LIMIT)}`);
    else ok(`在 5MB 上限内，余量 ${mb(LIMIT - payload.length)}（Core #1）`);
    console.log('');
  }

  if (failures) {
    console.error(`★ ${failures} 项没过 —— 不是可交付的产物`);
    process.exit(1);
  }
  console.log('★ 全过。双击产物即可自测（无 mraid 时会打日志说明），也可直接投放。');
}

main().catch((e) => {
  console.error('✗ ' + e.message);
  process.exit(1);
});
