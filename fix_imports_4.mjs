import fs from 'fs';

let listConfig = fs.readFileSync('src/components/layout/ListConfigModal.tsx', 'utf8');
listConfig = listConfig.replace("ensureRoutineSections, ", "");
fs.writeFileSync('src/components/layout/ListConfigModal.tsx', listConfig);

let mainHeader = fs.readFileSync('src/components/layout/main/MainSectionHeader.tsx', 'utf8');
mainHeader = mainHeader.replace("import { formatSectionTitle } from '../../../utils/sectionRoutine';\n", "");
fs.writeFileSync('src/components/layout/main/MainSectionHeader.tsx', mainHeader);

console.log('Fixed more unused');
