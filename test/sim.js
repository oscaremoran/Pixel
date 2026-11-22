// Headless regression test: plays every level start to finish and checks the game's invariants.
// Run with: sh test/run.sh
let failures = 0;
function check(ok, what) {
  print((ok ? '  ok   ' : '  FAIL ') + what);
  if (!ok) failures++;
}

ensureAudio();
const FPS = 60;

// Play a level at 60 fps. The player is invincible and wanders in a figure-8 so aimed attacks vary.
// Returns {end, maxBullets, dropped}.
function play(id, song, L, opts = {}) {
  let dropped = 0, maxBullets = 0, f = 0;
  const realBullet = bullet;
  bullet = function (...a) { if (G.nBul >= G.cap) dropped++; return realBullet(...a); };
  startLevel(id, song, L, opts.from || 0, !!opts.test);
  try {
    while (state === 'play') {
      actx.currentTime += 1 / FPS; f++;
      if (!opts.mortal) P.inv = 99;
      P.x = W / 2 + Math.sin(f / 90) * 300;
      P.y = H / 2 + Math.sin(f / 45) * 180;
      update(1 / FPS);
      draw(1 / FPS);
      let n = 0;
      for (const h of G.haz) if (h.type === 'bullet') n++;
      maxBullets = Math.max(maxBullets, n);
      if (f > FPS * 60 * 10) break; // 10 minute safety stop
    }
  } finally { bullet = realBullet; }
  return {end: state, maxBullets, dropped, seconds: f / FPS};
}

print('script');
check(state === 'menu', 'loads to the menu');

print('main levels');
for (let li = 0; li < LEVELS.length; li++) {
  const r = play(li, levelSong(li), LEVELS[li]);
  check(r.end === 'win' && r.dropped === 0,
    `${LEVELS[li].name.padEnd(8)} ${r.end}, ${r.seconds.toFixed(0)}s, peak ${r.maxBullets} bullets, ${r.dropped} dropped`);
  toMenu();
}

print('custom level: every attack, max speed and density');
customLevels = [{id: 1, name: 'T', track: 3, shape: 2, color: 6, speed: 10, dens: 10, pace: 2, blocks: []}];
const lv = customLevels[0];
fitBlocks(lv);
lv.blocks = lv.blocks.map((_, i) => ATK[2 + i % (ATK.length - 2)][0]);
{
  const r = play('c1', levelSong(lv.track), makeL(lv));
  check(r.end === 'win' && r.dropped === 0, `${r.end}, peak ${r.maxBullets} bullets, ${r.dropped} dropped`);
  toMenu();
}

print('dying');
{
  const r = play(4, levelSong(4), LEVELS[4], {mortal: true});
  check(r.end === 'dead', `a player who never dodges dies on INSANE (${r.seconds.toFixed(0)}s)`);
  toMenu();
}

print('practice');
{
  const parts = practiceParts(2);
  check(parts.length === MUSIC[2].form.length && parts[parts.length - 2].name === 'FINAL DROP',
    `${parts.length} parts listed, last drop named FINAL DROP`);
  const fin = parts.find(p => p.name === 'FINAL DROP');
  localStorage.pixel_best_2 = 5;
  const r = play(2, levelSong(2), LEVELS[2], {from: fin.from, test: true, mortal: true});
  check(G.practice === false && r.end === 'dead', 'mortal run from the final drop ends in death');
  // the same run as practice
  startLevel(2, levelSong(2), LEVELS[2], fin.from, true, true);
  check(G.practice && Math.abs(G.t - fin.from) < .01, 'practice starts at the chosen part');
  while (state === 'play') { actx.currentTime += 1 / FPS; update(1 / FPS); }
  check(state === 'dead' && !msg.meter && msg.btns[1][0] === 'BACK', 'practice death shows no score and a BACK button');
  check(+localStorage.pixel_best_2 === 5, 'practice never saves a best');
  toMenu();
  check(PR.on && PR.li === 2, 'BACK returns to the practice screen');
  closePractice();
}

