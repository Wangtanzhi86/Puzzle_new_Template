// 载荷编码：base85 / base64 + gzip 容器。容器 = u32le 头长度 + JSON 头 + 拼接字节体，
// 解出来是零拷贝切分，文件内容不会被二次编码。

// 4 字节 → 5 字符。字母表取 0x21~0x7E 的 94 个可打印 ASCII 去掉 9 个，剩下正好 85。
// 去掉的都是为了塞进 HTML 里不用转义：< > 会和 </script 冲突，& 会被当实体，
// " ' ` $ 给将来放进 JS 字符串留余地，\ % 是转义符和格式化符。
// 表里没有空白字符，所以解码时能无歧义地跳过换行。
const ALPHABET = (() => {
  const drop = new Set(['<', '&', '"', "'", '\\', '`', '$', '>', '%']);
  let s = '';
  for (let c = 0x21; c <= 0x7e; c++) {
    const ch = String.fromCharCode(c);
    if (!drop.has(ch)) s += ch;
  }
  if (s.length !== 85) throw new Error('base85 字母表不是 85 个，而是 ' + s.length);
  return s;
})();

export function encodeBase85(buf) {
  const parts = [];
  const chunk = new Array(5);
  for (let i = 0; i < buf.length; i += 4) {
    const v = (buf[i] * 0x1000000 + ((buf[i + 1] || 0) << 16) + ((buf[i + 2] || 0) << 8) + (buf[i + 3] || 0)) >>> 0;
    let x = v;
    for (let j = 4; j >= 0; j--) { chunk[j] = ALPHABET[x % 85]; x = Math.floor(x / 85); }
    parts.push(chunk.join(''));
  }
  return parts.join('');
}

export function encodeBase64(buf) {
  return buf.toString('base64');
}

/** 只给打包期自检用，和运行时那段是同一套算法 */
function decodeBase85(str) {
  const rev = new Int16Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) rev[ALPHABET.charCodeAt(i)] = i;
  const n = Math.floor(str.length / 5);
  const out = Buffer.alloc(n * 4);
  let p = 0;
  for (let g = 0; g < n; g++) {
    let v = 0;
    const base = g * 5;
    for (let j = 0; j < 5; j++) v = v * 85 + rev[str.charCodeAt(base + j)];
    out.writeUInt32BE(v >>> 0, p);
    p += 4;
  }
  return out;
}

/**
 * 自检：解回来的必须和 gzip 字节完全一致，多出来的只能是不超过 3 个的补齐字节。
 * 这一步非做不可 —— 拿「Node 能 gunzip 成功」当验证是不行的，Node 比浏览器宽容，
 * 会放过末尾的补齐字节，一直到浏览器里才炸。校验要按严格的那一方来。
 */
export function checkPayload(encoded, gz, isBase64) {
  const back = isBase64 ? Buffer.from(encoded, 'base64') : decodeBase85(encoded);
  const pad = back.length - gz.length;
  if (pad < 0 || pad > 3 || !back.subarray(0, gz.length).equals(gz)) {
    throw new Error(
      `载荷自检没过：gzip ${gz.length} 字节，解回来 ${back.length} 字节（多出 ${pad}），内容对不上`,
    );
  }
  return pad;
}

export function buildContainer(files) {
  const entries = [];
  const bodies = [];
  let offset = 0;
  for (const f of files) {
    entries.push([f.rel, offset, f.data.length]);
    bodies.push(f.data);
    offset += f.data.length;
  }
  const headerJson = Buffer.from(JSON.stringify(entries), 'utf8');
  const head = Buffer.alloc(4);
  head.writeUInt32LE(headerJson.length, 0);
  return Buffer.concat([head, headerJson, ...bodies]);
}

export { ALPHABET };
