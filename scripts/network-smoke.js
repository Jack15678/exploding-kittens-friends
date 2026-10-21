// Real public PeerJS/WebRTC, three isolated browser contexts; no mocked transport.
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
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); contexts.push(ctx);
      const p = await ctx.newPage(); pages.push(p); p.on('pageerror', e => errors.push(e.message));
      await p.goto('http://127.0.0.1:5174/');
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
    await pages[1].screenshot({ path: 'output/playwright/network-guest.png', fullPage: true });
    const ids = await Promise.all(pages.map(async p => (await saved(p)).me));
    let actions = 0;
    for (let step = 0; step < 120; step++) {
      const s = await sync(), g = s.game;
      if (g.phase === 'finished') break;
      if (g.phase === 'play') { await pages[ids.indexOf(g.turn)].locator('#draw').click(); actions++; }
      else if (g.phase === 'reaction') {
        const actors = ids.map((id, i) => ({ id, i })).filter(x => g.players.find(p => p.id === x.id).alive && !g.frames.at(-1).passed.includes(x.id));
        await Promise.all(actors.map(x => pages[x.i].getByRole('button', { name: '放行，继续吧' }).click())); actions += actors.length;
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
    return { passed: true, realWebRTC: true, peers: 3, actions, guestReload: true, hostReload: true, secretHands: true, winner: finish.game.winner, pageErrors: errors };
  } finally { for (const ctx of contexts) await ctx.close(); }
}
