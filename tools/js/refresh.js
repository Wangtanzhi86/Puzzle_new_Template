// 让编辑器重新导入 / 重编：原来只刷单个文件，改一次脚本要手改一次路径，改成刷整个目录。
// 在 editor 上下文跑（tools/exec.mjs editor tools/js/refresh.js [argsJson]）。
// 默认刷 scripts（改完 .ts 让编辑器重编）；传 `{"path":"db://assets/recourses/UI及背景"}` 刷别的目录（新图导入）。
return (async () => {
  const dbUrl = (args && args.path) || 'db://assets/scripts';
  const a = await Editor.Message.request('asset-db', 'refresh-asset', dbUrl);
  return { path: dbUrl, ok: !!a };
})();
