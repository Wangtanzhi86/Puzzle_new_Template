#!/usr/bin/env node
/**
 * tools/mcp.mjs <toolName> [argsJson]
 *
 * 调任意一个 Funplay MCP 工具，打印 result 的 text 内容。
 * execute_javascript 请用 tools/exec.mjs（它会处理场景存盘和返回信封）。
 */
const HOST = process.env.MCP_HOST ?? '127.0.0.1';
const PORT = process.env.MCP_PORT ?? '20168';

const [name, argsJson] = process.argv.slice(2);
if (!name) {
  console.error('用法: node tools/mcp.mjs <toolName> [argsJson]');
  process.exit(1);
}

const res = await fetch(`http://${HOST}:${PORT}/mcp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name, arguments: argsJson ? JSON.parse(argsJson) : {} },
  }),
});

const text = await res.text();
let payload = text;
const sse = text.split('\n').find((l) => l.startsWith('data:'));
if (sse) payload = sse.slice(5).trim();

let json;
try { json = JSON.parse(payload); } catch {
  console.error('返回不是 JSON：' + text.slice(0, 2000));
  process.exit(1);
}
if (json.error) {
  console.error('MCP 错误：' + JSON.stringify(json.error, null, 2));
  process.exit(1);
}

const content = json.result?.content;
const first = Array.isArray(content) ? content.find((c) => c.type === 'text') : null;
console.log(first ? first.text : JSON.stringify(json.result, null, 2));
