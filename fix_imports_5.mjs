import fs from 'fs';

let lc = fs.readFileSync('src/components/layout/ListConfigModal.tsx', 'utf8');
lc = lc.replace(/, isLimpiezaList, ensureRoutineSections/, "");
fs.writeFileSync('src/components/layout/ListConfigModal.tsx', lc);

let mh = fs.readFileSync('src/components/layout/main/MainSectionHeader.tsx', 'utf8');
mh = mh.replace(/import \{ formatSectionTitle \} from '..\/..\/..\/utils\/sectionRoutine';\r?\n/, "");
fs.writeFileSync('src/components/layout/main/MainSectionHeader.tsx', mh);

let mc = fs.readFileSync('src/components/layout/MainContent.tsx', 'utf8');
mc = mc.replace(/isLimpiezaList, isRoutineList, ensureRoutineSections, /, "");
mc = mc.replace(/, ensureRoutineSections /, " ");
mc = mc.replace(/ensureRoutineSections, /, "");
mc = mc.replace(/ensureRoutineSections/, "");
fs.writeFileSync('src/components/layout/MainContent.tsx', mc);

console.log('Fixed');
