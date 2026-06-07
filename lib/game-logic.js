// ─────────────────────────────────────────────────────────
// Shared game logic — used by seating, bidding, play phases
// ─────────────────────────────────────────────────────────

export const SUITS = ['spade', 'heart', 'diamond', 'club'];

export const SUIT_SYMBOLS = {
  spade: '♠',
  heart: '♥',
  diamond: '♦',
  club: '♣',
};

export const SUIT_COLORS = {
  spade: 'black',
  club: 'black',
  heart: 'red',
  diamond: 'red',
};

// 2 = lowest, 14 = ace
export const CARD_VALUES = [
  { v: 2, l: '2' },
  { v: 3, l: '3' },
  { v: 4, l: '4' },
  { v: 5, l: '5' },
  { v: 6, l: '6' },
  { v: 7, l: '7' },
  { v: 8, l: '8' },
  { v: 9, l: '9' },
  { v: 10, l: '10' },
  { v: 11, l: 'J' },
  { v: 12, l: 'Q' },
  { v: 13, l: 'K' },
  { v: 14, l: 'A' },
];

export const TEAM_COLORS = ['var(--gold)', '#7ab8d4', '#c47ab8', '#b8c47a'];

// Build one or two full decks (no jokers)
export function buildDeck(deckCount = 1) {
  const deck = [];
  for (let d = 0; d < deckCount; d++) {
    for (const suit of SUITS) {
      for (const cv of CARD_VALUES) {
        deck.push({ value: cv.v, suit, deck_id: d });
      }
    }
  }
  return deck;
}

// Fisher-Yates shuffle — proper random ordering
export function shuffle(deck) {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Compare two players' card chains. Negative = a < b, positive = a > b.
// Walks both chains element-by-element. Used for seating order.
export function comparePlayerCards(aCards, bCards) {
  const len = Math.min(aCards.length, bCards.length);
  for (let i = 0; i < len; i++) {
    const diff = aCards[i].value - bCards[i].value;
    if (diff !== 0) return diff;
  }
  return aCards.length - bCards.length;
}

// Two seats are still tied if their card chains agree at every position
// up to the shorter chain's length.
//   A=[K]      B=[K, 7]   → tied (B has drawn tie-breaker, A hasn't yet)
//   A=[K, 2]   B=[K, 8]   → resolved (8 beats 2 at depth 1)
//   A=[K, 5]   B=[K, 5]   → still tied (need depth 2)
function sameTieLineage(a, b) {
  if (!a.length || !b.length) return false;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i].value !== b[i].value) return false;
  }
  return true;
}

// Find groups of seats whose card chains can't yet be ranked against each
// other. Returns array of arrays (each inner = the tied seats).
export function findTiedGroups(seats) {
  const picked = seats.filter((s) => s.cards && s.cards.length > 0);
  if (picked.length < 2) return [];

  const parent = {};
  picked.forEach((s) => { parent[s.player_id] = s.player_id; });

  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  function union(x, y) {
    const rx = find(x), ry = find(y);
    if (rx !== ry) parent[rx] = ry;
  }

  for (let i = 0; i < picked.length; i++) {
    for (let j = i + 1; j < picked.length; j++) {
      if (sameTieLineage(picked[i].cards, picked[j].cards)) {
        union(picked[i].player_id, picked[j].player_id);
      }
    }
  }

  const groups = {};
  picked.forEach((s) => {
    const root = find(s.player_id);
    (groups[root] = groups[root] || []).push(s);
  });
  return Object.values(groups).filter((g) => g.length > 1);
}

// Within a tied group, does this seat still need to draw a tie-breaker?
export function seatNeedsTieBreaker(seat, group) {
  const maxLen = Math.max(...group.map((s) => s.cards.length));
  if (seat.cards.length < maxLen) return true;
  const myKey = seat.cards.map((c) => c.value).join('-');
  return group.some(
    (other) =>
      other !== seat &&
      other.cards.length === maxLen &&
      other.cards.map((c) => c.value).join('-') === myKey
  );
}

// Are all ties resolved? (i.e. ready to seat everyone)
export function isFullyResolved(seats, playerCount) {
  if (seats.length < playerCount) return false;
  if (seats.some((s) => !s.cards || s.cards.length === 0)) return false;
  return findTiedGroups(seats).length === 0;
}

