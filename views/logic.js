import { $, html, escapeHtml, setChip, presets, tex, token, debounce, fitCanvas } from '../shared.js';
import { truthTable } from './representations.js';

const LOGIC = [
  { label: 'Redundant', formula: '(a and b) or (a and not b) or (c and a)',
    note: 'Three terms that say only “a”. AngouriMath and the Karnaugh map both find it.' },
  { label: 'Majority', formula: '(a and b) or (b and c) or (a and c)', note: 'True when at least two of three are true.' },
  { label: 'Parity', formula: 'a xor b xor c', note: 'A checkerboard on the map: no two true cells touch, so nothing groups.' },
  { label: 'Four inputs', formula: '(a and not c) or (b and c and d) or (not a and not b and not d) or (a and b and c)',
    note: 'Groups that wrap around the edges of the map, which is a torus.' },
  { label: 'Syllogism', formula: '((a implies b) and (b implies c)) implies (a implies c)', note: 'A tautology: true in every row.' },
  { label: 'Knights and knaves', puzzle: ['A', 'B'],
    formula: 'not (A xor not B) and not (B xor not (A xor B))',
    note: 'A says “B is a knave.” B says “A and I are of the same kind.” Knights always tell the truth and knaves always lie, so “X says S” means X and S have the same truth value: not (X xor S).' },
  { label: 'Three islanders', puzzle: ['A', 'B', 'C'],
    formula: 'not (A xor (not A and not B and not C)) and not (B xor ((A and not B and not C) or (not A and B and not C) or (not A and not B and C)))',
    note: 'A says “We are all knaves.” B says “Exactly one of us is a knight.” C says nothing.' },
];

const SETS = [
  { label: '(A ∪ B) ∩ C', formula: '(A \\/ B) /\\ C' },
  { label: 'Symmetric difference', formula: '(A \\ B) \\/ (B \\ A)', note: 'AngouriMath simplifies the logic to A xor B.' },
  { label: 'All three', formula: 'A /\\ B /\\ C' },
  { label: 'In exactly one', formula: '(A \\ (B \\/ C)) \\/ (B \\ (A \\/ C)) \\/ (C \\ (A \\/ B))' },
  { label: 'De Morgan', formula: 'A \\ (B \\/ C)', note: 'Read as logic: a and not (b or c), which is a and not b and not c.' },
];

const SENSES = [
  { label: 'Two standards, one window', formula: 'Closed_window or (Open_window and Unoccupied)',
    note: 'One sensor speaks KNX DPT 1.009, where 1 means closed, another DPT 1.019, where 1 means open. They describe one window, so they are one letter, and the answer comes back in senses instead of with a not.' },
  { label: 'Dry-run protection', formula: 'Running_pump and (NotEmpty_tank or Full_tank)',
    note: 'A full tank is not empty. That is a fact about tanks, not about logic, so AngouriMath’s simplification keeps the Full test; the catalogue knows it, and the minimal form drops it.' },
  { label: 'Interlock', formula: 'Enabled_motor and Running_motor and not Fault_motor', always: 'Running_motor implies Enabled_motor',
    note: 'A motor runs only when it is enabled, so testing Enabled as well is redundant, and seeing it run while disabled means a signal is wrong.' },
  { label: 'Held up', formula: 'Up and not Held and not Falling', always: '(Up and not Falling) implies Held',
    note: 'Something up that is not falling is held up by something. The formula asks for a row that cannot happen, so with good sensors it never fires, and that same row is the fault alarm.' },
  { label: 'Annunciate', formula: 'Alarm and Unacknowledged and not Shelved and not Suppressed',
    note: 'ANSI/ISA-18.2 keeps acknowledgement, shelving and suppression on channels of their own beside the alarm. Each not comes back as the opposite sense.' },
];

const MODES = { logic: 'Logic', sets: 'Sets', senses: 'Senses' };

