/**
 * 统一的 Funplay Cocos MCP 端口解析 —— 端口不用再问、也不用再记。
 *
 * 扩展的 `portMode = project`（本项目就是）时，端口由**项目路径**推出来，不是随机的：
 *
 *   20000 + sha256("funplay-cocos-mcp:" + 小写、正斜杠的项目绝对路径)[0:8] % 10000
 *
 * 公式照抄 `extensions/funplay-cocos-mcp/lib/config.js` 的 `getProjectPort()`，
 * 所以本文件算出来的值和扩展实际监听的端口永远一致（本项目 = 27502）。
 *
 * ⚠️ 扩展改成 `portMode = fixed`（或设了 `COCOS_MCP_PORT`）时公式失效 ——
 * 那种情况下用 `MCP_PORT` 环境变量盖过去即可，优先级最高。
 */
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 扩展自己的默认端口（只在 portMode = fixed 且没配端口时才用得上）。 */
export const DEFAULT_PORT = 8765;

/**
 * 按项目路径算稳定端口。
 * @param {string} projectPath 项目根目录的绝对路径
 * @returns {number} 20000–29999
 */
export function projectPort(projectPath) {
  const normalized = String(projectPath).replace(/\\/g, '/');
  const key = process.platform === 'win32' ? normalized.toLowerCase() : normalized;
  const identity = createHash('sha256')
    .update(`funplay-cocos-mcp:${key}`)
    .digest('hex')
    .slice(0, 24);
  return 20000 + (parseInt(identity.slice(0, 8), 16) % 10000);
}

/** 本仓库根目录（tools/lib/ 往上两级）—— 也是扩展眼里的项目路径。 */
export function projectRoot() {
  return resolve(fileURLToPath(new URL('../..', import.meta.url)));
}

/**
 * 解析本次调用要用的端口：`MCP_PORT` > 现算 > 扩展默认值。
 * @returns {number}
 */
export function resolvePort() {
  const override = process.env.MCP_PORT;
  if (override) {
    const port = Number(override);
    if (Number.isInteger(port) && port > 0 && port <= 65535) return port;
  }
  return projectPort(projectRoot());
}

/**
 * MCP 的 HTTP 端点。
 * @param {number} [port] 不传则现算
 * @returns {string} 形如 http://127.0.0.1:27502/mcp
 */
export function endpoint(port = resolvePort()) {
  const host = process.env.MCP_HOST ?? '127.0.0.1';
  return `http://${host}:${port}/mcp`;
}
