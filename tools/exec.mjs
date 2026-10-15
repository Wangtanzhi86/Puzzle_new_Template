#!/usr/bin/env node
/**
 * tools/exec.mjs <scene|editor> <script.js> [argsJson] [--no-save]
 *
 * 包装 Funplay MCP 的 `execute_javascript`，在编辑器里跑一段脚本。
 * 脚本写成文件再读进来，避免命令行转义把引号/换行/中文搞坏。
 *
 * 返回信封统一：scene 上下文取 data.result，editor 上下文取 data。
 *
 * scene 上下文跑完自动补一次 editor 上下文的 save-scene —— 在 scene 上下文里
 * 直接调 save-scene 返回 false、文件不落盘（改动只在编辑器内存里）。只读探针加 --no-save。
 *
 * 退出码：0 = 跑完，1 = MCP 报错或连不上。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { endpoint, resolvePort } from './lib/cocos-port.mjs';

// 端口默认现算（按项目路径，稳定值），不再硬编码；MCP_PORT 仍可覆盖。
const ENDPOINT = endpoint();

const argv = process.argv.slice(2);
const noSave = argv.includes('--no-save');
const [context, scriptPath, argsJson] = argv.filter((a) => a !== '--no-save');

if (!context || !scriptPath) {
  console.error('用法: node tools/exec.mjs <scene|editor> <script.js> [argsJson] [--no-save]');
  process.exit(1);
}
if (context !== 'scene' && context !== 'editor') {
  console.error(`上下文只能是 scene 或 editor，收到 "${context}"`);
  process.exit(1);
}

const code = readFileSync(resolve(scriptPath), 'utf8');
let args;
if (argsJson) {
  try { args = JSON.parse(argsJson); } catch (e) {
    console.error(`argsJson 不是合法 JSON: ${e.message}`);
    process.exit(1);
  }
}

async function run(ctx, src, scriptArgs) {
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'tools/call',
        params: {
          name: 'execute_javascript',
          arguments: { context: ctx, code: src, ...(scriptArgs ? { args: scriptArgs } : {}) },
        },
      }),
    });
  } catch (e) {
    console.error(`连不上 MCP (${ENDPOINT})：${e.message}`);
    console.error('确认编辑器开着，且 Funplay Cocos MCP 扩展已启动。');
    console.error(`提示：端口是按项目路径现算的（现在 ${resolvePort()}）；`);
    console.error('扩展若改成固定端口 / 设了 COCOS_MCP_PORT，用 MCP_PORT=<端口> 覆盖。');
    process.exit(1);
  }

  const text = await res.text();
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${text.slice(0, 2000)}`);
    process.exit(1);
  }

  // 服务端可能回 SSE（`data: {...}` 行）也可能回裸 JSON，两种都认
  let payload = text;
  const sse = text.split('\n').find((l) => l.startsWith('data:'));
  if (sse) payload = sse.slice(5).trim();

  let json;
  try { json = JSON.parse(payload); } catch {
    console.error(`返回不是 JSON：${text.slice(0, 2000)}`);
    process.exit(1);
  }
  if (json.error) {
    console.error(`MCP 错误：${JSON.stringify(json.error, null, 2)}`);
    process.exit(1);
  }

  let out = json.result;
  const content = out?.content;
  if (Array.isArray(content)) {
    const first = content.find((c) => c.type === 'text');
    if (first) {
      try { out = JSON.parse(first.text); } catch { out = first.text; }
    }
  }

  if (out && typeof out === 'object') {
    if (out.ok === false) {
      console.error(`脚本执行失败：${out.summary ?? ''}`);
      console.error(JSON.stringify(out.data ?? out, null, 2));
      process.exit(1);
    }
    if ('result' in out) return out.result;
    if ('data' in out) return out.data;
  }
  return out;
}

const value = await run(context, code, args);

if (context === 'scene' && !noSave) {
  const saved = await run('editor', "return (async () => Editor.Message.request('scene', 'save-scene'))();");
  const failed = saved === false || saved === null || saved === undefined;
  console.error(failed
    ? `⚠️ 场景没存上（save-scene 返回 ${JSON.stringify(saved)}）`
    : `场景已存盘（${saved}）`);
}

console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
