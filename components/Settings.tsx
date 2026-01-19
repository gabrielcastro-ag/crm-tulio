import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Save, Phone, BellRing, User, Camera, Loader2 } from 'lucide-react';

export const Settings: React.FC = () => {
    const [personalPhone, setPersonalPhone] = useState('');
    const [userName, setUserName] = useState('');
    const [userAvatar, setUserAvatar] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        // Fetch Phone
        const { data: phoneData } = await supabase.from('app_settings').select('value').eq('key', 'personal_phone').single();
        if (phoneData) setPersonalPhone(phoneData.value || '');

        // Fetch Name
        const { data: nameData } = await supabase.from('app_settings').select('value').eq('key', 'user_name').single();
        if (nameData) setUserName(nameData.value || 'Usuário');
        else setUserName('Túlio Cabral');

        // Fetch Avatar
        const { data: avatarData } = await supabase.from('app_settings').select('value').eq('key', 'user_avatar').single();
        if (avatarData) setUserAvatar(avatarData.value || '');
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setUploadingAvatar(true);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `admin-avatar-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Upload
            const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
            if (uploadError) throw uploadError;

            // Get URL
            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
            setUserAvatar(data.publicUrl);

        } catch (error) {
            console.error('Error uploading avatar:', error);
            alert('Erro ao fazer upload da foto.');
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setSuccess(false);

        try {
            const { error: phoneError } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'personal_phone',
                    value: personalPhone,
                    updated_at: new Date().toISOString()
                });

            if (phoneError) throw phoneError;

            const { error: nameError } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'user_name',
                    value: userName,
                    updated_at: new Date().toISOString()
                });

            if (nameError) throw nameError;

            const { error: avatarError } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'user_avatar',
                    value: userAvatar,
                    updated_at: new Date().toISOString()
                });

            if (avatarError) throw avatarError;

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);

            // Reload page to reflect name change in Sidebar/Header immediately (simple approach) or use context later
            // For now, let's just save. The user will see it update on refresh or nav. 
            // Better: Trigger a global refresh? App.tsx handles fetch.
            // Let's rely on reload for now for simplicity as App structure is simple.
            // Actually, let's reload to be sure header updates.
            setTimeout(() => window.location.reload(), 1000);

        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Erro ao salvar configurações.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-2">Configurações</h2>
            <p className="text-gray-400 mb-8">Personalize o comportamento do sistema.</p>

            <div className="bg-dark-800 rounded-2xl border border-gray-700 p-8 shadow-xl">

                {/* Profile Section */}
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-700">
                    <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500">
                        <User size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Perfil</h3>
                        <p className="text-gray-400 text-sm">Seus dados de exibição.</p>
                    </div>
                </div>

                <form onSubmit={handleSave} className="space-y-6">
                    {/* Avatar Upload */}
                    <div className="flex flex-col items-center sm:flex-row gap-6 mb-8">
                        <div className="relative group">
                            <div className="w-24 h-24 rounded-full bg-dark-900 border-2 border-dashed border-gray-600 flex items-center justify-center overflow-hidden">
                                {userAvatar ? (
                                    <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="text-gray-500" size={40} />
                                )}
                                {uploadingAvatar && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                        <Loader2 className="animate-spin text-white" />
                                    </div>
                                )}
                            </div>
                            <label className="absolute bottom-0 right-0 bg-primary-600 p-2 rounded-full cursor-pointer hover:bg-primary-500 transition-colors shadow-lg">
                                <Camera size={16} className="text-white" />
                                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                            </label>
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                            <h4 className="font-bold text-white mb-1">Foto de Perfil</h4>
                            <p className="text-xs text-gray-500 mb-2">Recomendado: 200x200px. JPG ou PNG.</p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Nome de Exibição</label>
                        <input
                            type="text"
                            value={userName}
                            onChange={e => setUserName(e.target.value)}
                            className="w-full bg-dark-900 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all placeholder-gray-600"
                            placeholder="Seu Nome"
                        />
                    </div>

                    <div className="flex items-center gap-4 mt-8 mb-6 pb-6 border-b border-gray-700">
                        <div className="p-3 bg-primary-500/10 rounded-xl text-primary-500">
                            <BellRing size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Notificações do Personal</h3>
                            <p className="text-gray-400 text-sm">Receba alertas no seu WhatsApp quando planos estiverem vencendo.</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Seu WhatsApp (para receber alertas)</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                            <input
                                type="text"
                                value={personalPhone}
                                onChange={e => setPersonalPhone(e.target.value)}
                                className="w-full bg-dark-900 border border-gray-700 rounded-xl pl-10 p-3 text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all placeholder-gray-600"
                                placeholder="5511999999999"
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            O robô enviará um resumo diário se houver alunos vencendo nos próximos 7 dias.
                        </p>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`px-6 py-3 rounded-xl flex items-center font-bold text-white transition-all shadow-lg shadow-primary-900/20 
                                ${loading ? 'bg-primary-700 cursor-wait' : 'bg-primary-600 hover:bg-primary-500'}
                                ${success ? 'bg-green-600 hover:bg-green-500' : ''}
                            `}
                        >
                            {success ? 'Salvo!' : (loading ? 'Salvando...' : 'Salvar Alterações')}
                            {!success && !loading && <Save size={18} className="ml-2" />}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
