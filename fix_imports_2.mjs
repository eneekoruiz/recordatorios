import fs from 'fs';

let content = fs.readFileSync('src/components/layout/main/SectionContextMenu.tsx', 'utf8');
if (!content.includes("import { formatSectionTitle }")) {
  content = content.replace("import { SpotlightBackdrop", "import { formatSectionTitle } from '../../../utils/sectionRoutine';\nimport { SpotlightBackdrop");
  fs.writeFileSync('src/components/layout/main/SectionContextMenu.tsx', content);
}

let content2 = fs.readFileSync('src/components/tasks/card/TaskContextMenu.tsx', 'utf8');
if (!content2.includes("import { formatSectionTitle }")) {
  content2 = content2.replace("import { getHabitStatus }", "import { formatSectionTitle } from '../../../utils/sectionRoutine';\nimport { getHabitStatus }");
  fs.writeFileSync('src/components/tasks/card/TaskContextMenu.tsx', content2);
}

console.log('Fixed formatSectionTitle imports');
