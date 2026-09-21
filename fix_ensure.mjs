import fs from 'fs';
['src/components/layout/ListConfigModal.tsx', 'src/components/layout/MainContent.tsx'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/ensureRoutineSections\([^)]+\);?/g, '');
  fs.writeFileSync(file, content);
});
