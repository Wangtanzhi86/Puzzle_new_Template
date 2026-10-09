#!/usr/bin/env node
/**
 * 把 Cocos 的 build/web-mobile 打成一个 AppLovin 要的单文件 HTML。
 *
 * 用法：
 *   node tools/pack-playable.mjs                  # build/web-mobile → build/playable.html
 *   node tools/pack-playable.mjs --report         # 只打印体积明细，不写文件
 *   node tools/pack-playable.mjs --no-webp        # 不转 WebP（也就不需要 @jsquash 依赖）
 *   node tools/pack-playable.mjs --base64         # 用 base64 代替 base85（体积约 +6%）
 *   node tools/pack-playable.mjs --allow-placeholder  # 商店链接还是占位符也放行（只用于开发期）
 *   node tools/pack-playable.mjs --in <目录> --out <文件>
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
import { ALPHABET, buildContainer, checkPayload, encodeBase64, encodeBase85 } from './lib/payload.mjs';
import { assertComplete, readBuild, toWebp } from './lib/assets.mjs';

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
  const o = { build: 'build/web-mobile', out: null, webp: true, base64: false, report: false, allowPlaceholder: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--build' || a === '--in') o.build = argv[++i];
    else if (a === '--out') o.out = argv[++i];
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

function buildHtml(files, options) {
  const byRel = new Map(files.map((f) => [f.rel, f]));
  const read = (rel) => {
    const f = byRel.get(rel);
    if (!f) throw new Error(`构建产物里没有 ${rel}，产物结构跟预期不一样`);
    return f.data.toString('utf8');
  };

  const body = extractBody(fs.readFileSync(path.join(options.build, 'index.html'), 'utf8'));
  const importMap = normalizeImportMap(files);

  const container = buildContainer(files);
  const gz = zlib.gzipSync(container, { level: 9 });
  const encoded = options.base64 ? encodeBase64(gz) : encodeBase85(gz);
  const pad = checkPayload(encoded, gz, options.base64);

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

<script id="__cc_payload" type="text/plain" data-len="${gz.length}">${encoded}</script>
<script>${jsSafe(runtime)}</script>
</body>
</html>
`;
  return { html, container: container.length, gzipped: gz.length, padded: pad };
}

// ── 验产物 ──────────────────────────────────────────────────────────────────

/**
 * 扫之前必须剥掉 HTML 注释：模板里那句「不许加 <script src="mraid.js">」的忠告
 * 本身会被判成违规。剥掉是对的 —— 注入出来的引用是活标记，不可能在注释里。
 */
function verify(html) {
  console.log('\n【验产物】');
  const noComments = html.replace(/<!--[\s\S]*?-->/g, '');

  if (html.includes('__ccAdEnv')) ok('启动闸门在产物里（mraid ready + WebGL 重试）');
  else bad('启动闸门不在产物里 —— Core #10 / #12 那两条没生效');

  // PDF §2.1：Do not include mraid.js，SDK 由容器注入。要拦的是「让浏览器去加载 mraid
  // 的那种引用」——相对路径的 mraid.js 外链检查拦不住，所以这条单独存在。
  const mraidRefs = [...noComments.matchAll(/(?:src|href)\s*=\s*["']([^"']*mraid[^"']*)["']/gi)].map((m) => m[1]);
  if (mraidRefs.length === 0) ok('没有会去加载 mraid 的 src/href 引用（PDF §2.1）');
  else bad(`产物里有 ${mraidRefs.length} 处会去加载 mraid 的 src/href：${[...new Set(mraidRefs)].join(' / ')}`);

  // 反过来：桥的代码应该在包里。一处 mraid 标识符都没有 = CTA 会静默失效
  if (!/mraid/i.test(noComments)) warn('产物里一处 mraid 标识符都没有 —— MraidBridge 可能没打进包，跳转会静默失效');

  const externals = [...html.matchAll(/(?:src|href)\s*=\s*["'](https?:[^"']+)["']/gi)].map((m) => m[1]);
  if (externals.length === 0) ok('零外链（src/href 全是内联或 data:）');
  else {
    bad(`${externals.length} 处外链 —— AppLovin 要求不引用任何外部托管文件（Core #4）`);
    for (const u of [...new Set(externals)].slice(0, 10)) console.log('        ' + u);
  }

  // Core #5：横竖屏都要支持，不许有方向锁
  if (/ad\.orientation/i.test(html)) warn('产物里有 ad.orientation 元信息 —— 确认它没有把方向锁死（Core #5）');
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^\/\*\*?/, ''));
    return;
  }
  if (!options.out) options.out = path.join(path.dirname(options.build), 'playable.html');

  console.log('★ AppLovin 单文件打包');
  console.log(`  ${path.resolve(options.build)} → ${path.resolve(options.out)}`);

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

  const built = buildHtml(files, options);
  const outBytes = Buffer.byteLength(built.html, 'utf8');

  if (options.report) {
    console.log('\n拼容器 + gzip：' + mb(built.container) + ' → ' + mb(built.gzipped));
    console.log(`编码（${options.base64 ? 'base64' : 'base85'}，尾部补 ${built.padded} 字节）：${mb(outBytes)}`);
    return;
  }

  fs.writeFileSync(options.out, built.html, 'utf8');
  ok('产物已写出：' + path.resolve(options.out));

  verify(built.html);

  console.log('\n【体积】');
  // AppLovin 的 5MB 看的是原样大小：图/音本来就是压缩过的，base64 之后反而涨 33%，
  // gzip 基本压不动 —— 所以 5MB 那条线近似等于「原样 5MB」。
  console.log(`  原样 ${mb(outBytes)}　（gzip 后 ${kb(zlib.gzipSync(Buffer.from(built.html, 'utf8')).length)}，仅供参考）`);
  if (outBytes > LIMIT) bad(`超了 5MB 上限 ${mb(outBytes - LIMIT)}`);
  else ok(`在 5MB 上限内，余量 ${mb(LIMIT - outBytes)}（Core #1）`);

  console.log('');
  if (failures) {
    console.error(`★ ${failures} 项没过 —— 不是可交付的产物`);
    process.exit(1);
  }
  console.log('★ 全过。双击产物即可自测（无 mraid 时会打日志说明），也可传 AppLovin。');
}

main().catch((e) => {
  console.error('✗ ' + e.message);
  process.exit(1);
});
