// Two isolated real PeerJS/WebRTC clients; run against the currently opened game URL.
async (page) => {
  const contexts = [], errors = [];
  const check = (ok, label) => { if (!ok) throw Error(label); };
  const saved = p => p.evaluate(() => JSON.parse(sessionStorage.getItem('kitten-kitchen-session-v1')));
  const connected = p => p.waitForFunction(() => document.body.dataset.connection === 'connected', null, { timeout: 50000 });
  try {
    const pages = [];
    for (const mobile of [false, true]) {
      const context = await page.context().browser().newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: mobile, hasTouch: mobile });
      contexts.push(context); const p = await context.newPage(); pages.push(p);
      p.on('pageerror', e => errors.push(e.message)); await p.goto(page.url());
      await p.getByRole('textbox', { name: '今天怎么称呼你？' }).fill(mobile ? '响应布丁' : '响应桃桃');
    }
    const [host, guest] = pages;
    await host.getByRole('button', { name: '开一间好友厨房' }).click(); await connected(host);
    await guest.getByRole('button', { name: '加入朋友的房间' }).click();
    await guest.getByRole('textbox', { name: '八位房间码' }).fill((await saved(host)).room);
    await guest.getByRole('button', { name: '加入', exact: true }).click(); await connected(guest);
    await host.getByRole('button', { name: '都到齐了，开锅！' }).click(); await guest.locator('.hand').waitFor();
    const count = (await saved(host)).game.deck.length;
    await host.locator('#draw').click(); await guest.locator('#reaction-countdown').waitFor();
    check(/10 秒/.test(await guest.locator('#reaction-countdown').innerText()), 'guest sees a 10-second countdown');
    await guest.getByRole('button', { name: '玩法', exact: true }).click();
    const hand = await guest.locator('.hand').elementHandle();
    await guest.waitForFunction(() => /[1-8] 秒/.test(document.querySelector('#reaction-countdown')?.textContent));
    check(await hand.evaluate(el => el.isConnected), 'countdown ticks do not rebuild the cards');
    check(await guest.getByRole('dialog').count() === 1, 'opening details does not stop the countdown');
    await guest.keyboard.press('Escape');
    await guest.screenshot({ path: 'output/playwright/fixes-mobile-countdown.png', fullPage: true });
    await host.waitForFunction(n => JSON.parse(sessionStorage.getItem('kitten-kitchen-session-v1')).game.deck.length === n - 1, count, { timeout: 12000 });
    const after = await saved(host);
    check(after.game.phase !== 'reaction', 'host automatically settles without a guest click');
    await guest.waitForFunction(() => JSON.parse(sessionStorage.getItem('kitten-kitchen-session-v1')).view.phase !== 'reaction');
    check(!(await saved(guest)).game && (await saved(guest)).view.players.filter(p => p.hand).length === 1, 'guest secrets stay filtered');
    await host.getByRole('button', { name: '离开', exact: true }).click();
    await host.getByRole('button', { name: '关闭厨房', exact: true }).click();
    await guest.waitForFunction(() => document.body.dataset.phase === 'home');
    check(!errors.length, errors.join('\n'));
    return { passed: true, realWebRTC: true, autoPass: true, stableCountdownDOM: true, pageErrors: errors };
  } finally { for (const context of contexts) await context.close(); }
}
