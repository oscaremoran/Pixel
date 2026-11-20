#!/bin/sh
# Runs the headless regression test (macOS JavaScriptCore, no browser needed): sh test/run.sh
set -e
cd "$(dirname "$0")/.."
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
TMP=$(mktemp -t pixel-test)
trap 'rm -f "$TMP"' EXIT
# the game's <script>, minus the input handlers and the frame loop at the end
awk '/<script>/{f=1;next}/---------- input & loop/{f=0}f' pixel.html > "$TMP"
"$JSC" test/stubs.js "$TMP" test/sim.js
