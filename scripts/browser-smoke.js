// Run with playwright-cli run-code --filename=scripts/browser-smoke.js.
async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await context.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  const check = (ok, label) => { if (!ok) throw new Error(label); };
  const snapshot = () => p.evaluate(() => JSON.parse(sessionStorage.getItem('kitten-kitchen-session-v1')));
  const fits = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  try {
    await p.goto('http://127.0.0.1:5174/');
    await p.getByRole('button', { name: '食谱', exact: true }).click();
    check(await p.locator('.recipe-option').count() === 18, '18 recipes visible');
    await p.locator('[data-act="ingredients"]').first().click();
    check(await p.locator('.ingredients tbody tr').count() > 0, 'recipe ingredients visible');
    await p.getByRole('button', { name: '关闭窗口' }).click();
    await p.getByRole('textbox', { name: '今天怎么称呼你？' }).fill('检查小猫');
    await p.getByRole('button', { name: '先和猫咪陪练玩一局' }).click();
    await p.getByRole('button', { name: '换一道 ↗' }).click();
    await p.locator('[data-act="choose-recipe"][data-id="lightning-kittens"]').click();
    await p.getByRole('button', { name: '都到齐了，开锅！' }).click();
    await p.locator('[data-card]').first().click();
    check(await p.getByRole('button', { name: '打出这张' }).isDisabled(), 'Defuse is passive');
    await p.getByRole('button', { name: '取消', exact: true }).click();
    check(await fits(), 'desktop has no page overflow');
    await p.setViewportSize({ width: 390, height: 844 });
    check(await fits(), 'mobile has no page overflow');
    await p.screenshot({ path: 'output/playwright/game-mobile.png', fullPage: true });
    await p.getByRole('button', { name: '玩法', exact: true }).click();
    await p.keyboard.press('Tab');
    check(await p.evaluate(() => !!document.activeElement.closest('[role="dialog"]')), 'modal contains keyboard focus');
    await p.keyboard.press('Escape');
    check(await p.locator('[role="dialog"]').count() === 0, 'Escape closes modal');
    const before = await snapshot(); await p.reload();
    const after = await snapshot();
    check(before.me === after.me && before.game.revision === after.game.revision, 'practice reload preserves state');
    let moves = 0;
    const deadline = Date.now() + 80000;
    while (Date.now() < deadline) {
      const s = await snapshot(), g = s.game, self = g.players.find(x => x.id === s.me);
      if (g.phase === 'finished') break;
      if (g.phase === 'play' && g.turn === s.me) { await p.locator('#draw').click(); moves++; }
      else if (g.phase === 'reaction' && self.alive && !g.frames.at(-1).passed.includes(s.me)) { await p.getByRole('button', { name: '放行，继续吧' }).click(); moves++; }
      else if (g.prompt?.type === 'insert' && g.prompt.owner === s.me) {
        await p.getByRole('slider').fill('0');
        await p.screenshot({ path: 'output/playwright/defuse-mobile.png', fullPage: true });
        await p.getByRole('button', { name: '悄悄放回去' }).click(); moves++;
      }
      else await p.waitForTimeout(100);
    }
    const end = await snapshot();
    check(end.game.phase === 'finished' && !!end.game.winner, 'full practice game finishes');
    await p.screenshot({ path: 'output/playwright/finished-mobile.png', fullPage: true });
    await p.getByRole('button', { name: '再来一锅' }).click();
    check((await snapshot()).game.phase === 'lobby', 'returns to lobby');
    await p.getByRole('button', { name: '离开', exact: true }).click();
    await p.getByRole('dialog').getByRole('button', { name: '离开', exact: true }).click();
    check(await snapshot() === null, 'leaving clears session');
    await p.screenshot({ path: 'output/playwright/home-mobile.png', fullPage: true });
    check(await fits(), 'mobile home has no page overflow');
    check(errors.length === 0, errors.join('\n'));
    return { passed: true, uiActions: moves, pageErrors: errors, viewport: '390x844 / 1440x1000' };
  } finally { await context.close(); }
}
