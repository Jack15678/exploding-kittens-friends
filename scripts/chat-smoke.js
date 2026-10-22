// Run against the currently opened local or published game URL with Playwright CLI.
async (page) => {
  const browser = page.context().browser(), contexts = [], errors = [];
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const saved = p => p.evaluate(() => JSON.parse(sessionStorage.getItem('kitten-kitchen-session-v1')));
  const connected = p => p.waitForFunction(() => document.body.dataset.connection === 'connected', null, { timeout: 50000 });
  const send = async (p, text) => {
    if (await p.locator('#room-chat-toggle').getAttribute('aria-expanded') === 'false') await p.locator('#room-chat-toggle').click();
    await p.getByRole('textbox', { name: '聊天消息' }).fill(text);
    await p.locator('.chat-send').click();
  };
  try {
    const pages = [];
    for (const mobile of [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, hasTouch: mobile, isMobile: mobile });
      contexts.push(context); await context.addInitScript(() => { window.RTCPeerConnection = class { constructor() { throw Error('WebRTC must not be used'); } }; }); const p = await context.newPage(); pages.push(p);
      p.on('pageerror', e => errors.push(e.message)); await p.goto(page.url());
      await p.getByRole('textbox', { name: '今天怎么称呼你？' }).fill(mobile ? '聊天布丁' : '聊天桃桃');
    }
    const [host, guest] = pages;
    await host.getByRole('button', { name: '开一间好友厨房' }).click(); await connected(host);
    await guest.getByRole('button', { name: '加入朋友的房间' }).click();
    await guest.getByRole('textbox', { name: '八位房间码' }).fill((await saved(host)).room);
    await guest.getByRole('button', { name: '加入', exact: true }).click(); await connected(guest);
    check(await guest.locator('.chat-panel').isHidden(), 'chat starts collapsed');
    const revision = (await saved(host)).game.revision;
    await send(host, '先别抽牌，等我一下 🐱');
    await guest.locator('.chat-peek').waitFor();
    check(await guest.locator('.chat-peek').innerText().then(x => x.includes('聊天桃桃') && x.includes('先别抽牌')), 'preview identifies sender and message');
    check(await guest.locator('.chat-panel').isHidden(), 'new message does not open the full chat');
    await guest.screenshot({ path: 'output/playwright/chat-mobile-preview.png', fullPage: true });
    await guest.locator('.chat-peek').waitFor({ state: 'hidden', timeout: 8000 });
    check(await guest.locator('.chat-unread').innerText() === '1', 'unread badge remains after preview disappears');
    await send(host, '<b>这只是普通文字</b>');
    await guest.locator('.chat-peek').waitFor(); await guest.locator('.chat-peek').click();
    check(await guest.locator('.chat-unread').isHidden(), 'opening chat clears unread count');
    check(await guest.locator('.chat-log b').count() === 0, 'message markup renders as plain text');
    check((await saved(host)).game.revision === revision, 'chat does not advance game revision');
    const draft = guest.getByRole('textbox', { name: '聊天消息' });
    await draft.fill('我的草稿还没写完');
    const originalInput = await draft.elementHandle();
    await draft.evaluate(el => el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
    await send(host, '慢慢写，我们等你');
    await guest.locator('.chat-log').getByText('慢慢写，我们等你', { exact: true }).waitFor();
    check(await originalInput.evaluate(el => el.isConnected), 'incoming chat preserves the input element');
    check(await draft.inputValue() === '我的草稿还没写完', 'incoming chat preserves the draft');
    await draft.focus(); await guest.keyboard.press('Enter');
    check((await saved(guest)).chat.length === 3, 'IME confirmation does not send unfinished text');
    await host.getByRole('button', { name: '收起聊天', exact: true }).click();
    await host.getByRole('button', { name: '都到齐了，开锅！' }).click();
    await guest.locator('.hand').waitFor();
    check(await originalInput.evaluate(el => el.isConnected), 'game updates preserve the composing input element');
    check(await draft.inputValue() === '我的草稿还没写完', 'game updates preserve the draft');
    await draft.evaluate(el => el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
    await draft.focus(); await guest.keyboard.press('Enter');
    await host.locator('.chat-peek').waitFor();
    await host.screenshot({ path: 'output/playwright/chat-desktop-preview.png', fullPage: true });
    await guest.screenshot({ path: 'output/playwright/chat-mobile-open.png', fullPage: true });
    check(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile chat fits the viewport');
    await host.locator('#draw').click();
    await guest.getByRole('button', { name: '放行，继续吧' }).waitFor();
    const frame = (await saved(guest)).view.reaction.id;
    await send(guest, '这张放行啦');
    await host.locator('.chat-peek-text').getByText('这张放行啦', { exact: true }).waitFor();
    check((await saved(guest)).view.reaction.id === frame, 'chat preserves the active reaction window');
    await guest.getByRole('button', { name: '收起聊天', exact: true }).click();
    await guest.getByRole('button', { name: '放行，继续吧' }).click();
    const chat = (await saved(guest)).chat;
    await guest.reload(); await connected(guest);
    check(JSON.stringify((await saved(guest)).chat) === JSON.stringify(chat), 'guest refresh restores chat');
    check(await guest.locator('.chat-peek').isHidden(), 'history does not replay as new messages');
    await host.reload(); await connected(host);
    await host.waitForFunction(() => JSON.parse(sessionStorage.getItem('kitten-kitchen-session-v1')).game.players.every(p => p.online));
    check(JSON.stringify((await saved(host)).chat) === JSON.stringify(chat), 'host refresh restores chat');
    await host.locator('#room-chat-toggle').click();
    await host.screenshot({ path: 'output/playwright/chat-desktop-open.png', fullPage: true });
    await host.getByRole('button', { name: '离开', exact: true }).click();
    check(await host.locator('#room-chat').isHidden(), 'game modal hides the chat overlay');
    await host.getByRole('button', { name: '关闭厨房', exact: true }).click();
    await guest.waitForFunction(() => document.body.dataset.phase === 'home');
    check(await guest.locator('#room-chat').isHidden(), 'leaving clears the chat UI');
    check(await saved(guest) === null, 'leaving clears chat storage');
    check(errors.length === 0, errors.join('\n'));
    return { passed: true, realRelay: true, peers: 2, messages: chat.length, autoCollapse: true, draftAndIME: true, refresh: true, pageErrors: errors };
  } finally { for (const context of contexts) await context.close(); }
}
