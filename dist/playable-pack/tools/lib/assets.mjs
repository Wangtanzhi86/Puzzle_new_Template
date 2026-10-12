// 读构建产物 + 无损压缩。只读不写，构建目录一个字节都不动。
import fs from 'node:fs';
import path from 'node:path';

/** 构建目录里非有不可的东西。Creator 会先清空目录再往回写，「构建完但还没写完」
 *  这个中间状态是能被打包命中的：产物看着正常、体积小一截，却起不来。 */
const MUST_HAVE = [
  'src/polyfills.bundle.js',
  'src/system.bundle.js',
  'src/import-map.json',
  'src/settings.json',
  'cocos-js/cc.js',
  'assets/main/config.json',
];

export function assertComplete(buildDir) {
  const missing = MUST_HAVE.filter((rel) => !fs.existsSync(path.join(buildDir, rel)));
  if (missing.length) {
    throw new Error(
      `构建目录不完整，少了：${missing.join('、')}\n` +
      '  多半是 Creator 正在构建（它会先清空目录再往回写）。等构建跑完再打包一次。',
    );
  }
}

/** index.html 不用（我们自己生成），其余全读进来 */
export function readBuild(buildDir) {
  const out = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else {
        const rel = path.relative(buildDir, full).split(path.sep).join('/');
        if (rel === 'index.html') continue;
        out.push({ rel, data: fs.readFileSync(full) });
      }
    }
  })(buildDir);
  return out;
}

/**
 * PNG → 无损 WebP，逐张比，只赢才换（噪点重的图 WebP 反而更大）。
 * 浏览器按魔数识图不看扩展名，URL 依然是 .png，引擎察觉不到；
 * import json 里的宽高不变，连元数据都不用改。
 * 没装 @jsquash 就跳过，不阻塞打包。
 */
export async function toWebp(files) {
  let decodePng, encodeWebp;
  try {
    // @jsquash 用 fetch 拉同目录的 wasm，而 Node 的 fetch 不认 file:，先垫一层
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input && input.url) || String(input);
      if (url.startsWith('file://')) {
        return new Response(fs.readFileSync(new URL(url)), { headers: { 'content-type': 'application/wasm' } });
      }
      return origFetch(input, init);
    };
    ({ decode: decodePng } = await import('@jsquash/png'));
    ({ encode: encodeWebp } = await import('@jsquash/webp'));
  } catch {
    console.log('  ⚠ 没装 @jsquash/webp，跳过 WebP（产物会大约 1MB）');
    console.log('    要装的话：npm i -D @jsquash/webp @jsquash/png');
    return { converted: 0, saved: 0, skipped: true };
  }

  let converted = 0, saved = 0;
  for (const f of files) {
    if (!/\.png$/i.test(f.rel)) continue;
    const png = f.data;
    try {
      const ab = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength);
      const img = await decodePng(ab);
      let best = null;
      for (const method of [6, 4]) {
        const out = Buffer.from(await encodeWebp(img, { lossless: 1, method, exact: 1 }));
        if (!best || out.length < best.length) best = out;
      }
      if (best.length < png.length) {
        saved += png.length - best.length;
        f.data = best;
        converted++;
      }
    } catch (e) {
      console.log('  ⚠ 这张转不了，保留原 PNG：' + f.rel + ' (' + e.message + ')');
    }
  }
  return { converted, saved, skipped: false };
}
