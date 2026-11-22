"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { convertDecklist, formatCardName } = require("../convert.js");
const gen = require("./deck-generator.js");

const EXAMPLES = path.join(__dirname, "..", "examples");
const read = (p) => fs.readFileSync(p, "utf8");

// ---------------------------------------------------------------------------
// Card name formatting
// ---------------------------------------------------------------------------

test("formatCardName: colon subtitle becomes ' | '", () => {
  assert.equal(formatCardName("Lizzy Wizzy: Delicate Weapon"), "Lizzy Wizzy | Delicate Weapon");
});

test("formatCardName: other subtitle separators are normalised", () => {
  assert.equal(formatCardName("V — Streetkid"), "V | Streetkid"); // em dash (card site)
  assert.equal(formatCardName("V – Streetkid"), "V | Streetkid"); // en dash
  assert.equal(formatCardName("V / Streetkid"), "V | Streetkid"); // Melee docs' slash
  assert.equal(formatCardName("V|Streetkid"), "V | Streetkid");
  assert.equal(formatCardName("V | Streetkid"), "V | Streetkid"); // idempotent
  assert.equal(formatCardName("V:Streetkid"), "V | Streetkid");
});

test("formatCardName: leaves names without subtitles alone", () => {
  for (const name of [
    "Jacked-In Voodoo Boy",
    "Three Mouths, One Desire",
    "Rockn' Rockerboy",
    "Les Élémens",
    "6th Street Recruits",
    "MaxTac Suppression Team",
  ]) {
    assert.equal(formatCardName(name), name);
  }
});

test("formatCardName: collapses stray whitespace", () => {
  assert.equal(formatCardName("  Lizzy   Wizzy :  Delicate  Weapon "), "Lizzy Wizzy | Delicate Weapon");
});

test("every real card name converts to 'Name | Subname' (or just Name)", () => {
  for (const card of gen.CARDS) {
    const expected = card.subname ? `${card.name} | ${card.subname}` : card.name;
    assert.equal(formatCardName(card.displayName), expected, card.displayName);
  }
});

test("card fixture has no duplicate display names", () => {
  const names = gen.CARDS.map((c) => c.displayName);
  assert.equal(new Set(names).size, names.length);
});

// ---------------------------------------------------------------------------
// Whole decklists
// ---------------------------------------------------------------------------

test("example deck converts to the expected Melee.gg text", () => {
  const result = convertDecklist(read(path.join(EXAMPLES, "alt-control-bbv.txt")));
  assert.equal(result.output, read(path.join(EXAMPLES, "alt-control-bbv.melee.txt")).trimEnd());
  assert.deepEqual(result.totals, { Legends: 3, "MainDeck": 40, Sideboard: 7 });
  assert.deepEqual(result.warnings, []);
});

test("Melee.gg output is idempotent (converting it again changes nothing)", () => {
  const once = convertDecklist(read(path.join(EXAMPLES, "alt-control-bbv.txt"))).output;
  const twice = convertDecklist(once);
  assert.equal(twice.output, once);
  assert.deepEqual(twice.warnings, []);
});

test("'#' comment lines are dropped", () => {
  const { output } = convertDecklist("# Title\n# id: abc\n// Legends (1)\n1 V: Streetkid");
  assert.equal(output, "Legends\n1 V | Streetkid");
});

test("Units, Gear and Programs all go into the Main Deck", () => {
  const { output } = convertDecklist(
    "// Units (3)\n3 Minotaur\n// Gear (2)\n2 Mantis Blades\n// Programs (1)\n1 Detonate"
  );
  assert.equal(output, "MainDeck\n3 Minotaur\n2 Mantis Blades\n1 Detonate");
});

test("cards before any header default to the Main Deck", () => {
  assert.equal(convertDecklist("3 Minotaur\n2 Detonate").output, "MainDeck\n3 Minotaur\n2 Detonate");
});

test("bare section headers are recognised and output in Melee.gg's order", () => {
  for (const main of ["MainDeck", "Main Deck", "Main deck:"]) {
    const { output } = convertDecklist(`Legends\n1 V | Streetkid\n\n${main}\n3 Minotaur\n\nSideboard\n1 Detonate`);
    assert.equal(output, "MainDeck\n3 Minotaur\n\nLegends\n1 V | Streetkid\n\nSideboard\n1 Detonate", main);
  }
});

// A real decklist exported from Melee.gg as .txt.
const MELEE_EXPORT = read(path.join(EXAMPLES, "melee-export.txt"));

test("a real Melee.gg export passes through unchanged", () => {
  const result = convertDecklist(MELEE_EXPORT);
  assert.equal(result.output, MELEE_EXPORT.trimEnd());
  assert.deepEqual(result.totals, { MainDeck: 45, Legends: 3, Sideboard: 7 });
  assert.deepEqual(result.warnings, []);
});

test("our output uses the same headers, order and spacing as the Melee.gg export", () => {
  const shape = (text) =>
    text
      .trimEnd()
      .split("\n")
      .map((l) => (/^\d+ /.test(l) ? "<card>" : l))
      .filter((l, i, a) => l !== "<card>" || a[i - 1] !== "<card>")
      .join("\n");
  const ours = convertDecklist(read(path.join(EXAMPLES, "alt-control-bbv.txt"))).output;
  assert.equal(shape(ours), shape(MELEE_EXPORT));
});

