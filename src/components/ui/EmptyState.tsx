import React from 'react';
import { Sparkles } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
}

export function EmptyState({
  title = "Todo despejado",
  message = "No hay tareas por aquí. Disfruta de la tranquilidad o añade algo nuevo para conquistar el día.",
  icon = <Sparkles className="w-12 h-12 text-blue-400" />
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-20 text-center animate-in fade-in duration-500">
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-full shadow-sm">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
        {title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[280px]">
        {message}
      </p>
    </div>
  );
}