const MARKUP = `
<div class="doc-inner">
  <div class="doc-head">
    <div>
      <p class="eyebrow">Boolean algebra, sets and logic puzzles</p>
      <h1>Logic</h1>
    </div>
    <p class="lede">A formula in true-or-false variables, or a formula in sets: AngouriMath builds the truth table and simplifies it, a Karnaugh map finds the minimal sum of products, and AngouriMath checks every rewrite is equivalent by comparing truth tables.</p>
    <div class="presets" role="group" aria-label="Mode" data-modes></div>
    <div class="formula"><span aria-hidden="true" data-prefix>ƒ</span><input id="logic-input" aria-label="Formula" spellcheck="false" autocomplete="off" autocapitalize="off"></div>
    <div class="formula" data-always-row hidden><span aria-hidden="true">always</span><input id="logic-always" aria-label="Invariants: facts that always hold, separated by semicolons" placeholder="facts that always hold, separated by semicolons" spellcheck="false" autocomplete="off" autocapitalize="off"></div>
    <div class="presets" role="group" aria-label="Examples" data-presets></div>
    <p class="note" data-note></p>
    <div class="status"><span class="chip" data-chip>Waiting for AngouriMath</span><span class="timing" data-timing></span></div>
    <p class="error" data-error></p>
  </div>
  <div class="cards">
    <article class="card" data-puzzle hidden><h3>Answer</h3><div data-answer></div></article>
    <article class="card" data-venn-card hidden><h3>Venn diagram</h3><canvas data-venn style="height:300px"></canvas><p class="foot" data-sets></p></article>
    <article class="card wide" data-senses-card hidden><h3>Senses</h3><div class="scroll-x" data-senses></div><p class="foot">One letter per channel, named after its true sense; the opposite sense is its negation. Pairs and sources from the LogicState catalogue.</p></article>
    <article class="card"><h3>The formula</h3><div class="tex" data-latex></div><div data-letters hidden><p class="foot">In letters:</p><div class="tex" data-letters-tex></div></div></article>
    <article class="card"><h3>Simplified by AngouriMath</h3><div class="tex" data-simplified></div><p class="foot" data-simplified-check></p></article>
    <article class="card"><h3 data-sop-title>Minimal sum of products</h3><div class="tex" data-sop></div><p class="foot" data-sop-check></p></article>
    <article class="card" data-rules-card hidden><h3>Invariants and the fault alarm</h3><div data-rules></div></article>
    <article class="card" data-kmap-card><h3>Karnaugh map</h3><div class="scroll-x" data-kmap></div><p class="foot" data-kmap-note></p></article>
    <article class="card"><h3>Truth table</h3><div data-truth></div></article>
    <article class="card wide"><h3 data-circuit-title>Circuit for the simplified form</h3><div class="scroll-x" data-circuit></div></article>
  </div>
</div>`;

