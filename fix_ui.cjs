const fs = require('fs');

// 1. Update SectionContextMenu.tsx
let content1 = fs.readFileSync('src/components/layout/main/SectionContextMenu.tsx', 'utf-8');

const insert_str1 = `
              {sectionMenu.pendingTaskCount !== undefined && sectionMenu.pendingTaskCount > 0 && (
                <button
                  type="button"
                  className="ios-dropdown-item"
                  onClick={() => {
                    HapticService.selection();
                    window.dispatchEvent(new CustomEvent('complete-all-tasks', { detail: { taskIds: sectionMenu.sectionTaskIds } }));
                    onClose();
                  }}
                >
                  <CheckSquare size={16} color="var(--text-primary)" />
                  <span>Marcar todas como hechas</span>
                </button>
              )}
`;

content1 = content1.replace('{onStartSequence && (sectionMenu.pendingTaskCount ?? 0) > 0 && (', insert_str1 + '\n              {onStartSequence && (sectionMenu.pendingTaskCount ?? 0) > 0 && (');

if (!content1.includes('import { CheckSquare')) {
    content1 = "import { CheckSquare } from 'lucide-react';\n" + content1;
}

fs.writeFileSync('src/components/layout/main/SectionContextMenu.tsx', content1);


// 2. Update MainContent.tsx
let content2 = fs.readFileSync('src/components/layout/MainContent.tsx', 'utf-8');

const insert_str2 = `
  useEffect(() => {
    const handleCompleteAll = (e: any) => {
      const { taskIds } = e.detail;
      if (!taskIds || !taskIds.length) return;
      const tasks = useAppStore.getState().tasks;
      const updates: any = {};
      taskIds.forEach((id: string) => {
        if (tasks[id] && tasks[id].status !== 'completed') {
          updates[id] = { status: 'completed' };
        }
      });
      if (Object.keys(updates).length > 0) {
        useAppStore.getState().batchUpdateTasks(updates);
        HapticService.success();
      }
    };
    window.addEventListener('complete-all-tasks', handleCompleteAll);
    return () => window.removeEventListener('complete-all-tasks', handleCompleteAll);
  }, []);
`;

content2 = content2.replace('  useEffect(() => {', insert_str2 + '\n  useEffect(() => {');
fs.writeFileSync('src/components/layout/MainContent.tsx', content2);
