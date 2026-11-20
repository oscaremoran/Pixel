# PIXEL

A browser rhythm bullet-dodger. Survive the song while a geometric core attacks you on the beat.

Open `pixel.html` in any modern browser; no install or build step.

- 6 levels (EASY to EXTREME), each with its own procedurally composed soundtrack and signature attacks
- Practice mode: start any level from any part of its song (nothing is saved)
- Level editor: build your own levels on a timeline of attacks
- Extras: skins and trails, volume, audio offset (for Bluetooth headphones), reduce flashing & shake
- Secrets. Poke around.
- Controls: click a level to play; arrows/WASD to move, Esc to pause

## Tests

`sh test/run.sh` plays every level headlessly in JavaScriptCore (built into macOS, no browser needed)
and checks that each can be finished, nothing is dropped, practice works, and the secrets trigger.