export function mount(section, am) {
  section.classList.add('doc');
  html(section, MARKUP);
  const input = $(section, '#logic-input'), always = $(section, '#logic-always'), chip = $(section, '[data-chip]'), note = $(section, '[data-note]');
  let mode = 'logic', current = null;

  const pressMode = presets($(section, '[data-modes]'), Object.values(MODES).map((label) => ({ label })),
    (m) => setMode(Object.keys(MODES).find((k) => MODES[k] === m.label)));
  let press = () => {};
  function setMode(m) {
    mode = m;
    pressMode(MODES[m]);
    $(section, '[data-prefix]').textContent = m === 'sets' ? 'S =' : 'ƒ';
    $(section, '[data-always-row]').hidden = m !== 'senses';
    const list = m === 'sets' ? SETS : m === 'senses' ? SENSES : LOGIC;
    press = presets($(section, '[data-presets]'), list, pick);
    pick(list[0]);
  }
  function pick(p) {
    current = p;
    input.value = p.formula;
    always.value = p.always || '';
    note.textContent = p.note || '';
    press(p.label);
    analyze();
  }
  const later = debounce(() => { current = null; analyze(); }, 450);
  for (const field of [input, always])
    field.addEventListener('input', () => { press(null); note.textContent = ''; later(); });

  let generation = 0;
  async function analyze() {
    const mine = ++generation, t0 = performance.now();
    let r;
    try {
      r = mode === 'senses'
        ? await am.json('LogicJs', 'Senses', [input.value, always.value])
        : await am.json('LogicJs', mode === 'sets' ? 'Venn' : 'Analyze', [input.value]);
    } catch (e) {
      if (mine === generation) { setChip(chip, 'bad', 'AngouriMath stopped'); $(section, '[data-error]').textContent = e.message; }
      return;
    }
    if (mine !== generation) return;
    $(section, '[data-timing]').textContent = `${Math.round(performance.now() - t0)} ms`;
    if (!r.ok) { setChip(chip, 'warn', 'Not a formula yet'); $(section, '[data-error]').textContent = r.error; return; }
    $(section, '[data-error]').textContent = '';
    const vars = r.truth.vars, rows = r.truth.rows, senses = mode === 'senses';
    const possible = r.truth.possible || rows.map(() => true), can = possible.filter(Boolean).length;
    const count = rows.filter((row, i) => possible[i] && row[row.length - 1]).length;
    const every = can === rows.length, where = every ? '' : ' that can occur';
    setChip(chip, 'ok', count === can ? (every ? 'Always true' : 'True in every row that can occur')
      : count === 0 ? (every ? 'Never true' : 'Never true in a row that can occur') : `True in ${count} of ${can} rows${where}`);
    tex($(section, '[data-latex]'), r.latex);
    $(section, '[data-letters]').hidden = !senses;
    if (senses) tex($(section, '[data-letters-tex]'), r.lettersLatex);
    tex($(section, '[data-simplified]'), r.simplifiedLatex);
    $(section, '[data-simplified-check]').textContent = !r.simplifiedEquivalent ? 'Not shown equivalent.'
      : `✓ Equivalent: AngouriMath’s truth table of (formula xor simplified) has no true row.${senses ? ' AngouriMath knows the logic but not the invariants.' : ''}`;
    $(section, '[data-sop-title]').textContent = senses ? 'Minimal, using the invariants' : 'Minimal sum of products';
    tex($(section, '[data-sop]'), r.sopLatex);
    $(section, '[data-sop-check]').textContent = !r.sopEquivalent ? 'Not shown equivalent.' : senses
      ? '✓ Equal to the formula wherever the invariants hold: AngouriMath’s truth table of (formula xor minimal) and invariants has no true row. Found by Quine–McCluskey, with the rows that cannot occur as don’t-cares.'
      : '✓ Equivalent, checked the same way. Found by Quine–McCluskey with an exact cover.';
    $(section, '[data-truth]').replaceChildren(truthTable(r.truth));
    $(section, '[data-kmap-card]').hidden = vars.length > 4;
    if (vars.length <= 4) kmap($(section, '[data-kmap]'), vars, rows, r.groups, r.dontCares);
    $(section, '[data-kmap-note]').textContent = (r.groups.length ? 'Each outline is one product term of the minimal sum; outlines that reach an edge continue on the opposite side.' : '')
      + (r.dontCares?.length ? ' A dash is a row the invariants rule out, so an outline may cover it or not.' : '');
    $(section, '[data-circuit-title]').textContent = senses ? 'Circuit for the minimal form, each input in the sense it needs' : 'Circuit for the simplified form';
    circuit($(section, '[data-circuit]'), r.circuit);

    $(section, '[data-senses-card]').hidden = !senses;
    $(section, '[data-rules-card]').hidden = !senses;
    if (senses) {
      $(section, '[data-senses]').innerHTML = sensesTable(r.senses);
      rules($(section, '[data-rules]'), r);
    }

    const puzzle = current?.puzzle;
    $(section, '[data-puzzle]').hidden = !puzzle;
    if (puzzle) {
      const answers = rows.filter((row) => row[row.length - 1]).map((row) =>
        vars.map((v, i) => `${v} is a ${row[i] ? 'knight' : 'knave'}`).join(', '));
      $(section, '[data-answer]').innerHTML = answers.length === 1
        ? `<p style="margin:0;font-size:16px">${escapeHtml(answers[0])}.</p><p class="foot">The only row of the truth table where everything said is consistent.</p>`
        : answers.length === 0 ? '<p style="margin:0">No assignment is consistent: the puzzle has no solution.</p>'
          : `<p style="margin:0">${answers.length} consistent answers:</p><ul>${answers.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>`;
    }
    $(section, '[data-venn-card]').hidden = mode !== 'sets';
    if (mode === 'sets') {
      venn($(section, '[data-venn]'), vars, rows);
      $(section, '[data-sets]').textContent = `As sets: ${r.sets}${r.simplifiedSets && r.simplifiedSets !== r.sets ? `, which simplifies to ${r.simplifiedSets}` : ''}.`;
    }
  }

  setMode('logic');
  return { show() {}, hide() {} };
}

// ---------------------------------------------------------------- senses

