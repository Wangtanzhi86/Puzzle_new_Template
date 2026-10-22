return (async () => {
  const scene = cc.director.getScene();
  const bg = scene.getChildByPath('Canvas/GameLayer/Scene_BG');
  if (!bg) return { ok: false, error: 'Scene_BG 不存在' };
  const swaps = bg.getComponents('SlotSwap');
  const out = [];
  for (const s of swaps) {
    const name = s.watch && s.watch.node ? s.watch.node.name : '';
    if (name === 'Slot_02') {
      s.waitShown = true;
      s.delay = 0;
    } else if (name === 'Slot_03') {
      s.waitBubble = 2;
      s.delay = 0;
    }
    out.push({
      watch: name || null,
      waitShown: s.waitShown,
      waitBubble: s.waitBubble,
      delay: s.delay,
      fadeTime: s.fadeTime,
    });
  }
  return { ok: true, swaps: out };
})();