// Given a list of seats with resolved card chains, sort ascending and
// produce final seating + team assignments. Mutates seats array.
export function assignSeatsAndTeams(seats, mode) {
  // Sort lowest → highest (lowest gets seat 0 / "seat 1" in UI / leads)
  seats.sort((a, b) => comparePlayerCards(a.cards, b.cards));
  seats.forEach((s, i) => { s.seat_index = i; });

  if (mode !== 'team' || seats.length % 2 !== 0) {
    seats.forEach((s) => {
      s.team_id = null;
      s.team_palette_idx = null;
    });
    return seats;
  }

  // Partners sit across the circle (seat i + N/2)
  const N = seats.length;
  const half = N / 2;
  for (let i = 0; i < half; i++) {
    const teamId = `t${i}`;
    seats[i].team_id = teamId;
    seats[i].team_palette_idx = i;
    seats[i + half].team_id = teamId;
    seats[i + half].team_palette_idx = i;
  }
  return seats;
}

// Deck-count rules per player count (Phase 2 follow-up A)
export function deckOptionsForPlayerCount(n) {
  if (n <= 4) return [1];
  if (n <= 7) return [1, 2];
  return [2];
}

export function defaultDeckCountForPlayerCount(n) {
  if (n <= 4) return 1;
  if (n <= 7) return 2;
  return 2;
}

// Max rounds = floor(totalCards / playerCount)
export function maxRoundsFor(playerCount, deckCount) {
  const totalCards = deckCount * 52;
  return Math.floor(totalCards / playerCount);
}

// Generate a short ID
export function uid() {
  return Math.random().toString(36).slice(2, 12);
}

// Scoring (matches V1 rules)
export function calcScore(bid, won, rules = {}) {
  const winPoints = rules.pointsPerTrick ?? 10;
  const missedPenalty = rules.penaltyPerMissed ?? 10;
  const extraPenalty = rules.nilBidPenaltyPerTrick ?? 5;

  if (bid === 0 && won === 0) return 0;
  if (won === bid) return bid * winPoints;
  if (won < bid) {
    return won * winPoints - (bid - won) * missedPenalty;
  }
  return bid * winPoints - (won - bid) * extraPenalty;
}

// Card label helpers
export function cardLabel(card) {
  if (!card) return '—';
  const cv = CARD_VALUES.find((x) => x.v === card.value);
  const ss = SUIT_SYMBOLS[card.suit];
  return `${cv?.l ?? card.value}${ss ?? ''}`;
}

export function cardRankLabel(card) {
  if (!card) return '';
  const cv = CARD_VALUES.find((x) => x.v === card.value);
  return cv?.l ?? String(card.value);
}

export function suitSymbol(suit) {
  return SUIT_SYMBOLS[suit] ?? '';
}

export function suitColor(suit) {
  return SUIT_COLORS[suit] ?? 'black';
}

// Compact key for grouping tied chains (used for display)
export function rankChainKey(cards) {
  return (cards || []).map((c) => c.value).join('-');
}

// ─────────────────────────────────────────────────────────
// Phase 3 helpers — bidding & dealing
// ─────────────────────────────────────────────────────────

// Which seat starts the bidding for a given round (rotates clockwise).
// Round 1 → seat 0, round 2 → seat 1, round 3 → seat 2, etc.
export function bidStarterSeatFor(roundNum, playerCount) {
  return ((roundNum - 1) % playerCount);
}

// In team mode, get team_id for the seat that's bidding first
export function startingTeamId(seats, starterSeatIndex) {
  const starter = seats.find((s) => s.seat_index === starterSeatIndex);
  return starter?.team_id ?? null;
}

// Group all seats by team_id → { teamId: [seat1, seat2], ... }
export function groupSeatsByTeam(seats) {
  const groups = {};
  for (const s of seats) {
    if (s.team_id == null) continue;
    if (!groups[s.team_id]) groups[s.team_id] = [];
    groups[s.team_id].push(s);
  }
  // Sort each team's seats by seat_index
  for (const k of Object.keys(groups)) {
    groups[k].sort((a, b) => a.seat_index - b.seat_index);
  }
  return groups;
}

// Get the bidding order of teams: starting team first, then clockwise next team, etc.
// Returns array of team_ids in bidding order.
export function teamBiddingOrder(seats, starterSeatIndex) {
  const N = seats.length;
  const seenTeams = new Set();
  const order = [];
  // Walk clockwise from the starter, adding each team's id the first time we see it
  for (let i = 0; i < N; i++) {
    const seatIndex = (starterSeatIndex + i) % N;
    const seat = seats.find((s) => s.seat_index === seatIndex);
    if (!seat || seat.team_id == null) continue;
    if (!seenTeams.has(seat.team_id)) {
      seenTeams.add(seat.team_id);
      order.push(seat.team_id);
    }
  }
  return order;
}