function sensesTable(list) {
  const body = list.map((s) => `<tr><td>${escapeHtml(s.word)}</td><td>${s.negated ? 'not ' : ''}${escapeHtml(s.letter)}</td>`
    + (s.pair ? `<td>${escapeHtml(s.pair)}</td><td>${escapeHtml(s.source || '')}</td>` : '<td colspan="2">not in the catalogue: a letter of its own</td>')
    + '</tr>').join('');
  return `<table class="senses"><thead><tr><th>written</th><th>reads as</th><th>pair</th><th>source</th></tr></thead><tbody>${body}</tbody></table>`;
}

function rules(box, r) {
  box.replaceChildren();
  if (!r.rules.length) {
    box.innerHTML = '<p class="foot" style="margin-top:0">None: every row can occur. Facts about the plant go in the always field, separated by semicolons, for example Running_motor implies Enabled_motor.</p>';
    return;
  }
  for (const rule of r.rules) {
    const item = document.createElement('div');
    item.innerHTML = `<div class="tex"></div><p class="foot">${rule.builtin ? `From the catalogue. ${escapeHtml(rule.why)}` : 'Yours.'}</p>`;
    tex(item.firstElementChild, rule.latex);
    box.append(item);
  }
  const fault = document.createElement('div');
  fault.innerHTML = '<p class="foot" style="font-weight:600;color:var(--ink)">Fault alarm</p><div class="tex"></div><p class="foot"></p>';
  tex(fault.children[1], r.faultLatex);
  fault.children[2].textContent = r.faultNever ? 'The invariants hold in every row, so they rule nothing out and nothing can contradict them.'
    : `True exactly in the rows the invariants rule out, so with correct signals it never fires: when it does, a sensor or its wiring is wrong.${r.faultEquivalent ? ' ✓ Equivalent to not (invariants), checked by truth table.' : ''}`;
  box.append(fault);
}

// ---------------------------------------------------------------- Karnaugh map

const GRAY = [[0], [0, 1], [0, 1, 3, 2]];

function kmap(box, vars, rows, groups, dontCares = []) {
  const n = vars.length, impossible = new Set(dontCares);
  const rowVars = n <= 1 ? 0 : n === 2 ? 1 : n === 3 ? 1 : 2, colVars = n - rowVars;
  const rowCodes = rowVars === 0 ? [0] : GRAY[rowVars], colCodes = colVars === 1 ? [0, 1] : GRAY[colVars];
  const minterm = (r, c) => (rowCodes[r] << colVars) | colCodes[c];
  const value = (m) => rows[m][n];
  // Letters label the corner as "ab \ cd"; names label the row codes and the column codes apart.
  const named = vars.some((v) => v.length > 1);
  const rowLabel = vars.slice(0, rowVars).join(named ? ', ' : ''), colLabel = vars.slice(rowVars).join(named ? ', ' : '');
  const C = 54, X0 = named ? Math.max(70, rowLabel.length * 7 + 16) : 70, Y0 = 46;
  const W = Math.max(X0 + colCodes.length * C + 16, named ? X0 + colCodes.length * C / 2 + colLabel.length * 3.5 + 8 : 0), H = Y0 + rowCodes.length * C + 16;
  const bits = (code, k) => code.toString(2).padStart(k, '0');
  const label = 'font-size="12" style="fill:var(--ink-soft)"';
  let svg = named
    ? `<text x="${X0 - 10}" y="${Y0 - 10}" ${label} text-anchor="end">${escapeHtml(rowLabel)}</text>`
      + `<text x="${X0 + colCodes.length * C / 2}" y="${Y0 - 28}" ${label} text-anchor="middle">${escapeHtml(colLabel)}</text>`
    : `<text x="${X0 - 10}" y="${Y0 - 26}" ${label} text-anchor="end">${escapeHtml(rowLabel)} \\ ${escapeHtml(colLabel)}</text>`;
  colCodes.forEach((code, c) => {
    svg += `<text x="${X0 + c * C + C / 2}" y="${Y0 - 10}" font-size="12" text-anchor="middle" style="fill:var(--ink-soft);font-family:var(--font-mono)">${bits(code, colVars)}</text>`;
  });
  rowCodes.forEach((code, r) => {
    if (rowVars) svg += `<text x="${X0 - 10}" y="${Y0 + r * C + C / 2 + 4}" font-size="12" text-anchor="end" style="fill:var(--ink-soft);font-family:var(--font-mono)">${bits(code, rowVars)}</text>`;
    colCodes.forEach((_, c) => {
      const m = minterm(r, c), v = !impossible.has(m) && value(m);
      const fill = impossible.has(m) ? 'color-mix(in srgb, var(--ink-soft) 12%, var(--surface))' : v ? 'color-mix(in srgb, var(--ok) 16%, var(--surface))' : 'var(--surface)';
      svg += `<rect x="${X0 + c * C}" y="${Y0 + r * C}" width="${C}" height="${C}" style="fill:${fill};stroke:var(--rule)"/>`;
      svg += `<text x="${X0 + c * C + C / 2}" y="${Y0 + r * C + C / 2 + 6}" font-size="17" text-anchor="middle" style="fill:${v ? 'var(--ok)' : 'var(--ink-soft)'};font-family:var(--font-mono)">${impossible.has(m) ? '–' : v ? 1 : 0}</text>`;
    });
  });
  // A group is a product of a cyclic run of rows and a cyclic run of columns; a run that wraps
  // is drawn as two pieces.
  const colours = ['--plot-1', '--plot-2', '--plot-3', '--plot-4', '--plot-5'];
  const runs = (indices, size) => {
    const set = new Set(indices);
    if (set.size === size) return [[0, size - 1]];
    let start = [...set].find((i) => !set.has((i - 1 + size) % size));
    const out = [];
    let a = start, b = start;
    while (set.has((b + 1) % size) && (b + 1) % size !== start) b = (b + 1) % size;
    if (b >= a) out.push([a, b]);
    else { out.push([a, size - 1]); out.push([0, b]); }
    return out;
  };
  groups.forEach((g, k) => {
    const covered = (m) => (m & g.mask) === g.value;
    const rs = [], cs = [];
    rowCodes.forEach((_, r) => { if (colCodes.some((__, c) => covered(minterm(r, c)))) rs.push(r); });
    colCodes.forEach((_, c) => { if (rowCodes.some((__, r) => covered(minterm(r, c)))) cs.push(c); });
    const inset = 5 + 4 * (k % 4);
    for (const [r0, r1] of runs(rs, rowCodes.length))
      for (const [c0, c1] of runs(cs, colCodes.length))
        svg += `<rect x="${X0 + c0 * C + inset}" y="${Y0 + r0 * C + inset}" width="${(c1 - c0 + 1) * C - 2 * inset}" height="${(r1 - r0 + 1) * C - 2 * inset}" rx="12" style="fill:none;stroke:var(${colours[k % colours.length]});stroke-width:2.5"/>`;
  });
  box.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Karnaugh map with the groups of the minimal sum of products">${svg}</svg>`;
}

