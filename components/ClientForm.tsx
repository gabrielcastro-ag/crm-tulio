
import React, { useState, useEffect } from 'react';
import { Client } from '../types';
import { supabase } from '../services/supabase';
import { X, Save, User, Phone, Mail, Calendar, CreditCard, Camera } from 'lucide-react';

interface ClientFormProps {
    client?: Client | null; // If null, adding new
    onClose: () => void;
    onSuccess: () => void;
}

export const ClientForm: React.FC<ClientFormProps> = ({ client, onClose, onSuccess }) => {
    const [formData, setFormData] = useState<Partial<Client>>({
        name: '',
        phone: '',
        email: '',
        plan_type: 'Monthly',
        amount: 0,
        status: 'active',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        notes: '',
        avatar_url: `https://picsum.photos/200/200?random=${Math.random()}`
    });

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (client) {
            setFormData(client);
        }
    }, [client]);

    // Auto-calculate end date based on plan
    useEffect(() => {
        if (!formData.start_date || (client && formData.end_date)) return;

        const start = new Date(formData.start_date!);
        const months = formData.plan_type === 'Monthly' ? 1
            : formData.plan_type === 'Quarterly' ? 3
                : formData.plan_type === 'Semi-Annual' ? 6
                    : 12;

        start.setMonth(start.getMonth() + months);
        setFormData(prev => ({ ...prev, end_date: start.toISOString().split('T')[0] }));
    }, [formData.plan_type, formData.start_date]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (client?.id) {
                // Update
                const { error } = await supabase
                    .from('clients')
                    .update(formData)
                    .eq('id', client.id);

                if (error) throw error;
            } else {
                // Create
                const { error } = await supabase
                    .from('clients')
                    .insert([formData]);

                if (error) throw error;
            }
            onSuccess();
        } catch (error) {
            console.error('Error saving client:', error);
            alert('Erro ao salvar cliente. Verifique os dados.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-dark-900 w-full max-w-2xl rounded-2xl border border-gray-700 shadow-2xl flex flex-col max-h-[90vh]">

                <div className="bg-dark-800 p-6 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-white">
                        {client ? 'Editar Aluno' : 'Novo Aluno'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Name */}
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-400 mb-1">Nome Completo</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-dark-800 border border-gray-700 rounded-xl pl-10 p-3 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                    required
                                />
                            </div>
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">WhatsApp (55...)</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="text"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full bg-dark-800 border border-gray-700 rounded-xl pl-10 p-3 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                    placeholder="5511999999999"
                                    required
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full bg-dark-800 border border-gray-700 rounded-xl pl-10 p-3 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Plan Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Plano</label>
                            <select
                                value={formData.plan_type}
                                onChange={e => setFormData({ ...formData, plan_type: e.target.value as any })}
                                className="w-full bg-dark-800 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                            >
                                <option value="Monthly">Mensal</option>
                                <option value="Quarterly">Trimestral</option>
                                <option value="Semi-Annual">Semestral</option>
                                <option value="Annual">Anual</option>
                            </select>
                        </div>

                        {/* Amount */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Valor (R$)</label>
                            <div className="relative">
                                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="number"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
                                    className="w-full bg-dark-800 border border-gray-700 rounded-xl pl-10 p-3 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Dates */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Início</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="date"
                                    value={formData.start_date}
                                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                    className="w-full bg-dark-800 border border-gray-700 rounded-xl pl-10 p-3 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Término</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="date"
                                    value={formData.end_date}
                                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                    className="w-full bg-dark-800 border border-gray-700 rounded-xl pl-10 p-3 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Avatar URL (Optional manual override) */}
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-400 mb-1">Foto de Perfil (URL)</label>
                            <div className="relative">
                                <Camera className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="text"
                                    value={formData.avatar_url}
                                    onChange={e => setFormData({ ...formData, avatar_url: e.target.value })}
                                    className="w-full bg-dark-800 border border-gray-700 rounded-xl pl-10 p-3 text-white focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                                    placeholder="https://..."
                                />
                            </div>
                        </div>

                    </div>

                    <div className="pt-4 flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`px-8 py-3 rounded-xl flex items-center justify-center font-bold text-white transition-all shadow-lg shadow-primary-900/20 
                 ${loading ? 'bg-primary-700 cursor-wait' : 'bg-primary-600 hover:bg-primary-500'}
               `}
                        >
                            {loading ? 'Salvando...' : 'Salvar Aluno'}
                            {!loading && <Save size={18} className="ml-2" />}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
