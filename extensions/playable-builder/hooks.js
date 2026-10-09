'use strict';

const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PACK_SCRIPT = path.join(ROOT, 'tools', 'pack-playable.mjs');
const TAG = '[playable-builder] ';

/**
 * `options.buildPath` 是编辑器内部的 URL（`project://build`），不是文件系统路径。
 * 直接 join 会拼出 `.\project:\build\web-mobile` 这种相对路径（`path.join` 还会把 `//`
 * 收成 `\`），打包器一看没这个目录就当场 `exit 1` —— 五秒半的活一秒都没跑完。
 * 2026-10-09 之前这个扩展的每一次构建都栽在这儿。
 */
function resolveBuildPath(buildPath) {
  const raw = buildPath ?? 'project://build';
  return raw.startsWith('project://') ? path.join(ROOT, raw.slice('project://'.length)) : raw;
}

// 打包失败（体积超 5MB / 产物校验不过）时直接中断构建 —— 不然会得到一个
// 「构建成功」但交不出去的假象。
exports.throwError = true;

exports.onAfterBuild = function (options) {
  if (options.platform !== 'web-mobile') return;

  const buildDir = path.join(resolveBuildPath(options.buildPath), 'web-mobile');

  // 商店链接还是占位符时：debug 构建（开发期）放行，只打印警告；release 构建直接失败。
  // 堵死的是「带着 XXXX 交出去」这件事，而不是开发期每次构建。
  const args = [PACK_SCRIPT, '--build', buildDir];
  if (options.debug) args.push('--allow-placeholder');

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      // 不能用 'inherit'：那样子进程的输出写到编辑器自己的 stdout，project.log 里一个字都不留，
      // 构建一失败就只剩「退出码 1」，❌ 列表全看不见（2026-10-09 踩过）。
      // 两条流都并到 console.log —— 走 console.error 的话 Cocos 会给每一行附一段
      // 本地的 Error 堆栈，多行消息被切得没法看；失败与否看退出码就够了。
      stdio: ['ignore', 'pipe', 'pipe'],
      // process.execPath 是 CocosCreator.exe，这个环境变量让它以 node 身份跑
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    });

    for (const stream of [child.stdout, child.stderr]) {
      let buf = '';
      stream.setEncoding('utf8');
      stream.on('data', (chunk) => {
        buf += chunk;
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) console.log(TAG + line);
      });
      stream.on('end', () => { if (buf) console.log(TAG + buf); });
    }

    child.on('error', (e) => reject(new Error(`${TAG}起不了打包进程：${e.message}`)));

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`${TAG}单文件产物已生成`);
        resolve();
      } else {
        reject(new Error(`${TAG}打包失败（退出码 ${code}），看上面的 ❌ 列表`));
      }
    });
  });
};