// ---------------------------------------------------------------- circuit

function circuit(box, tree) {
  if (!tree) { box.textContent = ''; return; }
  const nodes = [];
  let leaves = 0, depth = 0;
  (function place(n, d) {
    depth = Math.max(depth, d);
    const node = { label: n.t, d, kids: (n.c || []).map((c) => place(c, d + 1)) };
    node.y = node.kids.length ? (node.kids[0].y + node.kids[node.kids.length - 1].y) / 2 : leaves++;
    // An input's box fits its name; the columns widen so a wire leaves it before turning.
    node.w = node.kids.length ? 44 : Math.max(36, n.t.length * 7 + 12);
    nodes.push(node);
    return node;
  })(tree, 0);
  const DX = Math.max(92, ...nodes.map((n) => n.w / 2 + 34)), DY = 46, W = (depth + 1) * DX + 80, H = Math.max(leaves, 1) * DY + 20;
  // The output is on the right, inputs on the left.
  const pos = (n) => [W - 60 - n.d * DX, n.y * DY + DY / 2 + 10];
  const stroke = 'stroke:var(--ink);stroke-width:1.6;fill:none';
  const body = 'stroke:var(--ink);stroke-width:1.6;fill:var(--surface)';
  let svg = '';
  for (const n of nodes)
    n.kids.forEach((k, i) => {
      const [x1, y1] = pos(n), [x2, y2] = pos(k);
      const inY = y1 + (n.kids.length > 1 ? (i - (n.kids.length - 1) / 2) * 10 : 0), mid = Math.max((x1 - 22 + x2 + 22) / 2, x2 + k.w / 2 + 10);
      svg += `<path d="M${x2 + (k.kids.length ? 22 : k.w / 2)} ${y2} H${mid} V${inY} H${x1 - 20}" style="${stroke}"/>`;
    });
  const [ox, oy] = pos(nodes[nodes.length - 1]);
  svg += `<path d="M${ox + 22} ${oy} H${ox + 46}" style="${stroke}"/><circle cx="${ox + 48}" cy="${oy}" r="3" style="fill:var(--ink)"/>`;
  for (const n of nodes) {
    const [x, y] = pos(n);
    if (!n.kids.length) {
      svg += `<rect x="${x - n.w / 2}" y="${y - 12}" width="${n.w}" height="24" rx="6" style="fill:var(--code);stroke:var(--rule)"/>`;
      svg += `<text x="${x}" y="${y + 4}" font-size="12" text-anchor="middle" style="fill:var(--ink);font-family:var(--font-mono)">${escapeHtml(n.label)}</text>`;
      continue;
    }
    const g = n.label;
    if (g === 'and') svg += `<path d="M${x - 20} ${y - 16} H${x} A16 16 0 0 1 ${x} ${y + 16} H${x - 20} Z" style="${body}"/>`;
    else if (g === 'or' || g === 'xor') {
      svg += `<path d="M${x - 20} ${y - 16} Q${x + 6} ${y - 16} ${x + 20} ${y} Q${x + 6} ${y + 16} ${x - 20} ${y + 16} Q${x - 10} ${y} ${x - 20} ${y - 16} Z" style="${body}"/>`;
      if (g === 'xor') svg += `<path d="M${x - 26} ${y - 16} Q${x - 16} ${y} ${x - 26} ${y + 16}" style="${stroke}"/>`;
    } else if (g === 'not') svg += `<path d="M${x - 18} ${y - 12} L${x + 12} ${y} L${x - 18} ${y + 12} Z" style="${body}"/><circle cx="${x + 16}" cy="${y}" r="4" style="${body}"/>`;
    else svg += `<rect x="${x - 20}" y="${y - 14}" width="42" height="28" rx="4" style="${body}"/><text x="${x + 1}" y="${y + 4}" font-size="11" text-anchor="middle" style="fill:var(--ink)">${escapeHtml(g === 'implies' ? '→' : g)}</text>`;
  }
  box.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gate circuit of the simplified formula, inputs on the left">${svg}</svg>`;
}

