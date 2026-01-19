import React from 'react';
import { LayoutDashboard, Users, Calendar, Settings, LogOut, Activity, MessageSquareText, Bot } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, isOpen, onClose }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'clients', label: 'Meus Clientes', icon: Users },
    { id: 'feedbacks', label: 'Feedbacks', icon: MessageSquareText },
    { id: 'ai_module', label: 'Inteligência Artificial', icon: Bot },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm animate-fade-in"
          onClick={onClose}
        />
      )}

      <div className={`
        fixed top-0 left-0 h-screen bg-dark-950 border-r border-gray-800 flex flex-col transition-transform duration-300 z-50
        w-64 
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0 lg:w-64
      `}>
        <div className="h-20 flex items-center justify-start px-6 border-b border-gray-800">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-900/50 shrink-0">
            <Activity className="text-white w-6 h-6" />
          </div>
          <span className="ml-3 font-extrabold text-xl tracking-tighter text-white italic">
            GESTOR<span className="text-primary-500">FITNESS</span>
          </span>
        </div>

        <nav className="flex-1 py-6 space-y-2 px-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id);
                  onClose(); // Close on mobile when clicked
                }}
                className={`w-full flex items-center justify-start px-3 py-3 rounded-xl transition-all duration-200 group relative
                ${isActive
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-900/20'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <Icon size={22} className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'} />
                <span className={`ml-3 font-medium ${isActive ? 'text-white' : ''}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button className="w-full flex items-center justify-start px-3 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
            <LogOut size={22} />
            <span className="ml-3 font-medium">Sair</span>
          </button>
        </div>
      </div>

    </>
  );
};