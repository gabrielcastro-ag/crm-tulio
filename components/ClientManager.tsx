
import React, { useState, useEffect } from 'react';
import { Client, ScheduleItem } from '../types';
import { supabase } from '../services/supabase';
import { sendMessage } from '../services/whatsapp';
import { X, MessageCircle, Calendar as CalendarIcon, FileText, Trash2, Edit2, Plus, Wand2, Send, Loader2 } from 'lucide-react';

interface ClientManagerProps {
  client: Client;
  onClose: () => void;
  onUpdateClient: (updatedClient: Client) => void;
}

interface DraftItem {
  id: string; // temp id
  date: string;
  time: string; // NEW
  message: string;
  file: File | null;
  fileName: string;
  type: 'workout' | 'diet' | 'general';
}

export const ClientManager: React.FC<ClientManagerProps> = ({ client, onClose, onUpdateClient }) => {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);

  // State for adding/editing schedule
  const [isEditingSchedule, setIsEditingSchedule] = useState<string | null>(null); // ID of item being edited
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');

  // Single Mode State
  const [formData, setFormData] = useState<{
    date: string;
    time: string; // NEW
    message: string;
    file: File | null;
    fileName: string;
    type: 'workout' | 'diet' | 'general';
  }>({
    date: new Date().toISOString().split('T')[0],
    time: '09:00', // Default time
    message: '',
    file: null,
    fileName: '',
    type: 'general'
  });

  // Batch Mode State
  const [batchSettings, setBatchSettings] = useState({
    startDate: new Date().toISOString().split('T')[0],
    startTime: '09:00', // Default time
    months: 3,
    baseMessage: ''
  });
  const [batchDrafts, setBatchDrafts] = useState<DraftItem[]>([]);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSchedules();
  }, [client.id]);

  // Update batch drafts when settings change
  useEffect(() => {
    if (activeTab === 'batch') {
      const drafts: DraftItem[] = [];
      const baseDate = new Date(batchSettings.startDate);

      for (let i = 0; i < batchSettings.months; i++) {
        const date = new Date(baseDate);
        date.setMonth(baseDate.getMonth() + i);

        // Preserve existing draft content if available
        const existing = batchDrafts[i];

        drafts.push({
          id: existing?.id || Math.random().toString(36).substr(2, 9),
          date: existing?.date || date.toISOString().split('T')[0],
          time: existing?.time || batchSettings.startTime, // Use existing or global setting
          message: existing ? existing.message : '',
          file: existing ? existing.file : null,
          fileName: existing ? existing.fileName : '',
          type: 'general'
        });
      }
      setBatchDrafts(drafts);
    }
  }, [batchSettings.months, batchSettings.startDate, batchSettings.startTime, activeTab]);

  const fetchSchedules = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('client_id', client.id)
      .order('date', { ascending: true });

    if (error) console.error('Error fetching schedules:', error);
    else setSchedules(data as ScheduleItem[]);
    setLoading(false);
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${client.id}/${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('pdfs')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('pdfs')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const combineDateTime = (date: string, time: string) => {
    // Create date object in local time
    const dateTime = new Date(`${date}T${time}:00`);
    return dateTime.toISOString();
  };

  const handleSaveSingle = async () => {
    if (!client.id) return;
    setSaving(true);
    try {
      let publicUrl = null;
      if (formData.file) {
        publicUrl = await uploadFile(formData.file);
        if (!publicUrl) throw new Error('Falha no upload do PDF');
      }

      const fullDate = combineDateTime(formData.date, formData.time);

      if (isEditingSchedule) {
        const { error } = await supabase.from('schedules').update({
          date: fullDate,
          message: formData.message,
          attachment_url: publicUrl,
          attachment_name: formData.fileName
        }).eq('id', isEditingSchedule);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('schedules').insert({
          client_id: client.id,
          date: fullDate,
          type: formData.type,
          message: formData.message,
          attachment_url: publicUrl || undefined,
          attachment_name: formData.fileName || undefined,
          status: 'pending'
        });
        if (error) throw error;
      }

      resetForm();
      fetchSchedules();
    } catch (err) {
      alert('Erro ao salvar agendamento.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBatch = async () => {
    if (!client.id) return;
    setSaving(true);
    try {
      const newItems = [];
      // Process each draft sequentially to handle uploads
      for (const draft of batchDrafts) {
        let publicUrl = undefined;
        if (draft.file) {
          const url = await uploadFile(draft.file);
          if (url) publicUrl = url;
        }

        const fullDate = combineDateTime(draft.date, draft.time);

        newItems.push({
          client_id: client.id,
          date: fullDate,
          type: draft.type,
          message: draft.message,
          attachment_url: publicUrl,
          attachment_name: draft.fileName || undefined,
          status: 'pending'
        });
      }

      const { error } = await supabase.from('schedules').insert(newItems);
      if (error) throw error;

      alert('Agendamentos criados com sucesso!');
      resetForm();
      fetchSchedules();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar lote.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (item: ScheduleItem) => {
    if (!item.id) return;
    setActiveTab('single');
    setIsEditingSchedule(item.id);

    const d = new Date(item.date);
    // Rough way to extract local date/time parts if saved as UTC
    // Depending on timezone needs, might need better handling
    // For now simple split
    const dateStr = item.date.split('T')[0];
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    setFormData({
      date: dateStr,
      time: timeStr,
      message: item.message,
      file: null,
      fileName: item.attachment_name || '',
      type: item.type as any
    });
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!window.confirm('Excluir este agendamento?')) return;
    const { error } = await supabase.from('schedules').delete().eq('id', id);
    if (!error) {
      setSchedules(schedules.filter(s => s.id !== id));
    }
  };

  const handleSendNow = async (item: ScheduleItem) => {
    if (!item.id) return;
    const result = await sendMessage({
      phone: client.phone,
      message: item.message,
      attachmentUrl: item.attachment_url
    });

    if (result.success) {
      if (result.method === 'link' && result.url) {
        window.open(result.url, '_blank');
      } else {
        alert('Mensagem enviada com sucesso pela API!');
      }
      supabase.from('schedules').update({ status: 'sent' }).eq('id', item.id).then();
      setSchedules(prev => prev.map(s => s.id === item.id ? { ...s, status: 'sent' } : s));
    } else {
      alert(`Erro ao enviar mensagem pela API. Detalhe: ${JSON.stringify(result.error)}`);
    }
  };

  const resetForm = () => {
    setIsEditingSchedule(null);
    setActiveTab('single');
    setFormData({
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      message: '',
      file: null,
      fileName: '',
      type: 'general'
    });
    setBatchSettings({ startDate: new Date().toISOString().split('T')[0], startTime: '09:00', months: 3, baseMessage: '' });
    setBatchDrafts([]);
  };

  const generateAIMessage = (target: 'single' | number) => {
    const messages = [
      `Olá ${client.name}! Preparado para superar seus limites este mês? Segue em anexo seu novo plano. 💪`,
      `Fala ${client.name}, tudo bem? Enviando as atualizações do seu protocolo. Vamos pra cima! 🚀`,
      `Oi ${client.name}! Passando para deixar seu novo planejamento. Foco total! 🔥`
    ];
    const msg = messages[Math.floor(Math.random() * messages.length)];

    if (target === 'single') {
      setFormData({ ...formData, message: msg });
    } else {
      const newDrafts = [...batchDrafts];
      newDrafts[target].message = msg;
      setBatchDrafts(newDrafts);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-dark-900 w-full max-w-6xl max-h-[90vh] rounded-2xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-dark-800 p-6 border-b border-gray-700 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <img
              src={client.avatar_url || `https://ui-avatars.com/api/?name=${client.name}`}
              alt={client.name}
              className="w-12 h-12 rounded-full ring-2 ring-primary-500"
            />
            <div>
              <h2 className="text-2xl font-bold text-white">{client.name}</h2>
              <div className="flex space-x-2 mt-1">
                <span className="flex items-center text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                  <MessageCircle size={12} className="mr-1" /> WhatsApp
                </span>
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                  {client.plan_type}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={28} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row">

          {/* Left Panel: List of Schedules */}
          <div className="lg:w-1/3 p-6 border-r border-gray-800 bg-dark-900/50 hidden lg:block overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <CalendarIcon className="mr-2 text-primary-500" size={20} />
              Histórico / Futuro
            </h3>
            {loading ? (
              <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary-500" /></div>
            ) : (
              <div className="space-y-3">
                {schedules.map((item) => (
                  <div key={item.id} className={`p-4 rounded-xl border transition-all ${isEditingSchedule === item.id ? 'bg-primary-900/10 border-primary-500' : 'bg-dark-800 border-gray-700'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-semibold text-primary-400 flex items-center">
                        <CalendarIcon size={14} className="mr-1" />
                        {new Date(item.date).toLocaleDateString()} <span className="text-gray-500 text-xs ml-1">({new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                      </span>
                      <div className="flex space-x-1">
                        <button onClick={() => handleSendNow(item)} className="p-1.5 bg-green-500/10 text-green-400 rounded hover:bg-green-500 hover:text-white"><Send size={14} /></button>
                        <button onClick={() => handleEditClick(item)} className="p-1.5 bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500 hover:text-white"><Edit2 size={14} /></button>
                        <button onClick={() => item.id && handleDeleteSchedule(item.id)} className="p-1.5 bg-red-500/10 text-red-400 rounded hover:bg-red-500 hover:text-white"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <p className="text-gray-300 text-xs mb-2 line-clamp-2">{item.message}</p>
                    {item.attachment_name && (
                      <div className="text-xs bg-dark-900 p-1.5 rounded text-gray-400 flex items-center gap-1 overflow-hidden">
                        <FileText size={12} /> <span className="truncate">{item.attachment_name}</span>
                      </div>
                    )}
                    <div className="mt-1 text-[10px] text-right text-gray-500 uppercase font-bold">{item.status}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Panel: Form Area */}
          <div className="lg:w-2/3 p-6 bg-dark-800 flex flex-col" id="schedule-form">

            {/* Tabs */}
            {!isEditingSchedule && (
              <div className="flex space-x-4 mb-6 border-b border-gray-700 pb-2">
                <button
                  onClick={() => setActiveTab('single')}
                  className={`pb-2 px-4 text-sm font-bold transition-colors border-b-2 ${activeTab === 'single' ? 'border-primary-500 text-primary-500' : 'border-transparent text-gray-500 hover:text-white'}`}
                >
                  Envio Único
                </button>
                <button
                  onClick={() => setActiveTab('batch')}
                  className={`pb-2 px-4 text-sm font-bold transition-colors border-b-2 ${activeTab === 'batch' ? 'border-primary-500 text-primary-500' : 'border-transparent text-gray-500 hover:text-white'}`}
                >
                  Planejamento em Lote (Multi-Mês)
                </button>
              </div>
            )}

            {isEditingSchedule && (
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Editar Agendamento</h3>
                <button onClick={resetForm} className="text-sm text-gray-400 underline">Cancelar Edição</button>
              </div>
            )}

            {/* SINGLE FORM */}
            {activeTab === 'single' && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Data</label>
                    <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full bg-dark-900 border border-gray-700 rounded-lg p-3 text-white focus:border-primary-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Horário</label>
                    <input type="time" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} className="w-full bg-dark-900 border border-gray-700 rounded-lg p-3 text-white focus:border-primary-500 outline-none" />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-1">Tipo</label>
                  <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as any })} className="w-full bg-dark-900 border border-gray-700 rounded-lg p-3 text-white outline-none">
                    <option value="general">Geral</option>
                    <option value="workout">Treino</option>
                    <option value="diet">Dieta</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm text-gray-400">Mensagem</label>
                    <button onClick={() => generateAIMessage('single')} className="text-xs text-primary-400 flex items-center gap-1"><Wand2 size={12} /> Sugerir AI</button>
                  </div>
                  <textarea rows={4} value={formData.message} onChange={e => setFormData({ ...formData, message: e.target.value })} className="w-full bg-dark-900 border border-gray-700 rounded-lg p-3 text-white focus:border-primary-500 outline-none resize-none" />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Anexo (PDF)</label>
                  <div className="flex gap-2">
                    <label className="flex-1 bg-dark-900 border border-gray-700 rounded-lg p-3 flex items-center justify-center cursor-pointer hover:border-primary-500 transition-colors">
                      <FileText className="text-gray-500 mr-2" />
                      <span className="text-gray-300 text-sm truncate">{formData.fileName || "Selecionar PDF..."}</span>
                      <input type="file" accept=".pdf" className="hidden" onChange={e => {
                        if (e.target.files?.[0]) setFormData({ ...formData, file: e.target.files[0], fileName: e.target.files[0].name });
                      }} />
                    </label>
                    {formData.fileName && <button onClick={() => setFormData({ ...formData, file: null, fileName: '' })} className="p-3 bg-red-500/20 text-red-500 rounded-lg"><X size={20} /></button>}
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    disabled={saving}
                    onClick={handleSaveSingle}
                    className="w-full py-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold flex items-center justify-center shadow-lg shadow-primary-900/20"
                  >
                    {saving ? 'Salvando...' : 'Salvar Agendamento'} <Send size={18} className="ml-2" />
                  </button>
                </div>
              </div>
            )}

            {/* BATCH MODE */}
            {activeTab === 'batch' && (
              <div className="flex-1 flex flex-col h-full animate-fade-in">

                {/* Settings Bar */}
                <div className="flex gap-4 mb-6 bg-dark-900 p-4 rounded-xl border border-gray-700 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Início</label>
                    <input type="date" value={batchSettings.startDate} onChange={e => setBatchSettings({ ...batchSettings, startDate: e.target.value })} className="w-full bg-dark-800 border border-gray-600 rounded p-2 text-white text-sm" />
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Hora Padrão</label>
                    <input type="time" value={batchSettings.startTime} onChange={e => setBatchSettings({ ...batchSettings, startTime: e.target.value })} className="w-full bg-dark-800 border border-gray-600 rounded p-2 text-white text-sm" />
                  </div>
                  <div className="w-32">
                    <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Qtd. Meses</label>
                    <select value={batchSettings.months} onChange={e => setBatchSettings({ ...batchSettings, months: Number(e.target.value) })} className="w-full bg-dark-800 border border-gray-600 rounded p-2 text-white text-sm">
                      <option value={2}>2 Meses</option>
                      <option value={3}>3 Meses</option>
                      <option value={6}>6 Meses</option>
                      <option value={12}>12 Meses</option>
                    </select>
                  </div>
                </div>

                {/* Draggable/Scrollable List of Drafts */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                  {batchDrafts.map((draft, index) => (
                    <div key={draft.id} className="bg-dark-900 border border-gray-700 rounded-xl p-4 flex gap-4 items-start hover:border-gray-500 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-primary-900/30 text-primary-400 flex items-center justify-center font-bold text-sm shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Date & Type */}
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <input
                              type="date"
                              value={draft.date}
                              onChange={(e) => {
                                const newDrafts = [...batchDrafts];
                                newDrafts[index].date = e.target.value;
                                setBatchDrafts(newDrafts);
                              }}
                              className="flex-1 bg-dark-800 border border-gray-600 rounded p-2 text-white text-sm"
                            />
                            <input
                              type="time"
                              value={draft.time}
                              onChange={(e) => {
                                const newDrafts = [...batchDrafts];
                                newDrafts[index].time = e.target.value;
                                setBatchDrafts(newDrafts);
                              }}
                              className="w-24 bg-dark-800 border border-gray-600 rounded p-2 text-white text-sm"
                            />
                          </div>

                          {/* File Upload Mini */}
                          <div className="flex items-center gap-2">
                            <label className="flex-1 bg-dark-800 border border-gray-600 border-dashed rounded p-2 flex items-center justify-center cursor-pointer hover:bg-dark-700 hover:border-gray-500 transition-colors">
                              <FileText size={14} className={draft.fileName ? "text-primary-400" : "text-gray-500"} />
                              <span className="ml-2 text-xs truncate max-w-[120px] text-gray-300">
                                {draft.fileName || "Anexar PDF"}
                              </span>
                              <input type="file" accept=".pdf" className="hidden" onChange={e => {
                                if (e.target.files?.[0]) {
                                  const newDrafts = [...batchDrafts];
                                  newDrafts[index].file = e.target.files[0];
                                  newDrafts[index].fileName = e.target.files[0].name;
                                  setBatchDrafts(newDrafts);
                                }
                              }} />
                            </label>
                            {draft.fileName && (
                              <button onClick={() => {
                                const newDrafts = [...batchDrafts];
                                newDrafts[index].file = null;
                                newDrafts[index].fileName = '';
                                setBatchDrafts(newDrafts);
                              }} className="p-2 text-xs text-red-500 hover:bg-red-500/10 rounded"><X size={14} /></button>
                            )}
                          </div>
                        </div>

                        {/* Message */}
                        <div className="relative">
                          <textarea
                            placeholder="Mensagem para este mês..."
                            rows={3}
                            value={draft.message}
                            onChange={e => {
                              const newDrafts = [...batchDrafts];
                              newDrafts[index].message = e.target.value;
                              setBatchDrafts(newDrafts);
                            }}
                            className="w-full bg-dark-800 border border-gray-600 rounded p-2 text-white text-sm resize-none focus:border-primary-500 outline-none"
                          />
                          <button onClick={() => generateAIMessage(index)} className="absolute bottom-2 right-2 text-xs text-primary-400 hover:text-white bg-dark-900/80 px-2 py-1 rounded backdrop-blur">
                            <Wand2 size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 mt-auto border-t border-gray-700">
                  <button
                    disabled={saving}
                    onClick={handleSaveBatch}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white font-bold flex items-center justify-center shadow-lg shadow-primary-900/20"
                  >
                    {saving ? 'Processando...' : `Confirmar e Criar ${batchDrafts.length} Agendamentos`} <CalendarIcon size={18} className="ml-2" />
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};