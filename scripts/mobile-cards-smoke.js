// Layout fixtures only; run against the local Vite server with Playwright CLI.
async (page) => {
  const check = (ok, label) => { if (!ok) throw Error(label); };
  const errors = [], results = [];
  const seed = await page.evaluate(async () => {
    const { createGame, addPlayer, act } = await import('/src/game.js');
    let game = createGame('layout-host', '手机小猫');
    addPlayer(game, 'layout-bot', '陪练小猫', true);
    game = act(game, 'layout-host', { type: 'start' });
    game.discard = [{ id: 'played', type: 'catomic' }];
    return { version: 1, role: 'practice', me: 'layout-host', room: '', identities: {}, game };
  });
  for (const [width, height, touch] of [[320, 740, true], [390, 844, true], [844, 390, true], [1440, 1000, false]]) {
    const context = await page.context().browser().newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch });
    try {
      const p = await context.newPage(); p.on('pageerror', e => errors.push(e.message));
      await p.goto(page.url());
      for (const count of touch ? [8, 9, 24] : [9]) {
        const fixture = structuredClone(seed);
        const types = ['defuse', 'nope', 'nope', 'see3', 'see3', 'taco', 'taco', 'beard', 'feral'];
        fixture.game.players[0].hand = Array.from({ length: count }, (_, i) => ({ id: `touch-${i}`, type: types[i % types.length] }));
        // Let pagehide save the previous game before installing the next layout fixture.
        await p.goto(new URL('favicon.svg', page.url()).href);
        await p.evaluate(s => sessionStorage.setItem('kitten-kitchen-session-v1', JSON.stringify(s)), fixture);
        await p.goto(page.url()); await p.locator('.hand').waitFor();
        const actual = await p.locator('[data-card]').count();
        check(actual === count, `${width}px: expected ${count} cards, got ${actual}`);
        check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
        if (touch) {
          const overlaps = await p.locator('.hand [data-card]').evaluateAll(cards => {
            const boxes = cards.map(c => c.getBoundingClientRect());
            return boxes.some((a, i) => boxes.slice(i + 1).some(b => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom));
          });
          check(!overlaps, `${width}px: card faces never overlap`);
          for (let i = 0; i < count; i++) {
            const card = p.locator(`[data-card="touch-${i}"]`);
            await card.tap(); check(await card.getAttribute('aria-pressed') === 'true', `tap selects card ${i}`);
            await card.tap(); check(await card.getAttribute('aria-pressed') === 'false', `tap deselects card ${i}`);
          }
          await p.locator('[data-card="touch-5"]').tap(); await p.locator('[data-card="touch-6"]').tap();
          check(await p.getByRole('button', { name: '使用组合' }).isEnabled(), 'matching-cat combo remains selectable');
          check(await p.locator('.hand [aria-pressed="true"]').count() === 2, 'both combo cards selected');
          check((await p.evaluate(() => JSON.parse(sessionStorage.getItem('kitten-kitchen-session-v1')))).game.revision === seed.game.revision, 'tapping never plays a card');
        } else {
          const first = p.locator('[data-card="touch-0"]');
          const before = await first.boundingBox(); await first.hover(); await p.waitForTimeout(250);
          const after = await first.boundingBox(); check(after.y < before.y, 'desktop hover still lifts the fan');
        }
        if (width === 390 && count === 9) await p.screenshot({ path: 'output/playwright/fixes-mobile-hand.png', fullPage: true, animations: 'disabled' });
        results.push({ width, touch, count, passed: true });
      }
      await p.getByRole('button', { name: '查看猫原子弹完整说明' }).click();
      const expected = await p.evaluate(async () => (await import('/src/cards.js')).CARDS.catomic.text);
      check(await p.locator('.card-detail .card-caption').innerText() === expected, 'complete played-card rules are shown');
      check(await p.locator('.card-detail .card-caption').evaluate(el => el.scrollHeight <= el.clientHeight), 'detail text is not clipped');
      if (width === 390) await p.screenshot({ path: 'output/playwright/fixes-mobile-detail.png', animations: 'disabled' });
      await p.keyboard.press('Escape'); check(await p.getByRole('dialog').count() === 0, 'card detail closes');
      if (width === 390) {
        const reaction = await p.evaluate(async s => {
          const { act } = await import('/src/game.js');
          s.game.players[0].hand = [{ id: 'played-action', type: 'catomic' }];
          s.game.players[1].hand = [{ id: 'played-nope', type: 'nope' }];
          s.game.players[1].bot = false;
          s.game = act(s.game, s.me, { type: 'play', cardId: 'played-action' });
          s.game = act(s.game, 'layout-bot', { type: 'play', cardId: 'played-nope' });
          return s;
        }, structuredClone(seed));
        await p.goto(new URL('favicon.svg', page.url()).href);
        await p.evaluate(s => sessionStorage.setItem('kitten-kitchen-session-v1', JSON.stringify(s)), reaction);
        await p.goto(page.url());
        await p.getByRole('button', { name: '查看这张牌', exact: true }).click();
        check(await p.locator('#dialog-title').innerText() === '猫原子弹', 'original action remains inspectable beneath a Nope');
        await p.getByRole('button', { name: '关闭窗口' }).click();
        await p.getByRole('button', { name: '查看才不要！完整说明' }).click();
        check(await p.locator('#dialog-title').innerText() === '才不要！', 'top Nope is separately inspectable');
      }
    } finally { await context.close(); }
  }
  check(!errors.length, errors.join('\n'));
  return { passed: true, results, pageErrors: errors };
}
