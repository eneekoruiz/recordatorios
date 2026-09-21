import fs from 'fs';

let taskCard = fs.readFileSync('src/components/tasks/TaskCard.tsx', 'utf8');
taskCard = taskCard.replace("import { Trash2, Calendar, createPortal } from 'react-dom';", "import { createPortal } from 'react-dom';");
taskCard = taskCard.replace("Lock, Image as ImageIcon, MoreHorizontal", "Lock, Image as ImageIcon, MoreHorizontal, Trash2, Calendar");
fs.writeFileSync('src/components/tasks/TaskCard.tsx', taskCard);

console.log('TaskCard fixed.');
