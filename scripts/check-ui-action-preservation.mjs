import { execFileSync } from 'node:child_process';
import { Project, SyntaxKind } from 'ts-morph';
import fs from 'node:fs';

const baseline = process.argv[2] || 'f4d3070';
const files = execFileSync('git', ['diff', '--name-only', baseline, '--', 'src/components'], { encoding: 'utf8' }).trim().split('\n').filter(file => file.endsWith('.tsx'));
const project = new Project();
const normalize = text => text.replace(/\s+/g, '');
const actions = file => file.getDescendantsOfKind(SyntaxKind.JsxAttribute)
  .filter(attribute => ['onClick', 'onChange', 'onDoubleClick', 'onPointerDown', 'onDragStart', 'onDrop'].includes(attribute.getNameNode().getText()))
  .map(attribute => normalize(attribute.getText()));
let checked = 0;
const missing = [];
for (const file of files) {
  const previous = project.createSourceFile(`before-${file.replaceAll('/', '-')}`, execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' }));
  const current = project.createSourceFile(`after-${file.replaceAll('/', '-')}`, fs.readFileSync(file, 'utf8'));
  const remaining = actions(current);
  for (const action of actions(previous)) {
    checked++;
    const index = remaining.indexOf(action);
    if (index < 0) missing.push({ file, action: action.slice(0, 160) });
    else remaining.splice(index, 1);
  }
}
if (missing.length) throw Error(JSON.stringify(missing, null, 2));
console.log(`${checked} existing UI action bindings preserved across ${files.length} changed components (${baseline}).`);
