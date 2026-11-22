/**
 * Generates fake-but-plausible Cyberpunk TCG decks from the real card list,
 * renders them in the official decklist format, and independently computes
 * the Melee.gg output we expect the converter to produce.
 */
"use strict";

const CARDS = require("./fixtures/cards.json");

const MAIN_DECK_SIZE = 40;
const LEGEND_COUNT = 3;
const SIDEBOARD_SIZE = 7;
const MAX_COPIES = 3;

// Small seeded PRNG (mulberry32) so every generated deck is reproducible.
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick(list, rand) {
  return list[Math.floor(rand() * list.length)];
}

/** Fill `size` card slots from `pool`, respecting copy limits in `used`. */
function fill(pool, size, rand, used) {
  const picked = new Map();
  let remaining = size;
  let guard = 0;
  while (remaining > 0) {
    if (++guard > 10000) throw new Error("card pool too small to build deck");
    const card = pick(pool, rand);
    const have = used.get(card.displayName) || 0;
    const room = MAX_COPIES - have;
    if (room <= 0) continue;
    const n = Math.min(room, remaining, 1 + Math.floor(rand() * MAX_COPIES));
    used.set(card.displayName, have + n);
    picked.set(card, (picked.get(card) || 0) + n);
    remaining -= n;
  }
  return [...picked].map(([card, count]) => ({ count, card }));
}

/**
 * Build a deck: 3 legends and a 40-card main deck in 1–2 colours, plus a
 * 7-card sideboard (or none). Copy limits are shared between main and side.
 */
function generateDeck(seed, cards = CARDS) {
  const rand = rng(seed);
  const colors = shuffle([...new Set(cards.map((c) => c.color))], rand).slice(0, rand() < 0.4 ? 1 : 2);
  const inColors = cards.filter((c) => colors.includes(c.color));

  const legendPool = inColors.filter((c) => c.type === "Legend");
  // Three legends with different characters (no V + V).
  const legends = shuffle(legendPool, rand)
    .filter((c, i, all) => all.findIndex((o) => o.name === c.name) === i)
    .slice(0, LEGEND_COUNT)
    .map((card) => ({ count: 1, card }));

  const used = new Map();
  const nonLegends = inColors.filter((c) => c.type !== "Legend");
  // Real decks run 40+ (the Melee.gg export example has 45).
  const mainSize = MAIN_DECK_SIZE + (rand() < 0.5 ? 0 : Math.floor(rand() * 11));
  const main = fill(nonLegends, mainSize, rand, used);
  const sideboard = rand() < 0.7 ? fill(nonLegends, SIDEBOARD_SIZE, rand, used) : [];

  return { seed, colors, legends, main, sideboard };
}

const byName = (a, b) => a.card.displayName.localeCompare(b.card.displayName);
const total = (entries) => entries.reduce((sum, e) => sum + e.count, 0);

/**
 * Render in the official format. `style` lets tests add realistic noise:
 *   crlf, bom, xCounts ("3x Name"), noHeaderComments, emDash, extraBlankLines.
 */
function toOfficialText(deck, style = {}) {
  const nl = style.crlf ? "\r\n" : "\n";
  const gap = style.extraBlankLines ? nl + nl + nl : nl + nl;
  const name = (card) =>
    style.emDash && card.subname ? `${card.name} — ${card.subname}` : card.displayName;
  const line = (e) => `${e.count}${style.xCounts ? "x" : ""} ${name(e.card)}`;
  const section = (title, entries) =>
    entries.length ? `// ${title} (${total(entries)})${nl}${entries.slice().sort(byName).map(line).join(nl)}` : null;

  const ofType = (type) => deck.main.filter((e) => e.card.type === type);
  const header = style.noHeaderComments
    ? []
    : [`# Fake Deck ${deck.seed}${nl}# source: generated (${deck.colors.join("/")})${nl}# id: fake-${deck.seed}`];

  const blocks = [
    ...header,
    section("Legends", deck.legends),
    section("Units", ofType("Unit")),
    section("Gear", ofType("Gear")),
    section("Programs", ofType("Program")),
    section("Sideboard", deck.sideboard),
  ].filter(Boolean);

  return (style.bom ? "﻿" : "") + blocks.join(gap) + nl;
}

/** The Melee.gg text we expect, built straight from the card data. */
function expectedMelee(deck) {
  const melee = (card) => (card.subname ? `${card.name} | ${card.subname}` : card.name);
  const line = (e) => `${e.count} ${melee(e.card)}`;

  // The converter keeps input order; the official list is sorted per section,
  // and Units, Gear and Programs are concatenated into the main deck.
  const typeOrder = ["Unit", "Gear", "Program"];
  const main = typeOrder.flatMap((t) => deck.main.filter((e) => e.card.type === t).sort(byName));

  // Same section names and order as Melee.gg's own export.
  const blocks = [
    ["MainDeck", main],
    ["Legends", deck.legends.slice().sort(byName)],
    ["Sideboard", deck.sideboard.slice().sort(byName)],
  ]
    .filter(([, entries]) => entries.length)
    .map(([title, entries]) => `${title}\n${entries.map(line).join("\n")}`);

  return blocks.join("\n\n");
}

module.exports = {
  CARDS,
  MAIN_DECK_SIZE,
  LEGEND_COUNT,
  SIDEBOARD_SIZE,
  MAX_COPIES,
  generateDeck,
  toOfficialText,
  expectedMelee,
  total,
};
