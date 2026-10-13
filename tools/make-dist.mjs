#!/usr/bin/env node
/**
 * 把「一次构建出三份产物」这套链路里**可分发的那部分**收进 dist/playable-pack/，
 * 再压成 dist/playable-pack.zip —— 发给别人，他并到自己项目根目录就能用。
 *
 * 改过 tools/ 或 extensions/playable-builder/ 里的东西，重跑一次本脚本即可。
 *
 * 用法：node tools/make-dist.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeZip } from './lib/zip.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT_DIR = path.join(ROOT, 'dist', 'playable-pack');
const OUT_ZIP = path.join(ROOT, 'dist', 'playable-pack.zip');
const TEMPLATE = path.join(HERE, 'dist-template');

/**
 * 对外发出去的文件。路径两边对称 —— 原仓库的 `tools/lib/zip.mjs`
 * 到对方那儿还是 `tools/lib/zip.mjs`，合并进去就行。
 */
const SHIP = [
  'tools/pack-playable.mjs',
  'tools/lib/assets.mjs',
  'tools/lib/branding.mjs',
  'tools/lib/payload.mjs',
  'tools/lib/channels.mjs',
  'tools/lib/zip.mjs',
  'tools/runtime/playable-runtime.js',
  'tools/runtime/base-fix.js',
  'extensions/playable-builder/builder.js',
  'extensions/playable-builder/hooks.js',
  'extensions/playable-builder/package.json',
];

/** 模板目录整个搬到包根：README.md / integration/** */
function copyTemplate(rel) {
  for (const e of fs.readdirSync(path.join(TEMPLATE, rel), { withFileTypes: true })) {
    const r = path.posix.join(rel, e.name);
    if (e.isDirectory()) copyTemplate(r);
    else {
      const to = path.join(OUT_DIR, r);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(path.join(TEMPLATE, r), to);
    }
  }
}

/** 收集包内所有文件，排好序（zip 内容稳定，重跑不产生无谓 diff） */
function walk(dir, rel = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const r = path.posix.join(rel, e.name);
    if (e.isDirectory()) out.push(...walk(dir, r));
    else out.push(r);
  }
  return out;
}

function main() {
  const missing = SHIP.filter((f) => !fs.existsSync(path.join(ROOT, f)));
  if (missing.length) throw new Error('这些文件不存在，发出去会缺件：\n  ' + missing.join('\n  '));

  fs.rmSync(path.dirname(OUT_DIR), { recursive: true, force: true });
  for (const f of SHIP) {
    const to = path.join(OUT_DIR, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(ROOT, f), to);
  }
  copyTemplate('');

  const files = walk(OUT_DIR);
  const zipBytes = makeZip(files.map((r) => ({
    name: 'playable-pack/' + r,
    data: fs.readFileSync(path.join(OUT_DIR, r)),
  })));
  fs.writeFileSync(OUT_ZIP, zipBytes);

  let total = 0;
  for (const r of files) total += fs.statSync(path.join(OUT_DIR, r)).size;
  const kb = (n) => (n / 1024).toFixed(1) + ' KB';

  console.log(`✅ dist/playable-pack/       ${files.length} 个文件，${kb(total)}`);
  for (const r of files) console.log(`     ${r}`);
  console.log(`✅ dist/playable-pack.zip    ${kb(zipBytes.length)}`);
  console.log('\n发 zip 给别人即可。README.md 是给他看的说明文档。');
}

main();
