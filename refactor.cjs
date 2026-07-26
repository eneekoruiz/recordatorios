const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src/components/layout/MainContent.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Add page-header to flat array
content = content.replace(
  'const flat: VirtualItemType[] = [];',
  "const flat: VirtualItemType[] = [{ type: 'page-header' }];"
);

// 2. Update estimateSize
content = content.replace(
  "if (item.type === 'header') return 72;",
  "if (item.type === 'page-header') return 160;\n      if (item.type === 'header') return 48;"
);

// 3. Update group-header inline style
content = content.replace(
  "borderBottom: `1px solid var(--border-subtle)`,\n                  paddingLeft: `calc(12px + ${data.depth * 24}px)`, // Indent sub-sections\n                  paddingTop: 12,\n                  paddingBottom: 8",
  "borderBottom: 'none',\n                  paddingLeft: `calc(16px + ${data.depth * 24}px)`,\n                  paddingTop: 16,\n                  paddingBottom: 4"
);

// 4. Extract <header> and move it
const headerStart = content.indexOf('<header className="content-header"');
const headerEnd = content.indexOf('</header>') + '</header>'.length;

if (headerStart === -1 || headerEnd === -1) {
  console.error("Could not find header block");
  process.exit(1);
}

const headerBlock = content.substring(headerStart, headerEnd);

// Remove the header block from its original position
content = content.substring(0, headerStart) + content.substring(headerEnd);

// Find where to insert it in the map loop
const searchString = "if (data.type === 'header') {";
const injection = `
          if (data.type === 'page-header') {
            return (
              <div key="page-header" ref={virtualizer.measureElement} data-index={virtualItem.index} style={{...virtualStyle, zIndex: 20}}>
                ${headerBlock}
              </div>
            );
          } else if (data.type === 'header') {
`;

content = content.replace(searchString, injection.trim());

fs.writeFileSync(targetPath, content);
console.log("MainContent refactored successfully.");
