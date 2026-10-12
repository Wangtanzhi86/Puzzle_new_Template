/**
 * 把每一格的那个「num」数字标签接进 `PieceSlot.hideWithBroken`：这一格修好、破损图收掉的
 * 同时，数字也跟着收（不然数字会留在修复后的图上）。
 *
 *   node tools/exec.mjs scene tools/js/mount-slot-num-hide.js
 *
 * 幂等：已经填好、且填的就是自己名下那个 num 的槽位原样保留。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const brokenLayer = canvas.getChildByPath('GameLayer/BrokenLayer');

const wired = [];
const kept = [];
const noNum = [];
for (const child of brokenLayer.children) {
  const slot = child.getComponent('PieceSlot');
  if (!slot) continue;
  if (slot.hideWithBroken && slot.hideWithBroken.parent === child) {
    kept.push(child.name);
    continue;
  }
  const num = child.getChildByName('num');
  if (!num) {
    noNum.push(child.name);
    continue;
  }
  slot.hideWithBroken = num;
  wired.push(child.name + ' -> ' + num.name);
}

return { wired, kept, noNum };
