const fs = require('fs');
const content = fs.readFileSync('src/components/layout/MainContent.tsx', 'utf8');

const hookCall = `  const groupedTasks = useTaskGrouping({
    currentView, isFolderView, isSmartView, isListView, getTasksForSmartView, getTasksByList, 
    getTasksByCycle, tasks, resolvedShowCompleted, recentlyCompletedIds, lists, listSections, cycles, 
    currentCycle, cycleViewMode, listSectionFilter, dailyTimeFilter, resolveTimeOfDay, currentList, 
    sortTaskList, lifeLogViewMode, selectedPersonFilter, extractPeopleFromText
  });
`;

// we know it starts at "  const groupedTasks = useMemo(() => {"
// and ends at "  }, [currentView, isFolderView, isSmartView, isListView, getTasksForSmartView, getTasksByList, getTasksByCycle, tasks, resolvedShowCompleted, recentlyCompletedIds, lists, listSections, cycles, currentCycle, cycleViewMode, listSectionFilter, dailyTimeFilter, resolveTimeOfDay, currentList, sortTaskList, lifeLogViewMode, selectedPersonFilter]);"

const startIdx = content.indexOf('  const groupedTasks = useMemo(() => {');
const endStr = '  }, [currentView, isFolderView, isSmartView, isListView, getTasksForSmartView, getTasksByList, getTasksByCycle, tasks, resolvedShowCompleted, recentlyCompletedIds, lists, listSections, cycles, currentCycle, cycleViewMode, listSectionFilter, dailyTimeFilter, resolveTimeOfDay, currentList, sortTaskList, lifeLogViewMode, selectedPersonFilter]);';
const endIdx = content.indexOf(endStr, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  const newContent = content.slice(0, startIdx) + hookCall + content.slice(endIdx + endStr.length);
  fs.writeFileSync('src/components/layout/MainContent.tsx', newContent);
  console.log('Replaced successfully');
} else {
  console.log('Could not find start or end index', startIdx, endIdx);
}
