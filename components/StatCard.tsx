import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  colorClass: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, trend, trendUp, colorClass }) => {
  return (
    <div className="bg-dark-800 p-6 rounded-2xl border border-gray-700 hover:border-gray-600 transition-all duration-300 shadow-xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm font-medium mb-1">{label}</p>
          <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
        </div>
        <div className={`p-3 rounded-xl ${colorClass} bg-opacity-10`}>
          <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center">
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${trendUp ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {trend}
          </span>
          <span className="text-gray-500 text-xs ml-2">vs. mês anterior</span>
        </div>
      )}
    </div>
  );
};