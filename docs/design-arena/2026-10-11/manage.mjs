import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const write = (name, value) => fs.writeFileSync(path.join(root, name), JSON.stringify(value, null, 2) + '\n');
const command = process.argv[2];
const personas = ['first-time user', 'experienced routine planner', 'distracted user', 'screen reader user', 'keyboard-only user', 'one-handed mobile user', 'large-text user', 'low-vision user', 'busy caregiver', 'shared-house organizer', 'time-constrained worker', 'weekly cleaner', 'monthly maintenance planner', 'shopping budget planner', 'user with many nested sections', 'person returning after missed periods', 'user reviewing historical work', 'user deciding by task duration', 'user with parallel tasks', 'user managing urgent deadlines', 'user preferring minimal interfaces', 'user preferring dense interfaces', 'user who needs visible reminders', 'person managing mixed recurrence lists', 'user browsing a small 320px screen'];
const lenses = ['action-first interaction', 'context-first information', 'progressive disclosure', 'adaptive visual hierarchy'];
const skills = ['frontend-design-direction', 'make-interfaces-feel-better', 'liquid-glass-design', 'frontend-a11y'];
if (command === 'cards') {
  write('cards.json', personas.flatMap((persona, p) => lenses.map((productPerspective, l) => ({ id: `i${String(p * 4 + l + 1).padStart(3, '0')}`, persona, productPerspective, reasoning: ['first principles', 'inversion', 'constraint-first', 'adversarial'][((p + l) % 4)], skill: skills[(p + l) % skills.length] }))));
} else if (command === 'merge') {
  const entries = ['ideas-a.json', 'ideas-b.json', 'ideas-c.json'].flatMap(read);
  if (entries.length !== 100 || new Set(entries.map(e => e.id)).size !== 100) throw Error('Expected 100 unique candidates');
  const cards = read('cards.json');
  const required = ['id', 'title', 'mechanism', 'visible', 'disclosed', 'access', 'benefit', 'risk', 'verification'];
  for (const e of entries) {
    if (!cards.some(card => card.id === e.id) || required.some(key => !e[key] || typeof e[key] !== 'string')) throw Error(`Invalid ${e.id}`);
  }
  if (new Set(entries.map(e => e.mechanism.toLowerCase().trim())).size !== 100) throw Error('Duplicate mechanisms');
  write('candidates.json', entries.sort((a,b) => a.id.localeCompare(b.id)));
  write('state.json', {seed: 11102026, round: 1, alive: entries.map(e => e.id).sort(), byes: [], sizes: [100], matchCount: 0});
  console.log('Validated 100 candidates. Ready to pair.');
} else if (command === 'pair') {
  const state = read('state.json');
  const candidates = read('candidates.json');
  let seed = state.seed + state.round;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const alive = [...state.alive];
  for (let i = alive.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [alive[i], alive[j]] = [alive[j], alive[i]]; }
  let bye = null;
  if (alive.length % 2) { const index = alive.findIndex(id => !state.byes.includes(id)); bye = alive.splice(index < 0 ? 0 : index, 1)[0]; }
  const matches = [];
  for (let i = 0; i < alive.length; i += 2) matches.push({match: `r${state.round}-m${String(i / 2 + 1).padStart(2,'0')}`, a: candidates.find(e => e.id === alive[i]), b: candidates.find(e => e.id === alive[i + 1])});
  write(`round-${state.round}-pairs.json`, { round: state.round, bye, matches });
  console.log(`Round ${state.round}: ${matches.length} matches, bye ${bye ?? 'none'}`);
} else if (command === 'advance') {
  const state = read('state.json');
  const pairs = read(`round-${state.round}-pairs.json`);
  const results = ['a','b','c'].flatMap(part => { const name = `round-${state.round}-verdicts-${part}.json`; return fs.existsSync(path.join(root,name)) ? read(name) : []; });
  if (results.length !== pairs.matches.length || new Set(results.map(e => e.match)).size !== results.length) throw Error('Missing/duplicate match verdicts');
  const alive = [];
  const candidates = read('candidates.json');
  const max = [30,25,20,15,10];
  for (const match of pairs.matches) {
    const verdict = results.find(e => e.match === match.match);
    if (![match.a.id,match.b.id].includes(verdict.winner)) throw Error('Winner not in pair');
    for (const side of ['a','b']) {
      const review = verdict[side];
      if (!review || !review.attack || !review.response || !review.scoreReason || !Array.isArray(review.scores) || review.scores.length !== 5 || review.scores.some((s,i)=>!Number.isInteger(s)||s<0||s>max[i])) throw Error(`Invalid review ${match.match}:${side}`);
    }
    const winningSide = verdict.winner === match.a.id ? 'a' : 'b';
    const losingSide = winningSide === 'a' ? 'b' : 'a';
    const total = side => verdict[side].scores.reduce((sum,s)=>sum+s,0);
    if (verdict[winningSide].fatal && !verdict[losingSide].fatal) throw Error('Fatal regression won');
    if (total(winningSide)<total(losingSide) && !verdict[losingSide].fatal) throw Error('Lower score won');
    if (!verdict.revisedWinner || verdict.revisedWinner.id !== verdict.winner) throw Error('Missing winner revision');
    const index = candidates.findIndex(e=>e.id === verdict.winner);
    candidates[index] = {...candidates[index], ...verdict.revisedWinner};
    alive.push(verdict.winner);
  }
  if (pairs.bye) {alive.push(pairs.bye); state.byes.push(pairs.bye);}
  write(`round-${state.round}-verdicts.json`, results);
  state.alive = alive; state.sizes.push(alive.length); state.matchCount += results.length; state.round++;
  write('candidates.json', candidates); write('state.json',state);
  if (alive.length === 1) {
    if (state.matchCount !== 99 || state.round !== 8) throw Error('Incomplete 100-idea tournament');
    write('winner.json', candidates.find(e=>e.id === alive[0]));
  }
  console.log(`${state.sizes.join(' -> ')}; ${state.matchCount} matches complete`);
} else throw Error('Use cards, merge, pair or advance');