// In individual mode: bidding goes seat by seat clockwise from starter.
// Returns array of seat_indexes in bidding order.
export function individualBiddingOrder(seats, starterSeatIndex) {
  const N = seats.length;
  return Array.from({ length: N }, (_, i) => (starterSeatIndex + i) % N);
}

// Deal cards for a round.
// Returns: { hands: { playerId: [card, card, ...], ... } }
// Each player gets `cardsPerPlayer` cards from a fresh shuffle of `deckCount` decks.
export function dealRound(seats, cardsPerPlayer, deckCount) {
  const deck = shuffle(buildDeck(deckCount));
  const hands = {};
  let cursor = 0;
  for (const seat of seats) {
    hands[seat.player_id] = deck.slice(cursor, cursor + cardsPerPlayer);
    cursor += cardsPerPlayer;
  }
  return hands;
}
// ─────────────────────────────────────────────────────────
// Phase 4 helpers — trick play
// ─────────────────────────────────────────────────────────

// Given the leader's seat and how many seats total, return the order players play in this trick
export function trickPlayOrder(leaderSeatIndex, playerCount) {
  return Array.from({ length: playerCount }, (_, i) => (leaderSeatIndex + i) % playerCount);
}

// Determine which cards a player is ALLOWED to play, given the current trick state
// Returns a set of card indices (into the player's hand) they can legally play.
// Rule: if a suit was led and you have any of that suit, you MUST play it.
// Otherwise you can play anything.
export function legalCardIndices(hand, currentTrick) {
  if (!hand || hand.length === 0) return new Set();
  if (currentTrick.length === 0) {
    // Leader can play any card (no spades-broken rule)
    return new Set(hand.map((_, i) => i));
  }
  const ledSuit = currentTrick[0].card.suit;
  const hasLedSuit = hand.some((c) => c.suit === ledSuit);
  if (!hasLedSuit) {
    return new Set(hand.map((_, i) => i));
  }
  // Must follow suit
  const allowed = new Set();
  hand.forEach((c, i) => { if (c.suit === ledSuit) allowed.add(i); });
  return allowed;
}

// Determine the winner of a completed trick.
// currentTrick: array in PLAY ORDER (leader's card first)
// Each entry: { player_id, seat_index, card }
// Rule:
//   1. If any spade was played → highest-ranked spade wins (ties → later-played wins)
//   2. Else → highest card of LED suit wins (ties → later-played wins)
// Returns the winning entry.
export function determineTrickWinner(currentTrick) {
  if (!currentTrick || currentTrick.length === 0) return null;

  const spades = currentTrick
    .map((entry, playIndex) => ({ ...entry, playIndex }))
    .filter((e) => e.card.suit === 'spade');

  if (spades.length > 0) {
    // Highest spade. Ties → later-played (highest playIndex).
    let winner = spades[0];
    for (const s of spades) {
      if (s.card.value > winner.card.value) winner = s;
      else if (s.card.value === winner.card.value && s.playIndex > winner.playIndex) winner = s;
    }
    return winner;
  }

  const ledSuit = currentTrick[0].card.suit;
  const ledSuited = currentTrick
    .map((entry, playIndex) => ({ ...entry, playIndex }))
    .filter((e) => e.card.suit === ledSuit);

  let winner = ledSuited[0];
  for (const s of ledSuited) {
    if (s.card.value > winner.card.value) winner = s;
    else if (s.card.value === winner.card.value && s.playIndex > winner.playIndex) winner = s;
  }
  return winner;
}

// ──────────────────────────────────────────────────────────
// Direction helpers — for ascending (1→N) or descending (N→1) round counts
// ──────────────────────────────────────────────────────────

/**
 * Returns the number of cards dealt in a given round, accounting for direction.
 * - Ascending: Round 1 = 1 card, Round 2 = 2 cards, ..., Round N = N cards
 * - Descending: Round 1 = max cards, Round 2 = max-1 cards, ..., Round N = 1 card
 */
export function cardsForRound(roundNum, maxRounds, direction = 'asc') {
  if (direction === 'desc') return maxRounds - roundNum + 1;
  return roundNum;
}