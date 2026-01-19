
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Client } from '../types';
import { Bot, Search, AlertCircle, Save, CheckCircle } from 'lucide-react';

interface AiManagerProps {
    clients: Client[];
    onUpdate?: () => void;
}

export const AiManager: React.FC<AiManagerProps> = ({ clients, onUpdate }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState<string | null>(null); // Client ID being saved

    // Local state to handle changes before saving? Or save immediately?
    // Let's safe immediately for better UX on toggles

    // Filter clients
    const filteredClients = clients.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.phone.includes(searchTerm)
    );

    const handleToggleAi = async (client: Client) => {
        if (!client.id) return;
        setSaving(client.id);

        const newValue = !client.ai_enabled;

        const { error } = await supabase
            .from('clients')
            .update({ ai_enabled: newValue })
            .eq('id', client.id);

        if (error) {
            console.error('Error updating AI status:', error);
            alert('Erro ao atualizar status da IA');
        } else {
            // Ideally parent should refetch, but we can optimistically update if we had local state
            if (onUpdate) onUpdate();
        }
        setSaving(null);
    };

    const handleModeChange = async (client: Client, mode: string) => {
        if (!client.id) return;
        setSaving(client.id);

        const { error } = await supabase
            .from('clients')
            .update({ ai_mode: mode })
            .eq('id', client.id);

        if (error) {
            alert('Erro ao mudar modo');
        } else {
            if (onUpdate) onUpdate();
        }
        setSaving(null);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Bot className="text-primary-500" size={32} />
                        Módulo de IA
                    </h2>
                    <p className="text-gray-400 mt-1">
                        Gerencie quais alunos têm acesso ao assistente virtual no WhatsApp.
                    </p>
                </div>

                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar aluno..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-dark-800 border-gray-700 text-white pl-10 pr-4 py-2 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                    />
                </div>
            </header>

            <div className="bg-dark-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-dark-800 border-b border-gray-700 text-gray-400 text-sm uppercase tracking-wider">
                                <th className="p-4 font-semibold">Aluno</th>
                                <th className="p-4 font-semibold">WhatsApp</th>
                                <th className="p-4 font-semibold text-center">Status IA</th>
                                <th className="p-4 font-semibold">Personalidade</th>
                                <th className="p-4 font-semibold text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800 text-gray-300">
                            {filteredClients.map(client => (
                                <tr key={client.id} className="hover:bg-dark-800/50 transition-colors">
                                    <td className="p-4 font-medium text-white flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                                            {client.avatar_url ? (
                                                <img src={client.avatar_url} alt={client.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-xs">{client.name.substring(0, 2).toUpperCase()}</span>
                                            )}
                                        </div>
                                        {client.name}
                                    </td>
                                    <td className="p-4 text-sm font-mono text-gray-400">{client.phone}</td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => handleToggleAi(client)}
                                            disabled={saving === client.id}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-900 ${client.ai_enabled ? 'bg-primary-600' : 'bg-gray-700'
                                                }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${client.ai_enabled ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                    </td>
                                    <td className="p-4">
                                        <select
                                            value={client.ai_mode || 'standard'}
                                            onChange={(e) => handleModeChange(client, e.target.value)}
                                            className="bg-dark-950 border border-gray-700 rounded-md px-3 py-1 text-sm text-gray-300 focus:outline-none focus:border-primary-500"
                                            disabled={!client.ai_enabled || saving === client.id}
                                        >
                                            <option value="standard">Padrão (Equilibrado)</option>
                                            <option value="strict">Rigoroso (Militar)</option>
                                            <option value="friendly">Amigável (Motivador)</option>
                                        </select>
                                    </td>
                                    <td className="p-4 text-right">
                                        {saving === client.id && (
                                            <span className="text-xs text-primary-400 animate-pulse">Salvando...</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredClients.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                            Nenhum aluno encontrado.
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-900/50 rounded-xl p-4 flex gap-3 items-start">
                <AlertCircle className="text-blue-400 shrink-0 mt-0.5" size={20} />
                <div>
                    <h4 className="text-blue-200 font-semibold mb-1">Como funciona?</h4>
                    <p className="text-sm text-blue-300/80">
                        Ao ativar a IA, o sistema passará a responder automaticamente as mensagens enviadas por este aluno no WhatsApp.
                        O assistente tem acesso ao histórico recente de conversas para manter o contexto.
                    </p>
                </div>
            </div>
        </div>
    );
};
