
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ClientList } from './components/ClientList';
import { FeedbackManager } from './components/FeedbackManager';
import { Client } from './types';
import { supabase } from './services/supabase';

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
    const updates = clients.map(client => {
      if (!client.end_date) return client;

      const end = new Date(client.end_date);
      const diffTime = end.getTime() - today.getTime();
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
      default:
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500">
            <p className="text-xl">Em construção...</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex text-gray-100 font-sans">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />

      <main className="flex-1 lg:ml-64 p-6 lg:p-10 transition-all duration-300">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Olá, Túlio Cabral! 👋
            </h1>
            <p className="text-gray-400 mt-1">Bem-vindo ao sistema MUDASHAPE.</p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:block text-right mr-2">
              <p className="text-sm font-bold text-white">Túlio Cabral</p>
              <p className="text-xs text-gray-500">Personal Trainer</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary-500 to-purple-600 p-[2px]">
              <img
                src="https://picsum.photos/200/200?random=tulio"
                alt="Profile"
                className="w-full h-full rounded-full border-2 border-dark-900"
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