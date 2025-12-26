import React from 'react';
import { LayoutDashboard, Users, Calendar, Settings, LogOut, Activity, MessageSquareText } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'clients', label: 'Meus Clientes', icon: Users },
    { id: 'feedbacks', label: 'Feedbacks Semanais', icon: MessageSquareText },
    { id: 'reports', label: 'Relatórios', icon: Activity },
  ];

  return (
    <div className="w-20 lg:w-64 h-screen bg-dark-950 border-r border-gray-800 flex flex-col transition-all duration-300 fixed left-0 top-0 z-50">
      <div className="h-20 flex items-center justify-center lg:justify-start lg:px-6 border-b border-gray-800">
        <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-900/50">
          <Activity className="text-white w-6 h-6" />
        </div>
        <span className="hidden lg:block ml-3 font-extrabold text-xl tracking-tighter text-white italic">
          MUDA<span className="text-primary-500">SHAPE</span>
        </span>
      </div>

      <nav className="flex-1 py-6 space-y-2 px-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center justify-center lg:justify-start px-3 py-3 rounded-xl transition-all duration-200 group relative
                ${isActive 
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-900/20' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
            >
              <Icon size={22} className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'} />
              <span className={`hidden lg:block ml-3 font-medium ${isActive ? 'text-white' : ''}`}>
                {item.label}
              </span>
              
              {/* Tooltip for mobile */}
              <div className="lg:hidden absolute left-14 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                {item.label}
              </div>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button className="w-full flex items-center justify-center lg:justify-start px-3 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
          <LogOut size={22} />
          <span className="hidden lg:block ml-3 font-medium">Sair</span>
        </button>
      </div>
    </div>
  );
};