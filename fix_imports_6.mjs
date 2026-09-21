import fs from 'fs';

let lc = fs.readFileSync('src/components/layout/ListConfigModal.tsx', 'utf8');
lc = lc.replace(/isQueHeHechoList, /g, "isQueHeHechoList, isLimpiezaList, ");
fs.writeFileSync('src/components/layout/ListConfigModal.tsx', lc);

console.log('Fixed isLimpiezaList');
