

import React, { useState, useEffect } from 'react';
import { Client, ServiceType } from '../types';
import { supabase } from '../services/supabase';
import { fetchProfilePicture } from '../services/profileService';


import { X, Save, User, Phone, Mail, Calendar, CreditCard, Camera, Briefcase, Plus, Loader2, Upload, Trash2 } from 'lucide-react';
import { CustomSelect } from './CustomSelect';

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
        service_type: 'Mudashape', // Default
        avatar_url: '' // Start empty to trigger fetch or fallback
    });

    const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
    const [isAddingServiceType, setIsAddingServiceType] = useState(false);
    const [isDeletingServiceType, setIsDeletingServiceType] = useState(false);
    const [newServiceTypeName, setNewServiceTypeName] = useState('');

    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (client) {
            setFormData(client);
        }
        fetchServiceTypes();
    }, [client]);

    const fetchServiceTypes = async () => {
        const { data, error } = await supabase
            .from('service_types')
            .select('*')
            .order('name');

        if (!error && data) {
            setServiceTypes(data);
        }
    };

    const handleAddServiceType = async () => {
        if (!newServiceTypeName.trim()) return;

        const { data, error } = await supabase
            .from('service_types')
            .insert({ name: newServiceTypeName })
            .select()
            .single();

        if (error) {
            alert('Erro ao criar tipo de serviço. Talvez já exista?');
        } else if (data) {
            setServiceTypes([...serviceTypes, data]);
            setFormData({ ...formData, service_type: data.name });
            setIsAddingServiceType(false);
            setNewServiceTypeName('');
        }
    };

    const handleDeleteServiceType = async (id: string, name: string) => {
        if (!window.confirm(`Excluir o tipo de serviço "${name}"? Os alunos que já possuem este tipo NÃO serão alterados, mas ele sairá da lista de opções.`)) return;

        const { error } = await supabase
            .from('service_types')
            .delete()
            .eq('id', id);

        if (error) {
            console.error(error);
            alert('Erro ao excluir.');
        } else {
            setServiceTypes(serviceTypes.filter(s => s.id !== id));
            // If the deleted one was selected, maybe clear it? Or leave it as legacy text. leaving it is safer.
        }
    };


    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];
        setUploading(true);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${fileName}`;

            // 1. Upload to 'avatars' bucket
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            if (data) {
                setFormData({ ...formData, avatar_url: data.publicUrl });
            }

        } catch (error) {
            console.error('Error uploading avatar:', error);
            alert('Erro ao enviar imagem. Verifique se o arquivo não é muito grande.');
        } finally {
            setUploading(false);
        }
    };

    const removeAvatar = () => {
        setFormData({ ...formData, avatar_url: '' });
    };

    // Auto-calculate end date based on plan
    useEffect(() => {
        // If updating an existing client, we only auto-calc if the plan type is standard (not custom) AND the user changed the plan or start date.
        // But if it's 'Custom', we never auto-calc.
        if (formData.plan_type === 'Custom') return;

        if (!formData.start_date) return;

        // Use UTC to avoid timezone shifts
        const parts = formData.start_date.split('-');
        const start = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));

        const months = formData.plan_type === 'Monthly' ? 1
            : formData.plan_type === 'Quarterly' ? 3
                : formData.plan_type === 'Semi-Annual' ? 6
                    : 12; // Annual (default fallback for others known)

        start.setUTCMonth(start.getUTCMonth() + months);
        setFormData(prev => ({ ...prev, end_date: start.toISOString().split('T')[0] }));
    }, [formData.plan_type, formData.start_date]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Prepare payload
            let finalData = { ...formData };

            // Critical: verification on submit to ensure we have the photo even if user clicked fast
            // Only try if avatar is empty/default and we have a phone
            if (!finalData.avatar_url || finalData.avatar_url.includes('picsum')) {
                const picUrl = await fetchProfilePicture(finalData.phone);
                if (picUrl) {
                    finalData.avatar_url = picUrl;
                } else {
                    finalData.avatar_url = ''; // Ensure blank so initials fallback works
                }
            }

            if (client?.id) {
                // Update
                const { error } = await supabase
                    .from('clients')
                    .update({
                        ...finalData,
                        renewal_notice_sent: false
                    })
                    .eq('id', client.id);

                if (error) throw error;
            } else {
                // Create
                const { error } = await supabase
                    .from('clients')
                    .insert([{ ...finalData, renewal_notice_sent: false }]);

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

                <div className="bg-dark-800 p-3 sm:p-6 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl sm:text-2xl font-bold text-white">
                        {client ? 'Editar Aluno' : 'Novo Aluno'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-3 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6">

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Name */}
                        <div className="lg:col-span-2">
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

                        {/* Avatar Upload - Manual (Replaces Name col-span-2 if distinct row wanted, or integrate nicely) */}
                        {/* Let's put Name and Avatar side-by-side or stacked? For now, adding Avatar control below Name */}
                        <div className="lg:col-span-2 bg-dark-800 p-3 sm:p-4 rounded-xl border border-gray-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-4">
                                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-dark-900 border border-gray-600 flex items-center justify-center shrink-0">
                                    {formData.avatar_url ? (
                                        <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="text-gray-500" size={32} />
                                    )}
                                    {uploading && (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                            <Loader2 size={24} className="text-primary-500 animate-spin" />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-200">Foto de Perfil</p>
                                    <p className="text-xs text-gray-500">
                                        Será buscada automaticamente pelo WhatsApp.<br />
                                        Ou você pode enviar uma foto manual.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="cursor-pointer bg-dark-700 hover:bg-dark-600 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center transition-all border border-gray-600">
                                    <Upload size={14} className="mr-2" />
                                    Trocar
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                        disabled={uploading}
                                    />
                                </label>
                                {formData.avatar_url && (
                                    <button
                                        type="button"
                                        onClick={removeAvatar}
                                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-lg border border-red-500/30 transition-all"
                                        title="Remover foto"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">WhatsApp</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="text"
                                    value={formData.phone}
                                    onChange={e => {
                                        // Mask: (XX) XXXXX-XXXX
                                        let value = e.target.value.replace(/\D/g, '');
                                        if (value.length > 11) value = value.slice(0, 11);

                                        let formatted = value;
                                        if (value.length > 2) {
                                            formatted = `(${value.slice(0, 2)}) ${value.slice(2)}`;
                                        }
                                        if (value.length > 7) {
                                            formatted = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
                                        }

                                        setFormData({ ...formData, phone: formatted });
                                    }}
                                    className="w-full bg-dark-800 border border-gray-700 rounded-xl pl-10 p-3 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                    placeholder="(11) 99999-9999"
                                    maxLength={15} // (11) 91234-5678 = 15 chars
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

                        {/* Service Type (Dynamic) - NEW */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Tipo de Serviço</label>

                            {/* NORMAL MODE */}
                            {!isAddingServiceType && !isDeletingServiceType && (
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <CustomSelect
                                            icon={Briefcase}
                                            options={serviceTypes.map(t => ({ label: t.name, value: t.name }))}
                                            value={formData.service_type || ''}
                                            onChange={(val) => setFormData({ ...formData, service_type: val })}
                                            placeholder="Selecione..."
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingServiceType(true)}
                                        className="p-3 bg-dark-800 border border-gray-700 rounded-xl text-primary-500 hover:bg-dark-700 h-[50px]"
                                        title="Adicionar Novo Tipo"
                                    >
                                        <Plus size={18} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsDeletingServiceType(true)}
                                        className="p-3 bg-dark-800 border border-gray-700 rounded-xl text-red-500 hover:bg-dark-700 h-[50px]"
                                        title="Gerenciar / Excluir Tipos"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            )}

                            {/* ADD MODE */}
                            {isAddingServiceType && (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newServiceTypeName}
                                        onChange={e => setNewServiceTypeName(e.target.value)}
                                        placeholder="Nome do novo serviço..."
                                        className="flex-1 bg-dark-800 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddServiceType}
                                        className="p-3 bg-primary-600 text-white rounded-xl hover:bg-primary-500"
                                    >
                                        <Save size={18} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingServiceType(false)}
                                        className="p-3 bg-dark-800 border border-gray-700 text-gray-400 rounded-xl hover:bg-dark-700"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            )}

                            {/* DELETE MODE */}
                            {isDeletingServiceType && (
                                <div className="bg-dark-800 border border-gray-700 rounded-xl p-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-bold text-red-400">Excluir Serviço</span>
                                        <button onClick={() => setIsDeletingServiceType(false)}><X size={16} className="text-gray-400" /></button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {serviceTypes.map(type => (
                                            <div key={type.id} className="bg-dark-900 border border-gray-600 rounded-lg px-3 py-1.5 flex items-center text-sm">
                                                <span className="text-white mr-2">{type.name}</span>
                                                <button
                                                    onClick={() => handleDeleteServiceType(type.id!, type.name)}
                                                    className="text-red-500 hover:text-white transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                        {serviceTypes.length === 0 && <span className="text-gray-500 text-xs italic">Nenhum serviço cadastrado.</span>}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Plan Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Plano (Duração)</label>
                            <CustomSelect
                                value={formData.plan_type as string}
                                onChange={(val) => setFormData({ ...formData, plan_type: val as any })}
                                options={[
                                    { value: 'Monthly', label: 'Mensal' },
                                    { value: 'Quarterly', label: 'Trimestral' },
                                    { value: 'Semi-Annual', label: 'Semestral' },
                                    { value: 'Annual', label: 'Anual' },
                                    { value: 'Custom', label: 'Personalizado' }
                                ]}
                            />
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

                        {/* Rest of form... */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Término</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="date"
                                    value={formData.end_date}
                                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                    disabled={formData.plan_type !== 'Custom'}
                                    className={`w-full bg-dark-800 border border-gray-700 rounded-xl pl-10 p-3 text-white focus:ring-2 focus:ring-primary-500 outline-none 
                                        ${formData.plan_type !== 'Custom' ? 'opacity-50 cursor-not-allowed bg-dark-900 text-gray-500' : ''}`}
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

