// 改完 .ts 让编辑器重编：原来只刷单个文件，改一次脚本要手改一次路径，改成刷整个 scripts 目录。
// 在 editor 上下文跑（tools/exec.mjs editor tools/js/refresh.js）。
return (async () => {
  const a = await Editor.Message.request('asset-db', 'refresh-asset', 'db://assets/scripts');
  return { scripts: !!a };
})();
