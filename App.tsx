
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ClientList } from './components/ClientList';
import { FeedbackManager } from './components/FeedbackManager';
import { Settings } from './components/Settings';
import { FeedbackFormPublic } from './components/FeedbackFormPublic';
import { AiManager } from './components/AiManager';
import { Client } from './types';
import { supabase } from './services/supabase';
import { Menu } from 'lucide-react';

const App = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching clients:', error);
    } else {
      setClients(data as Client[] || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // Expiration Logic: Check dates on load to update status (Backend handles this ideally, but UI can double check)
  useEffect(() => {
    if (clients.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to midnight

    const updates = clients.map(client => {
      if (!client.end_date) return client;

      // end_date is YYYY-MM-DD (UTC midnight effectively)
      // When parsed by new Date(), it is UTC. 
      // We need to compare carefully.
      // Let's treat everything as "Date Only" to be safe.
      const end = new Date(client.end_date);
      // Adjust end to local midnight to match 'today' for correct day-diff
      const endLocal = new Date(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());

      const diffTime = endLocal.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let newStatus = client.status;
      if (diffDays < 0) newStatus = 'expired';
      else if (diffDays <= 7) newStatus = 'expiring';
      else newStatus = 'active';

      if (newStatus !== client.status && client.id) {
        // Update in DB quietly
        supabase.from('clients').update({ status: newStatus }).eq('id', client.id).then();
        return { ...client, status: newStatus };
      }
      return client;
    });

    // Simple comparison to check if we need to update local state
    // Note: This matches referential equality if nothing changed in map
    const hasChanged = updates.some((u, i) => u.status !== clients[i].status);
    if (hasChanged) {
      setClients(updates);
    }
  }, [clients.length]); // Depend only on length to avoid infinite loop with updates

  const handleDeleteClient = async (id: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (!error) {
      setClients(clients.filter(client => client.id !== id));
    } else {
      alert('Erro ao excluir cliente');
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-[60vh] text-primary-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-current"></div>
        </div>
      );
    }

    switch (currentView) {
      case 'dashboard':
        return <Dashboard clients={clients} />;
      case 'clients':
        return <ClientList clients={clients} setClients={setClients} onDeleteClient={handleDeleteClient} refreshClients={fetchClients} />;
      case 'feedbacks':
        return <FeedbackManager clients={clients} />;
      case 'ai_module':
        return <AiManager clients={clients} onUpdate={fetchClients} />;
      case 'settings':
        return <Settings />;
      default:
        // Check for specific routes before default 404
        if (window.location.pathname.startsWith('/feedback/')) {
          return <FeedbackFormPublic />;
        }

        return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500">
            <p className="text-xl">Em construção...</p>
          </div>
        );
    }
  };

  // Fetch User Name & Avatar for Header
  const [userName, setUserName] = useState('Usuário');
  const [userAvatar, setUserAvatar] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchUserName = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'user_name')
        .single();

      if (data && data.value) {
        setUserName(data.value);
      } else {
        setUserName('Túlio Cabral'); // Default
      }

      // Fetch Avatar
      const { data: avatarData } = await supabase.from('app_settings').select('value').eq('key', 'user_avatar').single();
      if (avatarData) setUserAvatar(avatarData.value || '');
    };
    fetchUserName();
  }, []);

  // Special Route Handling (No Layout)
  if (window.location.pathname.startsWith('/feedback/')) {
    return <FeedbackFormPublic />;
  }

  return (
    <div className="min-h-screen bg-dark-900 flex text-gray-100 font-sans">
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 lg:ml-64 p-4 lg:p-10 transition-all duration-300 w-full">
        <header className="flex justify-between items-center mb-6 lg:mb-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-dark-800 text-white border border-gray-700 hover:bg-dark-700"
            >
              <Menu size={24} />
            </button>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white line-clamp-1">
                Olá, {userName}! 👋
              </h1>
              <p className="text-gray-400 mt-1 text-sm lg:text-base hidden sm:block">Bem-vindo ao seu sistema de gestão.</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:block text-right mr-2">
              <p className="text-sm font-bold text-white">{userName}</p>
              <p className="text-xs text-gray-500">Personal Trainer</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary-500 to-purple-600 p-[2px]">
              <img
                src={userAvatar || `https://ui-avatars.com/api/?name=${userName}&background=random`}
                alt="Profile"
                className="w-full h-full rounded-full border-2 border-dark-900 object-cover"
              />
            </div>
          </div>
        </header>

        {renderContent()}
      </main>
    </div>
  );
};

export default App;