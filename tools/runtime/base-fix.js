/*
 * 塞在产物 <head> 最前面的一小段：文档地址是「不透明来源」时补一个层级式的 <base>。
 *
 * <iframe srcdoc> / blob: / about:blank（Android 的 loadDataWithBaseURL(null,…)）
 * 这类预览容器里文档地址不透明，而拿不透明地址当 base 解析相对地址按规范必然失败：
 *   new URL('assets/x.wasm', 'about:cocos-js/_virtual_cc-xxx.js')
 *   → TypeError: Failed to construct 'URL': Invalid URL
 * SystemJS 在这种文档里算出来的模块地址就长这样，所以这个失败是必然的。
 * 引擎里唯一做「相对地址 + import.meta.url」的是加载骨架 wasm 那句，而它外面是个
 * 吞掉的空 catch —— promise 永远不 settle，表现成「游戏一切正常，只有 Spine 没了」。
 *
 * 补 base 之后相对解析重新有了路径，那个地址就能落到查表里。
 * 只在地址不透明时才插：正常 http(s):// / file:// 打开的产物一个字节都不动，
 * 否则会把「包里没有、退回真网络」的兜底路带到假域名上去。
 *
 * 必须排在 src/system.bundle.js 之前 —— SystemJS 的 base 是它执行那一刻读的
 * （document.querySelector("base[href]")，读了就不再改），而它被内联在 body 开头。
 *
 * __FAKE_BASE__ 用 .invalid 顶级域（RFC 2606 留给「永远不解析」），
 * 万一真有人拿它发网络请求也必定当场失败，而不是打到某个真实站点上。
 */
(function () {
  var href = '';
  try { href = String(location.href); } catch (e) {}
  if (!/^(about|blob|data):/i.test(href)) return;
  var head = document.head || document.getElementsByTagName('head')[0];
  if (!head) return;
  var b = document.createElement('base');
  b.href = '__FAKE_BASE__';
  head.insertBefore(b, head.firstChild);
})();
