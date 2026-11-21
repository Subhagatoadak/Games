/*
 * Chess rules engine + simple AI.
 * Squares are indexed 0..63: index = rank * 8 + file, a1 = 0, h8 = 63.
 * Loaded as a classic script (exposes window.Chess) so the game works from file://,
 * and as a CommonJS module for Node-based tests.
 */
(function (global) {
  'use strict';

  const FILES = 'abcdefgh';
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  const KNIGHT = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
  const KING = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

  const other = (c) => (c === 'w' ? 'b' : 'w');
  const sqName = (i) => FILES[i & 7] + ((i >> 3) + 1);
  const sqIndex = (name) => (+name[1] - 1) * 8 + FILES.indexOf(name[0]);

  // Returns undefined when off-board, null when empty, piece otherwise.
  function at(board, f, r) {
    return f >= 0 && f < 8 && r >= 0 && r < 8 ? board[r * 8 + f] : undefined;
  }

  // ---------------------------------------------------------------- state

  function fromFEN(fen) {
    const [placement, turn = 'w', castle = '-', ep = '-', half = '0', full = '1'] = fen.trim().split(/\s+/);
    const board = new Array(64).fill(null);
    placement.split('/').forEach((row, r) => {
      let f = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) f += +ch;
        else {
          board[(7 - r) * 8 + f] = { type: ch.toLowerCase(), color: ch === ch.toUpperCase() ? 'w' : 'b' };
          f++;
        }
      }
    });
    const s = {
      board,
      turn,
      castling: { K: castle.includes('K'), Q: castle.includes('Q'), k: castle.includes('k'), q: castle.includes('q') },
      ep: ep !== '-' ? sqIndex(ep) : -1,
      halfmove: +half,
      fullmove: +full,
      captured: { w: [], b: [] }, // pieces of each colour that have been captured
      history: [],
    };
    s.history.push(positionKey(s));
    return s;
  }

  function newGame() {
    return fromFEN(START_FEN);
  }

  function clone(s, fast) {
    return {
      board: s.board.slice(),
      turn: s.turn,
      castling: { ...s.castling },
      ep: s.ep,
      halfmove: s.halfmove,
      fullmove: s.fullmove,
      captured: fast ? s.captured : { w: s.captured.w.slice(), b: s.captured.b.slice() },
      history: fast ? s.history : s.history.slice(),
    };
  }

  function positionKey(s) {
    let k = '';
    for (const p of s.board) k += p ? (p.color === 'w' ? p.type.toUpperCase() : p.type) : '.';
    const c = s.castling;
    return k + s.turn + (c.K ? 'K' : '') + (c.Q ? 'Q' : '') + (c.k ? 'k' : '') + (c.q ? 'q' : '') + s.ep;
  }

  // ---------------------------------------------------------------- attacks

  function isAttacked(board, sq, by) {
    const f = sq & 7, r = sq >> 3;
    const dir = by === 'w' ? 1 : -1;
    for (const df of [-1, 1]) {
      const p = at(board, f + df, r - dir);
      if (p && p.color === by && p.type === 'p') return true;
    }
    for (const [df, dr] of KNIGHT) {
      const p = at(board, f + df, r + dr);
      if (p && p.color === by && p.type === 'n') return true;
    }
    for (const [df, dr] of KING) {
      const p = at(board, f + df, r + dr);
      if (p && p.color === by && p.type === 'k') return true;
    }
    const ray = (dirs, a, b) => {
      for (const [df, dr] of dirs) {
        let x = f + df, y = r + dr;
        for (;;) {
          const p = at(board, x, y);
          if (p === undefined) break;
          if (p) {
            if (p.color === by && (p.type === a || p.type === b)) return true;
            break;
          }
          x += df; y += dr;
        }
      }
      return false;
    };
    return ray(ROOK_DIRS, 'r', 'q') || ray(BISHOP_DIRS, 'b', 'q');
  }

  function kingSquare(board, color) {
    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (p && p.type === 'k' && p.color === color) return i;
    }
    return -1;
  }

  function inCheck(s, color = s.turn) {
    return isAttacked(s.board, kingSquare(s.board, color), other(color));
  }

  // ---------------------------------------------------------------- moves

  function pseudoMoves(s, from) {
    const b = s.board, p = b[from], moves = [];
    const f = from & 7, r = from >> 3;
    const add = (to, extra) =>
      moves.push(Object.assign({ from, to, piece: p.type, color: p.color, captured: b[to] ? b[to].type : null }, extra));

    if (p.type === 'p') {
      const dir = p.color === 'w' ? 1 : -1;
      const startR = p.color === 'w' ? 1 : 6;
      const lastR = p.color === 'w' ? 7 : 0;
      const push = (to, extra) => {
        if (to >> 3 === lastR) for (const promo of ['q', 'r', 'b', 'n']) add(to, { ...extra, promo });
        else add(to, extra);
      };
      if (at(b, f, r + dir) === null) {
        push((r + dir) * 8 + f);
        if (r === startR && at(b, f, r + 2 * dir) === null) add((r + 2 * dir) * 8 + f, { double: true });
      }
      for (const df of [-1, 1]) {
        const t = at(b, f + df, r + dir);
        const to = (r + dir) * 8 + f + df;
        if (t && t.color !== p.color) push(to);
        else if (t === null && s.ep === to) add(to, { ep: true, captured: 'p' });
      }
    } else if (p.type === 'n' || p.type === 'k') {
      for (const [df, dr] of p.type === 'n' ? KNIGHT : KING) {
        const t = at(b, f + df, r + dr);
        if (t === null || (t && t.color !== p.color)) add((r + dr) * 8 + f + df);
      }
      if (p.type === 'k') {
        const home = p.color === 'w' ? 0 : 56;
        const opp = other(p.color);
        const [kR, qR] = p.color === 'w' ? ['K', 'Q'] : ['k', 'q'];
        const isRook = (sq) => b[sq] && b[sq].type === 'r' && b[sq].color === p.color;
        if (from === home + 4 && !isAttacked(b, from, opp)) {
          if (s.castling[kR] && isRook(home + 7) && !b[home + 5] && !b[home + 6] && !isAttacked(b, home + 5, opp))
            add(home + 6, { castle: 'K' });
          if (s.castling[qR] && isRook(home) && !b[home + 1] && !b[home + 2] && !b[home + 3] && !isAttacked(b, home + 3, opp))
            add(home + 2, { castle: 'Q' });
        }
      }
    } else {
      const dirs = p.type === 'r' ? ROOK_DIRS : p.type === 'b' ? BISHOP_DIRS : KING;
      for (const [df, dr] of dirs) {
        let x = f + df, y = r + dr;
        for (;;) {
          const t = at(b, x, y);
          if (t === undefined) break;
          if (t) {
            if (t.color !== p.color) add(y * 8 + x);
            break;
          }
          add(y * 8 + x);
          x += df; y += dr;
        }
      }
    }
    return moves;
  }

  // Board after a move (pieces only).
  function boardAfter(board, m) {
    const b = board.slice();
    const p = b[m.from];
    if (m.ep) b[m.to + (p.color === 'w' ? -8 : 8)] = null;
    b[m.to] = m.promo ? { type: m.promo, color: p.color } : p;
    b[m.from] = null;
    if (m.castle) {
      const home = m.from - 4;
      if (m.castle === 'K') { b[home + 5] = b[home + 7]; b[home + 7] = null; }
      else { b[home + 3] = b[home]; b[home] = null; }
    }
    return b;
  }

  function legalMoves(s, from) {
    const out = [];
    const squares = from === undefined ? [...Array(64).keys()] : [from];
    for (const sq of squares) {
      const p = s.board[sq];
      if (!p || p.color !== s.turn) continue;
      for (const m of pseudoMoves(s, sq)) {
        const b = boardAfter(s.board, m);
        const k = m.piece === 'k' ? m.to : kingSquare(b, s.turn);
        if (!isAttacked(b, k, other(s.turn))) out.push(m);
      }
    }
    return out;
  }

  // fast = skip bookkeeping not needed during search (captures list, repetition history)
  function applyMove(s, m, fast) {
    const n = clone(s, fast);
    const p = s.board[m.from];
    const opp = other(p.color);
    if (!fast && m.captured) n.captured[opp].push(m.captured);
    n.board = boardAfter(s.board, m);

    const c = n.castling;
    if (p.type === 'k') {
      if (p.color === 'w') c.K = c.Q = false;
      else c.k = c.q = false;
    }
    for (const sq of [m.from, m.to]) {
      if (sq === 0) c.Q = false;
      if (sq === 7) c.K = false;
      if (sq === 56) c.q = false;
      if (sq === 63) c.k = false;
    }
    n.ep = m.double ? (m.from + m.to) / 2 : -1;
    n.halfmove = p.type === 'p' || m.captured ? 0 : s.halfmove + 1;
    if (p.color === 'b') n.fullmove++;
    n.turn = opp;
    if (!fast) n.history.push(positionKey(n));
    return n;
  }

  // ---------------------------------------------------------------- game status

  function insufficientMaterial(board) {
    const pieces = [];
    board.forEach((p, i) => { if (p && p.type !== 'k') pieces.push({ ...p, sq: i }); });
    if (pieces.length === 0) return true;
    if (pieces.length === 1 && (pieces[0].type === 'n' || pieces[0].type === 'b')) return true;
    if (pieces.every((p) => p.type === 'b')) {
      const shade = (sq) => ((sq & 7) + (sq >> 3)) & 1;
      return pieces.every((p) => shade(p.sq) === shade(pieces[0].sq));
    }
    return false;
  }

  /** Returns { state: 'normal'|'check'|'checkmate'|'stalemate'|'fifty'|'repetition'|'insufficient', winner?, over } */
  function status(s) {
    const check = inCheck(s);
    if (legalMoves(s).length === 0) {
      return check
        ? { state: 'checkmate', winner: other(s.turn), over: true }
        : { state: 'stalemate', over: true };
    }
    if (s.halfmove >= 100) return { state: 'fifty', over: true };
    const last = s.history[s.history.length - 1];
    if (s.history.filter((k) => k === last).length >= 3) return { state: 'repetition', over: true };
    if (insufficientMaterial(s.board)) return { state: 'insufficient', over: true };
    return { state: check ? 'check' : 'normal', over: false };
  }

  function toSAN(s, m, legal = legalMoves(s)) {
    let san;
    if (m.castle) san = m.castle === 'K' ? 'O-O' : 'O-O-O';
    else if (m.piece === 'p') {
      san = (m.captured ? FILES[m.from & 7] + 'x' : '') + sqName(m.to) + (m.promo ? '=' + m.promo.toUpperCase() : '');
    } else {
      const rivals = legal.filter((o) => o.piece === m.piece && o.to === m.to && o.from !== m.from);
      let dis = '';
      if (rivals.length) {
        const sameFile = rivals.some((o) => (o.from & 7) === (m.from & 7));
        const sameRank = rivals.some((o) => o.from >> 3 === m.from >> 3);
        dis = !sameFile ? FILES[m.from & 7] : !sameRank ? String((m.from >> 3) + 1) : sqName(m.from);
      }
      san = m.piece.toUpperCase() + dis + (m.captured ? 'x' : '') + sqName(m.to);
    }
    const n = applyMove(s, m, true);
    if (inCheck(n)) san += legalMoves(n).length ? '+' : '#';
    return san;
  }

  // ---------------------------------------------------------------- AI (negamax + alpha-beta)

  const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  // Piece-square tables, written from White's view with rank 8 on the first row.
  const PST = {
    p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
      0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10,
      20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
  };

  // Static evaluation from the side-to-move's perspective.
  function evaluate(s) {
    let score = 0;
    for (let i = 0; i < 64; i++) {
      const p = s.board[i];
      if (!p) continue;
      const idx = p.color === 'w' ? (7 - (i >> 3)) * 8 + (i & 7) : i;
      const v = VALUE[p.type] + PST[p.type][idx];
      score += p.color === 'w' ? v : -v;
    }
    return s.turn === 'w' ? score : -score;
  }

  const orderScore = (m) => (m.captured ? 10 * VALUE[m.captured] - VALUE[m.piece] + 10000 : 0) + (m.promo ? 8000 : 0);

  function negamax(s, depth, alpha, beta, ply) {
    const moves = legalMoves(s);
    if (moves.length === 0) return inCheck(s) ? -100000 + ply : 0;
    if (depth === 0) return evaluate(s);
    moves.sort((a, b) => orderScore(b) - orderScore(a));
    for (const m of moves) {
      const v = -negamax(applyMove(s, m, true), depth - 1, -beta, -alpha, ply + 1);
      if (v >= beta) return beta;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }

  function bestMove(s, depth = 2) {
    const moves = legalMoves(s);
    if (!moves.length) return null;
    // Shuffle first so equal-scoring moves vary between games, then order for pruning.
    for (let i = moves.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [moves[i], moves[j]] = [moves[j], moves[i]];
    }
    moves.sort((a, b) => orderScore(b) - orderScore(a));
    let best = moves[0], alpha = -Infinity;
    for (const m of moves) {
      const v = -negamax(applyMove(s, m, true), depth - 1, -Infinity, -alpha, 1);
      if (v > alpha) { alpha = v; best = m; }
    }
    return best;
  }

  // ---------------------------------------------------------------- exports

  function perft(s, depth) {
    if (depth === 0) return 1;
    let n = 0;
    for (const m of legalMoves(s)) n += perft(applyMove(s, m, true), depth - 1);
    return n;
  }

  const Chess = {
    START_FEN, newGame, fromFEN, legalMoves, applyMove, status, inCheck, kingSquare, toSAN, bestMove, perft, sqName, sqIndex, other,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Chess;
  else global.Chess = Chess;
})(typeof window !== 'undefined' ? window : globalThis);