print('settings');
{
  setOffset(123);
  check(audioOffset === 120, 'offset snaps to 10 ms steps');
  const t0 = actx.currentTime;
  startLevel(0, levelSong(0));
  const withOffset = startAt;
  setOffset(0);
  startLevel(0, levelSong(0));
  check(Math.abs(withOffset - startAt - .12) < 1e-9, 'a +120 ms offset makes the game run 120 ms later');
  toMenu();
  toggleCalm();
  const r = play(5, levelSong(5), LEVELS[5]);
  check(calmFx && r.end === 'win', 'EXTREME plays to the end with reduced flashing on');
  toggleCalm();
  toMenu();
}

// click whatever menu element is at layout pixel (x, y), like the player would
function clickAt(x, y) {
  draw(0);
  draw(0); // ui hit-boxes come from the previous frame
  const b = uiPrev.find(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
  if (b) b.fn();
  return !!b;
}
// keep playing an already-started run; bot(t) can steer the player each frame
function runOn(bot, maxSeconds = 400) {
  let f = 0, dropped = 0;
  const realBullet = bullet;
  bullet = function (...a) { if (G.nBul >= G.cap) dropped++; return realBullet(...a); };
  try {
    while (state === 'play' && f < maxSeconds * FPS) {
      actx.currentTime += 1 / FPS; f++;
      P.inv = 99;
      if (bot) bot(G.t, f);
      update(1 / FPS);
      draw(1 / FPS);
    }
  } finally { bullet = realBullet; }
  return {end: state, dropped, seconds: f / FPS};
}
const wander = (t, f) => { P.x = W / 2 + Math.sin(f / 90) * 300; P.y = H / 2 + Math.sin(f / 45) * 180 + 60; };

print('secret: PIXEL (click the title)');
{
  for (const k in localStorage) delete localStorage[k];
  localStorage.pixel_tut_done = '1';
  toMenu();
  levelSong(SECRET_PIXEL.songId, SECRET_PIXEL.music, SECRET_PIXEL.post); // composed ahead so the click starts it at once
  const tx = LW / 2 - tw('PIXEL', 4) / 2;
  check(clickAt(tx + 10, 12) && state === 'play' && G.li === 'pixel', 'clicking the title starts the PIXEL fight');
  check(G.tip && G.tip.text === 'SECRET 1 FOUND!' && secretFound('pixel'), 'first time says SECRET 1 FOUND! and remembers it');
  const seen = new Set();
  const r = runOn((t, f) => { wander(t, f); for (const h of G.haz) if (h.type === 'glyph') seen.add(h.boom ? 'drop' : 'word'); });
  check(r.end === 'win' && r.dropped === 0, `plays to the end (${r.seconds.toFixed(0)}s, ${r.dropped} dropped)`);
  check(seen.has('drop') && seen.has('word'), 'letters fall from the title and words slide across');
  toMenu();
  clickAt(tx + 10, 12);
  check(G.tip.text === 'PIXEL', 'the second time it just says PIXEL');
  // standing on the title hurts
  P.inv = 0; actx.currentTime += 3; update(1 / FPS);
  const p0 = pixLetter(0, G.t); P.x = p0.x; P.y = p0.y; P.inv = 0;
  const hp = P.hp; update(1 / FPS);
  check(P.hp === hp - 1 && G.lastHit === 'title', 'touching a letter costs a heart');
  toMenu();
}

print('secret: GLITCH (click the XP bar with everything unlocked)');
{
  toMenu();
  check(!clickAt(140, 188) || state === 'menu', 'the XP bar does nothing before everything is unlocked');
  for (let i = 0; i < 6; i++) localStorage['pixel_skill_' + i] = 100;
  levelSong(SECRET_GLITCH.songId, SECRET_GLITCH.music, SECRET_GLITCH.post);
  check(clickAt(140, 188) && state === 'play' && G.li === 'glitch', 'with 600 XP, clicking the XP bar starts GLITCH');
  const colours = new Set(), shapes = new Set();
  let flipped = false;
  const r = runOn((t, f) => {
    wander(t, f);
    colours.add(G.L.color); shapes.add(String(G.L.sides) + '/' + G.L.star);
    if (G.invert && t >= G.invert[0] && t < G.invert[1]) flipped = true;
  });
  check(r.end === 'win' && r.dropped === 0, `plays to the end (${r.seconds.toFixed(0)}s)`);
  check(colours.size >= 4 && shapes.size >= 3, `steals other levels' looks (${colours.size} colours, ${shapes.size} shapes)`);
  check(flipped, 'controls get flipped at some point');
  // flipped controls really are flipped
  G = null; toMenu(); levelSong(SECRET_GLITCH.songId); playSecret('glitch');
  actx.currentTime += 3; update(1 / FPS);
  G.invert = [0, 1e9]; const x0 = P.x; keys.ArrowRight = true; actx.currentTime += .1; update(.1); keys.ArrowRight = false;
  check(P.x < x0, 'pressing right moves left while flipped');
  toMenu();
}

print('secret: LAIROTUT (start the tutorial 5 times in a row)');
{
  levelSong(SECRET_HELL.songId, SECRET_HELL.music); // composed ahead so the 5th start begins at once
  for (let n = 1; n <= 4; n++) { toMenu(); startTutorial(); check(G.L === TUT_L, `start ${n}: the normal tutorial`); }
  toMenu();
  startTutorial();
  check(G && G.li === 'lairotut' && G.tip.text === 'SECRET 3 FOUND!', 'start 5: the LAIROTUT hellscape instead, with SECRET 3 FOUND!');
  const pats = new Set(), layered = new Set();
  const r = runOn((t, f) => { wander(t, f); if (G.pat) pats.add(G.pat); if (G.pat2) layered.add(G.pat2); });
  check(r.end === 'win' && r.dropped === 0, `plays to the end (${r.seconds.toFixed(0)}s, ${r.dropped} dropped)`);
  check(pats.has('eruption') && pats.has('brimstone') && layered.size >= 4, `eruptions, brimstone, and ${layered.size} different layered attacks`);
  toMenu();
  // the streak resets if you play something else
  startTutorial(); toMenu(); startTutorial(); toMenu();
  startLevel(0, levelSong(0)); toMenu();
  startTutorial();
  check(G.L === TUT_L && +localStorage.pixel_tut_streak === 1, 'playing a real level in between resets the count');
  toMenu();
}

print('secret: MIRROR (click your equipped skin in the Locker 5 times)');
{
  toMenu();
  levelSong(SECRET_MIRROR.songId, SECRET_MIRROR.music);
  openExtras(); openLocker();
  const skinX = 8 + SKINS.findIndex(k => k.id === curSkin().id) * 44 + 20;
  for (let n = 1; n <= 4; n++) clickAt(skinX, LK_SKIN_Y + 15);
  check(LK.on && LK.pokes === 4, '4 pokes: still in the Locker, skin wobbling');
  clickAt(skinX, LK_SKIN_Y + 15);
  check(G && G.li === 'mirror' && G.tip.text === 'SECRET 4 FOUND!', 'the 5th poke starts MIRROR with SECRET 4 FOUND!');
  const r = runOn(wander);
  check(r.end === 'win' && r.dropped === 0, `plays to the end (${r.seconds.toFixed(0)}s)`);
  // standing in the middle means meeting yourself
  toMenu(); playSecret('mirror'); actx.currentTime += 3; update(1 / FPS);
  for (let j = 0; j < 40; j++) { P.x = W / 2; P.y = H / 2; P.inv = 0; actx.currentTime += 1 / FPS; update(1 / FPS); if (state !== 'play' || P.hp < MAX_HP) break; }
  check(P.hp < MAX_HP && G.lastHit === 'mirror', 'standing in the middle of the screen walks you into the mirror');
  toMenu();
}

print('secret: DRIFT (leave the main menu alone for 45 s)');
{
  toMenu();
  levelSong(SECRET_DRIFT.songId, SECRET_DRIFT.music);
  lastInput = performance.now() - 30000; draw(0);
  check(state === 'menu', 'after 30 s idle: still on the menu (shapes drifting in)');
  lastInput = performance.now() - 46000; draw(0);
  check(G && G.li === 'drift' && G.tip.text === 'SECRET 5 FOUND!', 'after 45 s idle: DRIFT starts with SECRET 5 FOUND!');
  const looks = [];
  const r = runOn((t, f) => { wander(t, f); if (looks[looks.length - 1] !== G.L.color) looks.push(G.L.color); });
  check(r.end === 'win' && r.dropped === 0, `plays to the end (${r.seconds.toFixed(0)}s)`);
  check(looks.join() === LEVELS.map(L => L.color).join(), 'it becomes EASY, NORMAL, HARD, HARDER, INSANE, EXTREME in order');
  toMenu();
  draw(0);
  check(state === 'menu', 'coming back to the menu resets the idle clock (no instant re-trigger)');
}

print('secret: GARY (swat the fly on the menu)');
{
  toMenu();
  levelSong(SECRET_GARY.songId, SECRET_GARY.music);
  MENU_FLY.next = 0; MENU_FLY.t0 = -1;
  draw(0);
  check(MENU_FLY.next > performance.now() && !menuFly(performance.now()), 'no fly at first (it waits 15-30 s)');
  MENU_FLY.next = performance.now() - 1;
  draw(0);
  const f = menuFly(performance.now());
  check(!!f, 'then a fly buzzes across the menu');
  MENU_FLY.t0 = performance.now() - 3500; // half-way: it lands for a moment
  const a1 = menuFly(performance.now()); MENU_FLY.t0 -= 500; const a2 = menuFly(performance.now());
  check(a1.landed && a2.landed && a1.x === a2.x && a1.y === a2.y, 'it lands and sits still for a moment');
  check(clickAt(a2.x, a2.y) && G && G.li === 'gary' && G.tip.text === 'SECRET 6 FOUND!', 'clicking it starts GARY with SECRET 6 FOUND!');
  const said = new Set(), seen = new Set();
  const r = runOn((t, fr) => {
    wander(t, fr);
    if (G.say) said.add(G.say.text);
    for (const h of G.haz) {
      if (h.fly) seen.add('flies');
      if (h.type === 'paper') seen.add('paper');
      if (h.gapW) seen.add('gap rings');
      if (h.type === 'dashwarn') seen.add('dives');
      if (h.type === 'rect' && h.w === 170) seen.add('swatter');
      if (h.type === 'mark' && h.r === 16) seen.add('eggs');
    }
    if (G.dark && t >= G.dark.t0 && t < G.dark.t1) seen.add('lights out');
  });
  check(r.end === 'win' && r.dropped === 0, `plays to the end (${r.seconds.toFixed(0)}s, ${r.dropped} dropped)`);
  const all = ['flies', 'paper', 'gap rings', 'dives', 'swatter', 'eggs', 'lights out'];
  check(all.every(x => seen.has(x)), 'every mechanic shows up: ' + all.filter(x => seen.has(x)).join(', '));
  check(said.has('OI! YOU TRIED TO SWAT ME.') && said.has("THIS IS MY FINAL FORM. ...IT'S THE SAME FORM. I'M A FLY.") && said.size >= 8,
    `he talks (${said.size} different lines, intro to final drop)`);
  check(msg && msg.sub === 'GARY: FINE. YOU WIN.', 'and has the last word when you win');

  // mechanics, one at a time
  toMenu(); playSecret('gary'); actx.currentTime += 3; update(1 / FPS);
  G.haz = [{type: 'paper', x: 0, y: 0, w: W, h: H, t0: 0, t1: 1e9}];
  P.x = 100; keys.ArrowRight = true; actx.currentTime += .5; update(.5); keys.ArrowRight = false;
  check(Math.abs(P.x - 100 - 280 / 3 * .5) < 1, 'fly paper slows you to a third');
  G.haz = []; boss.x = 200; boss.y = 300; boss.tw = null; G.nextDart = 1e9; P.inv = 0;
  G.haz.push({type: 'ring', x: 480, y: 300, r0: 100, vr: 0, th: 8, rMax: 1200, t0: G.t, dmg: true, gapA: 0, gapW: .42});
  P.x = 580; P.y = 300; actx.currentTime += 1 / FPS; update(1 / FPS);
  const inGapHp = P.hp;
  P.x = 480; P.y = 400; actx.currentTime += 1 / FPS; update(1 / FPS);
  check(inGapHp === MAX_HP && P.hp === MAX_HP - 1, 'a buzz ring only misses you in its gap');
  // fairness: wherever you and Gary are (even on fly paper or in the dark), the gap is reachable before the ring arrives
  {
    let worst = 0;
    for (let n = 0; n < 3000; n++) {
      G.haz = []; G.dark = null; P.inv = 99;
      boss.x = 60 + Math.random() * (W - 120); boss.y = 60 + Math.random() * (H - 120);
      P.x = 20 + Math.random() * (W - 40); P.y = 20 + Math.random() * (H - 40);
      const slow = Math.random() < .5, dark = Math.random() < .3;
      if (slow) G.haz.push({type: 'paper', x: P.x - 50, y: P.y - 50, w: 100, h: 100, t0: 0, t1: 1e9});
      if (dark) G.dark = {t0: 0, t1: 1e9};
      G.ctx = {s: n, n: 0}; G.rng = mulberry(n);
      const before = G.ev.length; PAT.buzz(0, G.t, .9); G.ev.splice(before).forEach(e => e.fn());
      for (const h of G.haz) if (h.gapW) {
        const d = Math.hypot(P.x - h.x, P.y - h.y), off = Math.abs(((Math.atan2(P.y - h.y, P.x - h.x) - h.gapA) % TAU + 3 * Math.PI) % TAU - Math.PI);
        const travel = Math.max(0, off - h.gapW) * d, time = Math.max(0, (d - 20) / h.vr), can = time * (slow ? 280 / 3 : 280);
        worst = Math.max(worst, can > 0 ? travel / can : travel > 0 ? Infinity : 0);
      }
    }
    check(worst < .65, `3000 random rings: the gap never needs more than ${(worst * 100).toFixed(0)}% of the movement you have time for`);
  }
  check(G.say && G.say.text.length > 0 && GARY_LINES.hit.some(fn => fn(curSkin().name) === G.say.text), 'getting hit makes him gloat: "' + G.say.text + '"');
  P.hp = 1; P.inv = 0; boss.x = P.x; boss.y = P.y; actx.currentTime += 1 / FPS; update(1 / FPS);
  check(state === 'dead' && msg.lines.includes('GOING TO GO LAND ON SOMETHING GROSS NOW.'), 'dying gets his parting line');
  toMenu();
}

print('menu: GD-style PLAY button and level picker');
{
  for (const k in localStorage) delete localStorage[k];
  localStorage.pixel_tut_done = '1';
  toMenu(); LS.on = false; sel = 0;
  check(clickAt(LW / 2, 100) && LS.on && state === 'menu', 'the big PLAY button opens the level picker');
  check(LS.i === 0, 'it opens on EASY');
  clickAt(LW - 22, 70);
  check(LS.i === 1, 'the right arrow goes to NORMAL');
  clickAt(22, 70); clickAt(22, 70); clickAt(22, 70);
  check(LS.i === 5, 'the left arrow wraps around past the daily to EXTREME');
  clickAt(160, 60);
  check(modal && modal.title === 'LOCKED' && !G, 'clicking a locked level says LOCKED');
  modal = null;
  clickAt(LW / 2 - 30 + 2 * 10, 178);
  check(LS.i === 2, 'clicking a page dot jumps to that level');
  lsGo(-2);
  levelSong(0); // composed ahead so the click starts it at once
  clickAt(160, 60);
  check(state === 'play' && G.li === 0, 'clicking the card plays the level');
  toMenu();
  check(LS.on && state === 'menu', 'leaving a level comes back to the picker');
  clickAt(LW / 2 + 30, 158);
  check(PR.on && PR.li === 0, 'its PRACTICE button opens practice for that level');
  closePractice();
  check(LS.on, 'leaving practice comes back to the picker');
  clickAt(LW / 2 - 30, 158);
  check(state === 'play' && G.li === 0, 'the PLAY button next to it plays the level');
  toMenu();
  lsKey({code: 'ArrowRight'});
  check(LS.i === 1, 'arrow keys browse');
  lsKey({code: 'Escape'});
  check(!LS.on && state === 'menu', 'Esc goes back to the main menu');
  check(clickAt(LW / 2 - 72, 100) && LK.on, 'the button left of PLAY opens the Locker');
  closeLocker();
  check(clickAt(LW / 2 + 72, 100) && ED.on, 'the button right of PLAY opens the editor');
  backFromSub();
  check(state === 'menu' && !ED.on, 'and BACK returns to the main menu');
}

print('editor layout');
{
  const kinds = ATK_ROWS.flat().map(a => a[0]);
  check(kinds.length === ATK.length - 2 && new Set(kinds).size === kinds.length && ATK_ROWS.every(r => r.length <= 5),
    `the attack palette shows all ${kinds.length} attacks once, grouped by level, at most 5 per row`);
  check(MUSIC.every((M, i) => Math.ceil(songInfo({track: i}).nb / 2) * 16 <= 312), 'every song\'s timeline fits in two rows without scrolling');
  customLevels = []; openExtras(); openEditor(); newLevel();
  const lv = ED.lv, per = Math.ceil(lv.blocks.length / 2), x0 = Math.round((LW - per * 16) / 2);
  clickAt(x0 + 3 * 16 + 5, 40);
  check(ED.sel === 3, 'clicking a timeline box selects it');
  clickAt(40 + 2, 96 + 4);
  check(lv.blocks[3] === ATK_ROWS[0][0][0] && ED.sel === 4, 'clicking an attack fills the box and moves to the next');
  clickAt(278 + 5, 82);
  check(lv.blocks[4] === 'rest' && ED.sel === 5, 'REST fills a box with nothing');
  clickAt(x0 + 3 * 16 + 5, 40); clickAt(236 + 5, 82);
  check(lv.blocks[3] === 'auto', 'AUTO clears a box back to the game\'s pick');
  clickAt(x0 + 5, 60);
  check(ED.sel === per, 'the second row continues the timeline');
  // the explainer line: hover an attack, then the gap next to it, then the gap under it
  const said = () => { draw(0); return ED.info && ED.info[0]; };
  mouse.x = 40 + 10; mouse.y = 96 + 5;
  const hint = said();
  check(hint && hint.startsWith(ATK_ROWS[0][0][1] + ' - '), 'hovering an attack explains it: "' + hint + '"');
  mouse.x = 40 + 53; check(said() === hint, 'the gap beside it keeps the explanation (no flicker)');
  mouse.x = 40 + 10; mouse.y = 96 + 11; check(said() === hint, 'the gap below it too');
  mouse.x = 160; mouse.y = 92; check(said() === hint, 'and the space between the explainer line and the attacks');
  mouse.x = mouse.y = -1;
  check(!clickAt(200, 10) || ED.screen === 'edit', 'there is no TEST button any more');
  check(clickAt(218 + 5, 8) && ED.screen === 'settings', 'SETTINGS opens the settings screen');
  clickAt(164 + 6 * 10 + 4, 104);
  check(lv.speed === 7, 'the SPEED slider sets 7 when you click its 7th step');
  clickAt(164 + 4 * 10 + 4, 128);
  check(lv.dens === 5, 'the BULLETS slider works the same');
  clickAt(164 + 2 * 50 + 10, 152);
  check(lv.pace === 2, 'PACE has a button per setting');
  const tr = lv.track; clickAt(164 + 148 - 5, 32);
  check(lv.track === (tr + 1) % MUSIC.length && lv.blocks.length === songInfo(lv).nb, 'SONG changes the song and resizes the timeline');
  edKey({code: 'Escape', key: 'Escape'});
  check(ED.screen === 'edit', 'Esc on settings goes back to the timeline');
  ED.screen = 'list'; draw(0);
  check(customLevels.length === 1, 'the level list draws with a level in it');
  customLevels = []; backFromSub(); closeExtras();
}

print('result screens');
{
  for (const k in localStorage) delete localStorage[k];
  localStorage.pixel_tut_done = '1';
  localStorage.pixel_best_4 = 30;
  const r1 = play(4, levelSong(4), LEVELS[4], {mortal: true});
  const res = msg.res;
  check(r1.end === 'dead' && res && res.kind === 'dead' && res.att === 1, 'dying shows the result screen, ATTEMPT 1');
  check(res.hits.length === MAX_HP && res.hits.every((f, i) => f > 0 && f <= res.p / 100 + .01 && (!i || f >= res.hits[i - 1])), `it marks all ${res.hits.length} hits on the bar, in order, before where you died`);
  check(res.best === 30 && res.newBest === (res.p > 30) && res.hint && res.hint.length === 2, `your old best (30%) and a HIT BY tip: ${res.hint && res.hint[0]}`);
  msg.at = 0; draw(0); draw(0);
  check(uiPrev.some(b => b.fn === retry), 'it draws, with a RETRY button');
  retry();
  check(G.att === 2, 'retrying counts ATTEMPT 2');
  toMenu();
  const fin = practiceParts(4).find(p => p.name === 'FINAL DROP');
  startLevel(4, levelSong(4), LEVELS[4], fin.from, true, true);
  while (state === 'play') { actx.currentTime += 1 / FPS; update(1 / FPS); }
  check(msg.res && msg.res.practice && !msg.res.att && !msg.res.newBest && msg.res.from > .5, 'practice: no attempt count or best, the bar starts at your chosen part');
  msg.at = 0; draw(0);
  toMenu(); closePractice();
  const r2 = play(0, levelSong(0), LEVELS[0]);
  check(r2.end === 'win' && msg.res.kind === 'win' && msg.res.p === 100 && msg.res.newBest, 'clearing a level shows CLEARED! at 100% with NEW BEST');
  msg.at = 0; draw(0);
  toMenu();
}

print('daily challenge');
{
  for (const k in localStorage) delete localStorage[k];
  localStorage.pixel_tut_done = '1';
  const a = dailyLevel(20261121), b = dailyLevel(20261122);
  check(a.n === 1 && a.L.name === 'DAILY 1' && b.n === 2 && b.L.name === 'DAILY 2', 'the first is DAILY 1, the next day DAILY 2');
  check(a.date === 'NOV SAT 21', 'dates read like ' + a.date);
  delete dailyCache[20261121];
  const a2 = dailyLevel(20261121);
  check(a2.L.pool.join() === a.L.pool.join() && a2.music.bpm === a.music.bpm && a2.L.color === a.L.color, 'the same date always builds the same level');
  check(a.L.pool.join() !== b.L.pool.join(), 'a different date builds a different one');
  const ds = [20261123, 20261124, 20261125, 20261126, 20261127, 20261128, 20261129].map(k => LEVELS[dailyLevel(k).D].name);
  check(ds.join() === 'NORMAL,HARD,HARD,HARDER,HARDER,INSANE,INSANE', 'it ramps through the week: ' + ds.join(' '));
  const today = dailyLevel();
  const r = play(today.li, levelSong(today.songId, today.music), Object.assign({}, today.L));
  check(r.end === 'win' && r.dropped === 0, `today's (${today.L.name}, plays like ${LEVELS[today.D].name}) plays to the end (${r.seconds.toFixed(0)}s, ${r.dropped} dropped)`);
  check(dailyStreak() === 1 && msg.lines[0] === 'DAILY STREAK: 1 DAY', 'clearing it starts a 1 day streak');
  check(xpTotal() === 0, "it doesn't count toward XP");
  toMenu();
  localStorage.pixel_daily_last = 20261121; localStorage.pixel_daily_streak = 4;
  check(dailyCleared(20261122) === 5, 'clearing the next day grows the streak');
  check(dailyCleared(20261122) === 5, 'clearing the same day twice does not');
  check(dailyCleared(20261125) === 1, 'missing a day starts again at 1');
  check(dailyStreak(20261127) === 0, 'and a streak you let lapse shows 0');
  LS.on = false; openLevels(); lsGo(-1 - LS.i);
  check(LS.i === LEVELS.length, 'the daily is the last card in the level picker');
  draw(0); draw(0);
  levelSong(today.songId, today.music);
  clickAt(160, 60);
  check(state === 'play' && G.li === today.li, 'clicking it plays today\'s daily');
  toMenu(); LS.on = false;
  // the archive
  DAILY_TODAY = 20261121;
  check(archiveKeys().length === 0, 'on day 1 the archive is empty');
  openLevels(); lsGo(LEVELS.length - LS.i);
  check(clickAt(LW / 2 + 30, 158) && AR.on, "the daily card's ARCHIVE button opens the archive");
  draw(0);
  DAILY_TODAY = 20261210;
  check(archiveKeys().join() === [...Array(19)].map((_, i) => numKey(19 - i)).join() && archiveKeys()[0] === 20261209 && archiveKeys()[18] === 20261121,
    'later on it lists every past daily, newest first (19 on DAILY 20)');
  check(arPages() === 3, '7 to a page: 3 pages');
  clickAt(LW / 2 + 40, 178);
  check(AR.page === 1, 'the > button turns the page');
  arKey({code: 'ArrowLeft'});
  check(AR.page === 0, 'and arrow keys do too');
  for (const k in localStorage) if (k.startsWith('pixel_daily')) delete localStorage[k];
  const old = dailyLevel(archiveKeys()[1]);
  levelSong(old.songId, old.music);
  clickAt(290, 24 + 21 + 8);
  check(state === 'play' && G.li === old.li, `PLAY on a row plays that day (${old.L.name})`);
  runOn(null);
  check(state === 'win' && msg.lines[0] === 'FROM THE ARCHIVE - NO STREAK' && dailyStreak() === 0, "clearing an old daily doesn't touch the streak");
  check(best(old.li) === 100, 'but it does save your best for that day');
  toMenu();
  check(AR.on, 'leaving the level comes back to the archive');
  arKey({code: 'Escape'});
  check(!AR.on && LS.on, 'Esc goes back to the picker');
  LS.on = false; DAILY_TODAY = 0;
}

print('leaving the window');
{
  setVol(10); muted = false;
  setAway(true);
  check(outGain() === 0 && !muted, 'leaving the window silences everything without touching your mute setting');
  setAway(false);
  check(outGain() === 1, 'coming back brings the sound back at your volume');
}

print('song cache');
check(songCache.size <= SONG_CACHE_MAX, `holds at most ${SONG_CACHE_MAX} songs (has ${songCache.size})`);

print('palettes');
{
  const pals = [...LEVELS.map(L => L.pal), MENU_PAL, TUT_L.pal, ...ED_COLORS.map((_, i) => edPal(i))];
  let bad = 0;
  for (const pal of pals) {
    const lut = palLUT(pal);
    for (const p of pal) {
      const c = PACK(p);
      if (lut[(c >>> 3 & 31) | (c >>> 6 & 0x3e0) | (c >>> 9 & 0x7c00)] !== c) bad++;
    }
  }
  check(bad === 0, `every colour of ${pals.length} palettes maps to itself`);
}

print(failures ? `\n${failures} FAILED` : '\nall passed');
if (failures) throw new Error('tests failed');