test("every card in the Melee.gg export exists in the card list", () => {
  const valid = new Set(gen.CARDS.map((c) => (c.subname ? `${c.name} | ${c.subname}` : c.name)));
  for (const line of MELEE_EXPORT.split(/\r?\n/)) {
    const m = line.match(/^\d+ (.+)$/);
    if (m) assert.ok(valid.has(m[1]), `unknown card: ${m[1]}`);
  }
});

test("the Melee.gg export, rewritten in the official format, converts back to it", () => {
  const official = MELEE_EXPORT.replace(/^(MainDeck|Legends|Sideboard)$/gm, "// $1").replace(/ \| /g, ": ");
  assert.equal(convertDecklist(official).output, MELEE_EXPORT.trimEnd());
});

test("empty sections are omitted", () => {
  const { output } = convertDecklist("// Legends (1)\n1 V: Streetkid\n// Sideboard (0)\n");
  assert.equal(output, "Legends\n1 V | Streetkid");
});

test("duplicate cards within a section are merged", () => {
  const { output, totals } = convertDecklist("// Units\n2 Minotaur\n// Programs\n1 Detonate\n1 Minotaur");
  assert.equal(output, "MainDeck\n3 Minotaur\n1 Detonate");
  assert.equal(totals["MainDeck"], 4);
});

test("the same card in main deck and sideboard stays separate", () => {
  const { output } = convertDecklist("// Units\n2 Minotaur\n// Sideboard\n1 Minotaur");
  assert.equal(output, "MainDeck\n2 Minotaur\n\nSideboard\n1 Minotaur");
});

test("'3x Name' counts are accepted", () => {
  assert.equal(convertDecklist("3x Minotaur\n2X Detonate").output, "MainDeck\n3 Minotaur\n2 Detonate");
});

test("CRLF line endings and a UTF-8 BOM are handled", () => {
  const { output, warnings } = convertDecklist("﻿// Legends (1)\r\n1 V: Streetkid\r\n\r\n// Units (1)\r\n3 Minotaur\r\n");
  assert.equal(output, "MainDeck\n3 Minotaur\n\nLegends\n1 V | Streetkid");
  assert.deepEqual(warnings, []);
});

test("a card line missing its count is reported, not silently swallowed", () => {
  const { output, warnings } = convertDecklist("// Programs\nPyramid Song\n3 Detonate");
  assert.equal(output, "MainDeck\n3 Detonate");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Line 2 skipped: Pyramid Song/);
});

test("empty or blank input produces empty output", () => {
  for (const input of ["", "   \n\n", undefined, null]) {
    const result = convertDecklist(input);
    assert.equal(result.output, "");
    assert.deepEqual(result.warnings, []);
  }
});

// ---------------------------------------------------------------------------
// Generated decks
// ---------------------------------------------------------------------------

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
const STYLES = [
  {},
  { crlf: true },
  { bom: true, crlf: true },
  { xCounts: true },
  { emDash: true },
  { noHeaderComments: true, extraBlankLines: true },
];

test("generated decks follow the deck-building rules", () => {
  for (const seed of SEEDS) {
    const deck = gen.generateDeck(seed);
    assert.equal(deck.legends.length, gen.LEGEND_COUNT, `seed ${seed} legends`);
    assert.ok(deck.legends.every((e) => e.count === 1), `seed ${seed} one copy of each legend`);
    assert.equal(new Set(deck.legends.map((e) => e.card.displayName)).size, gen.LEGEND_COUNT, `seed ${seed} distinct legends`);
    assert.equal(new Set(deck.legends.map((e) => e.card.name)).size, gen.LEGEND_COUNT, `seed ${seed} unique legends`);
    const mainSize = gen.total(deck.main);
    assert.ok(mainSize >= gen.MAIN_DECK_SIZE && mainSize <= gen.MAIN_DECK_SIZE + 10, `seed ${seed} main: ${mainSize}`);
    assert.ok([0, gen.SIDEBOARD_SIZE].includes(gen.total(deck.sideboard)), `seed ${seed} sideboard`);

    const copies = new Map();
    for (const { card, count } of [...deck.main, ...deck.sideboard]) {
      copies.set(card.displayName, (copies.get(card.displayName) || 0) + count);
    }
    for (const [name, n] of copies) assert.ok(n <= gen.MAX_COPIES, `seed ${seed}: ${n}x ${name}`);
  }
});

test("generated decks convert correctly in every input style", () => {
  for (const seed of SEEDS) {
    const deck = gen.generateDeck(seed);
    const expected = gen.expectedMelee(deck);
    for (const style of STYLES) {
      const result = convertDecklist(gen.toOfficialText(deck, style));
      const label = `seed ${seed}, style ${JSON.stringify(style)}`;
      assert.equal(result.output, expected, label);
      assert.deepEqual(result.warnings, [], label);
      assert.deepEqual(
        result.totals,
        { MainDeck: gen.total(deck.main), Legends: 3, Sideboard: gen.total(deck.sideboard) },
        label
      );
    }
  }
});

test("every converted card line refers to a real card in Melee format", () => {
  const valid = new Set(gen.CARDS.map((c) => (c.subname ? `${c.name} | ${c.subname}` : c.name)));
  for (const seed of SEEDS) {
    const { output } = convertDecklist(gen.toOfficialText(gen.generateDeck(seed)));
    for (const line of output.split("\n")) {
      if (!line || ["Legends", "MainDeck", "Sideboard"].includes(line)) continue;
      const m = line.match(/^(\d+) (.+)$/);
      assert.ok(m, `bad line: ${line}`);
      assert.ok(valid.has(m[2]), `unknown card: ${m[2]}`);
      assert.ok(!/[:\/]/.test(m[2]), `separator left in: ${m[2]}`);
    }
  }
});
