// Real WebSocket relay, three isolated browsers, mobile host; WebRTC is disabled.
async (page) => {
  const browser = page.context().browser(), contexts = [], pages = [], errors = [];
  const check = (ok, label) => { if (!ok) throw new Error(label); };
  const saved = p => p.evaluate(() => JSON.parse(sessionStorage.getItem('kitten-kitchen-session-v1')));
  const connected = p => p.waitForFunction(() => document.body.dataset.connection === 'connected', null, { timeout: 40000 });
  const sync = async () => {
    const host = await saved(pages[0]);
    for (const p of pages.slice(1)) await p.waitForFunction(rev => JSON.parse(sessionStorage.getItem('kitten-kitchen-session-v1'))?.view?.revision === rev, host.game.revision, { timeout: 10000 });
    return host;
  };
  try {
    for (let i = 0; i < 3; i++) {
      const ctx = await browser.newContext({ viewport: i === 0 ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: i === 0, hasTouch: i === 0 }); contexts.push(ctx);
      await ctx.addInitScript(() => { window.RTCPeerConnection = class { constructor() { throw Error('WebRTC must not be used'); } }; });
      const p = await ctx.newPage(); pages.push(p); p.on('pageerror', e => errors.push(e.message));
      await p.goto(page.url());
      await p.getByRole('textbox', { name: '今天怎么称呼你？' }).fill(['房主桃桃', '朋友布丁', '朋友团子'][i]);
    }
    await pages[0].getByRole('button', { name: '开一间好友厨房' }).click(); await connected(pages[0]);
    const code = (await saved(pages[0])).room;
    for (const p of pages.slice(1)) {
      await p.getByRole('button', { name: '加入朋友的房间' }).click();
      await p.getByRole('textbox', { name: '八位房间码' }).fill(code);
      await p.getByRole('button', { name: '加入', exact: true }).click(); await connected(p);
    }
    await sync();
    check((await saved(pages[0])).game.players.length === 3, 'three real peers joined');
    await pages[0].getByRole('button', { name: '换一道 ↗' }).click();
    await pages[0].locator('[data-act="choose-recipe"][data-id="lightning-kittens"]').click();
    await pages[0].getByRole('button', { name: '都到齐了，开锅！' }).click(); await sync();
    const original = await saved(pages[1]);
    await pages[1].reload(); await connected(pages[1]); await sync();
    const restored = await saved(pages[1]);
    check(original.me === restored.me, 'guest reconnects to same seat');
    check(JSON.stringify(original.view.players.find(x => x.id === original.me).hand) === JSON.stringify(restored.view.players.find(x => x.id === restored.me).hand), 'guest hand restored');
    const hostBefore = await saved(pages[0]);
    await pages[0].reload(); await connected(pages[0]);
    await pages[0].waitForFunction(() => JSON.parse(sessionStorage.getItem('kitten-kitchen-session-v1')).game.players.every(x => x.online), null, { timeout: 40000 });
    await sync();
    check(JSON.stringify((await saved(pages[0])).game.deck) === JSON.stringify(hostBefore.game.deck), 'host reload preserves deck');
    const guestViews = await Promise.all(pages.slice(1).map(saved));
    for (const s of guestViews) {
      check(!s.game && !s.view.deck && !s.view.frames && !s.view.retired, 'no host state sent to guest');
      check(s.view.players.filter(x => x.hand).length === 1 && !!s.view.players.find(x => x.id === s.me).hand, 'only own hand in guest storage');
    }
    await pages[0].locator('#draw').click(); await sync();
    const deckBeforeOffline = (await saved(pages[0])).game.deck.length;
    await contexts[1].setOffline(true);
    await pages[0].waitForFunction(() => JSON.parse(sessionStorage.getItem('kitten-kitchen-session-v1')).game.players.some(p => !p.online), null, { timeout: 65000 });
    await pages[0].waitForTimeout(10500);
    check((await saved(pages[0])).game.deck.length === deckBeforeOffline, 'offline guest pauses automatic passing');
    await contexts[1].setOffline(false); await connected(pages[1]); await sync();
    await pages[0].screenshot({ path: 'output/playwright/relay-mobile-host.png', fullPage: true });
    await pages[1].screenshot({ path: 'output/playwright/network-guest.png', fullPage: true });
    const ids = await Promise.all(pages.map(async p => (await saved(p)).me));
    let actions = 0, automaticReactions = 0;
    for (let step = 0; step < 120; step++) {
      const s = await sync(), g = s.game;
      if (g.phase === 'finished') break;
      if (g.phase === 'play') { await pages[ids.indexOf(g.turn)].locator('#draw').click(); actions++; }
      else if (g.phase === 'reaction') {
        const actors = ids.map((id, i) => ({ id, i })).filter(x => g.players.find(p => p.id === x.id).alive && !g.frames.at(-1).passed.includes(x.id));
        const clicks = await Promise.allSettled(actors.map(x => pages[x.i].getByRole('button', { name: '放行，继续吧' }).click({ timeout: 12000 })));
        const after = (await saved(pages[0])).game;
        for (const [i, result] of clicks.entries()) {
          if (result.status === 'fulfilled') actions++;
          // Public-network delivery and DOM updates can outlast the response window.
          // A vanished pass button is expected only if that action already settled.
          else if (after.phase === 'reaction' && after.frames.at(-1).id === g.frames.at(-1).id && !after.frames.at(-1).passed.includes(actors[i].id)) throw result.reason;
        }
        if (clicks.some(x => x.status === 'rejected')) automaticReactions++;
      } else if (g.prompt?.type === 'insert') {
        const actor = pages[ids.indexOf(g.prompt.owner)];
        for (const p of pages.slice(1)) { const v = (await saved(p)).view; if (v.me !== g.prompt.owner) check(v.prompt.type === 'waiting' && !v.prompt.card, 'insertion hidden from other guests'); }
        await actor.getByRole('slider').fill('0'); await actor.getByRole('button', { name: '悄悄放回去' }).click(); actions++;
      } else throw new Error(`Unexpected phase ${g.phase}`);
      await pages[0].waitForFunction(revision => JSON.parse(sessionStorage.getItem('kitten-kitchen-session-v1')).game.revision > revision, g.revision);
    }
    const finish = await sync(); check(finish.game.phase === 'finished', 'network game reaches winner');
    check(errors.length === 0, errors.join('\n'));
    await pages[0].getByRole('button', { name: '离开', exact: true }).click();
    await pages[0].getByRole('button', { name: '关闭厨房', exact: true }).click();
    for (const p of pages.slice(1)) await p.waitForFunction(() => document.body.dataset.phase === 'home');
    return { passed: true, realRelay: true, webRTCDisabled: true, mobileHost: true, peers: 3, actions, automaticReactions, guestReload: true, hostReload: true, offlinePause: true, secretHands: true, winner: finish.game.winner, pageErrors: errors };
  } finally { for (const ctx of contexts) await ctx.close(); }
}
