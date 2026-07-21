const fs = require('fs');

const lines = fs.readFileSync('C:\\Users\\User\\.gemini\\antigravity\\brain\\7e568580-2c47-4b4f-afc5-c0d23df5c047\\.system_generated\\logs\\transcript_full.jsonl', 'utf-8').split('\n');

for (const line of lines) {
  if (!line) continue;
  try {
    const data = JSON.parse(line);
    if (data.type === 'USER_INPUT' && data.content.includes('List Name')) {
      const parts = data.content.split('List Name');
      const csv = 'List Name' + parts[1].split('</USER_REQUEST>')[0].trim();
      fs.appendFileSync('extracted_data.txt', '\n\n===NEW CSV===\n\n' + csv);
    }
  } catch(e) {}
}
console.log('Done extracting to extracted_data.txt');