// ---------------------------------------------------------------- Venn diagram

function venn(canvas, vars, rows) {
  const [w, h] = fitCanvas(canvas, 2);
  const ctx = canvas.getContext('2d'), s = w / canvas.clientWidth;
  const r = Math.min(w, h) * 0.27, cx = w / 2, cy = h / 2 + r * 0.08;
  const circles = vars.length === 1 ? [[cx, cy]]
    : vars.length === 2 ? [[cx - r * 0.55, cy], [cx + r * 0.55, cy]]
      : [[cx - r * 0.55, cy - r * 0.35], [cx + r * 0.55, cy - r * 0.35], [cx, cy + r * 0.6]];
  const img = ctx.createImageData(w, h), fill = token('--plot-1'), bg = token('--surface');
  const parse = (c) => { const p = document.createElement('span'); p.style.color = c; document.body.append(p); const m = getComputedStyle(p).color.match(/[\d.]+/g).map(Number); p.remove(); return m; };
  const on = parse(fill), off = parse(bg);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let index = 0;
      circles.forEach(([px, py], i) => { if ((x - px) ** 2 + (y - py) ** 2 <= r * r) index |= 1 << (vars.length - 1 - i); });
      const lit = rows[index][vars.length];
      const c = lit ? on : off, k = (y * w + x) * 4;
      img.data[k] = lit ? c[0] * 0.45 + off[0] * 0.55 : c[0];
      img.data[k + 1] = lit ? c[1] * 0.45 + off[1] * 0.55 : c[1];
      img.data[k + 2] = lit ? c[2] * 0.45 + off[2] * 0.55 : c[2];
      img.data[k + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = token('--rule');
  ctx.lineWidth = 1.5 * s;
  ctx.strokeRect(0.5 * s, 0.5 * s, w - s, h - s);
  ctx.strokeStyle = token('--ink');
  ctx.lineWidth = 2 * s;
  ctx.fillStyle = token('--ink');
  ctx.font = `italic ${18 * s}px ${token('--font-display')}`;
  const labels = [[-1.05, -0.95], [1.05, -0.95], [0, 1.25]];
  circles.forEach(([px, py], i) => {
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.stroke();
    const [lx, ly] = vars.length === 1 ? [0, -1.2] : labels[i];
    ctx.fillText(vars[i], px + lx * r * 0.85 - 6 * s, py + ly * r * 0.85 + 6 * s);
  });
}
