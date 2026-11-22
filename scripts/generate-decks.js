#!/usr/bin/env node
/**
 * Writes fake decklists to examples/fake/ for manual testing: each seed gets
 * an official-format file and the Melee.gg output we expect for it.
 *
 *   node scripts/generate-decks.js [count=10] [firstSeed=1]
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { generateDeck, toOfficialText, expectedMelee } = require("../test/deck-generator.js");

const count = parseInt(process.argv[2] || "10", 10);
const firstSeed = parseInt(process.argv[3] || "1", 10);
const outDir = path.join(__dirname, "..", "examples", "fake");

fs.mkdirSync(outDir, { recursive: true });
for (let seed = firstSeed; seed < firstSeed + count; seed++) {
  const deck = generateDeck(seed);
  const base = path.join(outDir, `fake-${String(seed).padStart(3, "0")}`);
  fs.writeFileSync(`${base}.txt`, toOfficialText(deck));
  fs.writeFileSync(`${base}.melee.txt`, expectedMelee(deck) + "\n");
}
console.log(`Wrote ${count} fake decks to ${path.relative(process.cwd(), outDir)}`);
