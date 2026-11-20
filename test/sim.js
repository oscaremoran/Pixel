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
