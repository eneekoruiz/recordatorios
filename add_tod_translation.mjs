import fs from 'fs';

const file = 'src/components/layout/MainContent.tsx';
let content = fs.readFileSync(file, 'utf8');

// We intercept the headerTitle generation inside MainContent
const headerTitleRegex = /if \(catObj\) \{ headerTitle = catObj\.name; color = catObj\.color; \}\s*else \{ headerTitle = categoryOrCycle === 'Sin Lista' \? 'Sin lista' : categoryOrCycle; color = '#8e8e93'; \}/;

const newHeaderTitle = `if (catObj) { headerTitle = catObj.name; color = catObj.color; }
          else if (categoryOrCycle === 'tod_morning') { headerTitle = 'Mañana'; color = '#FF9500'; }
          else if (categoryOrCycle === 'tod_afternoon') { headerTitle = 'Tarde'; color = '#007AFF'; }
          else if (categoryOrCycle === 'tod_night') { headerTitle = 'Noche'; color = '#5856D6'; }
          else if (categoryOrCycle === 'tod_none') { headerTitle = 'Cualquier momento'; color = '#8e8e93'; }
          else { headerTitle = categoryOrCycle === 'Sin Lista' ? 'Sin lista' : categoryOrCycle; color = '#8e8e93'; }`;

content = content.replace(headerTitleRegex, newHeaderTitle);

fs.writeFileSync(file, content);
