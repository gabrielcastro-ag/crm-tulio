
import React, { useState } from 'react';
import { Client, ClientStatus } from '../types';
import { Search, Filter, MessageCircle, Calendar, Edit, Trash2, Plus } from 'lucide-react';
import { ClientManager } from './ClientManager';
import { ClientForm } from './ClientForm';

interface ClientListProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  onDeleteClient: (id: string) => void;
  refreshClients: () => void;
}

export const ClientList: React.FC<ClientListProps> = ({ clients, setClients, onDeleteClient, refreshClients }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdateClient = () => {
    refreshClients(); // Refresh list from DB
    // setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
  };

  const getStatusColor = (status: ClientStatus) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'expiring': return 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse';
      case 'expired': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getStatusLabel = (status: ClientStatus) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'expiring': return 'Renovação';
      case 'expired': return 'Vencido';
      default: return 'Pendente';
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Meus Clientes</h2>
          <p className="text-gray-400">Gerencie planos, renovações e conteúdos.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={() => { setEditingClient(null); setIsClientFormOpen(true); }}
            className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2.5 rounded-xl font-bold flex items-center transition-colors shadow-lg shadow-primary-900/20"
          >
            <Plus size={18} className="mr-2" /> Novo Aluno
          </button>

          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Buscar aluno..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-dark-800 border border-gray-700 text-white pl-10 pr-4 py-2.5 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredClients.map(client => (
          <div key={client.id} className="bg-dark-800 rounded-2xl border border-gray-700 p-6 shadow-lg hover:shadow-2xl hover:border-gray-600 transition-all duration-300 group relative overflow-hidden">

            {/* Status Badge */}
            <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(client.status)}`}>
              {getStatusLabel(client.status)}
            </div>

            {/* Quick Actions (Hover) */}
            <div className="absolute top-4 left-4 flex space-x-1 opacity-0 group-hover:opacity-100 transition-all z-10">
              <button
                onClick={() => { setEditingClient(client); setIsClientFormOpen(true); }}
                className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"
                title="Editar Dados"
              >
                <Edit size={16} />
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Tem certeza que deseja excluir o aluno ${client.name}?`)) {
                    onDeleteClient(client.id!);
                  }
                }}
                className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                title="Excluir Aluno"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="flex items-center space-x-4 mb-6 mt-6">
              <div className="relative">
                <img
                  src={client.avatar_url || `https://ui-avatars.com/api/?name=${client.name}`}
                  alt={client.name}
                  className="w-16 h-16 rounded-full border-2 border-gray-700 object-cover"
                />
                {client.status === 'expiring' && (
                  <div className="absolute -bottom-1 -right-1 bg-amber-500 text-dark-900 rounded-full p-1 border-2 border-dark-800" title="Vencendo em breve!">
                    <Calendar size={12} />
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-primary-400 transition-colors">{client.name}</h3>
                <p className="text-gray-500 text-sm">{client.plan_type}</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Início</span>
                <span className="text-gray-300">{client.start_date ? new Date(client.start_date).toLocaleDateString() : '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Término</span>
                <span className={`font-medium ${client.status === 'expiring' ? 'text-amber-400' : 'text-gray-300'}`}>
                  {client.end_date ? new Date(client.end_date).toLocaleDateString() : '-'}
                </span>
              </div>
              {/* Note: Schedules logic needs to be fetched separately ideally, or we assume it's not populated in list view for performance, but for now we removed valid schedule count */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Valor</span>
                <span className="text-emerald-400 font-medium">R$ {client.amount}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <a
                href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center py-2 px-4 rounded-xl bg-gray-700 text-white hover:bg-[#25D366] hover:text-white transition-colors"
                title="Abrir WhatsApp"
              >
                <MessageCircle size={18} className="mr-2" /> Chat
              </a>
              <button
                onClick={() => setSelectedClient(client)}
                className="flex items-center justify-center py-2 px-4 rounded-xl bg-primary-600 text-white hover:bg-primary-500 transition-colors"
                title="Agendar Treinos/Dietas"
              >
                <Calendar size={18} className="mr-2" /> Agendar
              </button>
            </div>

            {/* Context Overlay Hint */}
            {client.status === 'expiring' && (
              <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 flex items-start">
                <div className="text-amber-500 mr-2 mt-0.5"><Calendar size={14} /></div>
                <p className="text-xs text-amber-200">
                  O plano vence em breve. <span className="underline cursor-pointer font-bold">Enviar oferta de renovação?</span>
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mode: Schedule Manager */}
      {selectedClient && (
        <ClientManager
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onUpdateClient={handleUpdateClient}
        />
      )}

      {/* Mode: Add/Edit Client Details */}
      {isClientFormOpen && (
        <ClientForm
          client={editingClient}
          onClose={() => setIsClientFormOpen(false)}
          onSuccess={() => {
            setIsClientFormOpen(false);
            refreshClients();
          }}
        />
      )}
    </div>
  );
};