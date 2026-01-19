
import React, { useState, useEffect } from 'react';
import { Client, ScheduleItem } from '../types';
import { supabase } from '../services/supabase';
import { sendMessage } from '../services/whatsapp';
import { X, MessageCircle, Calendar as CalendarIcon, FileText, Trash2, Edit2, Plus, Send, Loader2, ArrowUp, ArrowDown, Type } from 'lucide-react';
import { CustomSelect } from './CustomSelect';
import { translatePlanType, translateStatus, translateScheduleType } from '../utils/formatters';

interface ClientManagerProps {
  client: Client;
  onClose: () => void;
  onUpdateClient: (updatedClient: Client) => void;
}

interface DraftItem {
  id: string; // temp id
  date: string;
  time: string; // NEW
  type: 'workout' | 'diet' | 'general';
  items: ScheduleCompositionItem[];
}

interface ScheduleCompositionItem {
  id: string;
  type: 'text' | 'file';
  content?: string; // for text
  file?: File | null; // for file
  fileName?: string; // for file display
}

export const ClientManager: React.FC<ClientManagerProps> = ({ client, onClose, onUpdateClient }) => {
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [isEditingSchedule, setIsEditingSchedule] = useState<string | null>(null); // Restored state

  // Form Data (Single)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    type: 'general' as 'workout' | 'diet' | 'checkin' | 'general',
    // Composition Items (New)
    items: [] as ScheduleCompositionItem[]
  });

  // Initialize with one text item if empty
  useEffect(() => {
    if (formData.items.length === 0) {
      setFormData(prev => ({ ...prev, items: [{ id: Math.random().toString(36), type: 'text', content: '' }] }));
    }
  }, []);

  // Batch Drafts
  const [batchSettings, setBatchSettings] = useState({
    startDate: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    months: 3,
    type: 'general' as const,
    baseMessage: ''
  });
  const [batchDrafts, setBatchDrafts] = useState<DraftItem[]>([]);

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
          type: existing?.type || batchSettings.type,
          items: existing?.items || [{ id: Math.random().toString(36), type: 'text', content: batchSettings.baseMessage || '' }]
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
    // Validation
    if (!formData.date || !formData.time) return alert('Selecione data e hora.');
    if (formData.items.length === 0) return alert('Adicione pelo menos uma mensagem ou arquivo.');

    // Check if any text item is empty
    const hasEmptyText = formData.items.some(i => i.type === 'text' && !i.content?.trim());
    if (hasEmptyText) return alert('Preencha o texto de todas as mensagens.');

    setSaving(true);

    const scheduledDate = new Date(`${formData.date}T${formData.time}`); // Local to ISO? careful with timezone
    // The input type=date/time gives local strings. Constructing Date() creates local. toISOString() converts to UTC.
    // Correct.

    try {
      // Loop through items and save sequentially with +1 second offset
      for (let i = 0; i < formData.items.length; i++) {
        const item = formData.items[i];
        const offsetDate = new Date(scheduledDate.getTime() + (i * 1000)); // +1 second per item to keep order

        let attachmentUrl = '';

        if (item.type === 'file' && item.file) {
          const fileExt = item.file.name.split('.').pop();
          const filePath = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('pdfs').upload(filePath, item.file);
          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage.from('pdfs').getPublicUrl(filePath);
          attachmentUrl = urlData.publicUrl;
        }

        const payload = {
          client_id: client.id,
          date: offsetDate.toISOString(),
          type: formData.type,
          message: item.type === 'text' ? item.content : null,
          attachment_url: attachmentUrl || null,
          attachment_name: item.type === 'file' ? item.fileName : null,
          status: 'pending'
        };

        const { error } = await supabase.from('schedules').insert([payload]);
        if (error) throw error;
      }

      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        time: '09:00',
        type: 'workout',
        items: [{ id: Math.random().toString(36), type: 'text', content: '' }]
      });
      fetchSchedules();
    } catch (error) {
      console.error(error);
      alert('Erro ao agendar.');
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
        // Validation per draft? Maybe skip empty ones or alert?
        // For now, if items exist, we process.

        const draftDate = new Date(`${draft.date}T${draft.time}`);

        for (let i = 0; i < draft.items.length; i++) {
          const item = draft.items[i];
          // Offset time by 1 second for each item to maintain order
          const offsetDate = new Date(draftDate.getTime() + (i * 1000));

          let attachmentUrl = undefined;
          if (item.type === 'file' && item.file) {
            const url = await uploadFile(item.file);
            if (url) attachmentUrl = url;
          }

          newItems.push({
            client_id: client.id,
            date: offsetDate.toISOString(),
            type: draft.type,
            message: item.type === 'text' ? item.content : null,
            attachment_url: attachmentUrl,
            attachment_name: item.type === 'file' ? (item.fileName || 'document.pdf') : null,
            status: 'pending'
          });
        }
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
    const dateStr = item.date.split('T')[0];
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    // Determine if it's a file or text
    let newItems: ScheduleCompositionItem[] = [];

    if (item.attachment_name || item.attachment_url) {
      newItems.push({
        id: Math.random().toString(36),
        type: 'file',
        fileName: item.attachment_name || 'Arquivo Anexado',
        // Note: We can't recover the File object, but we can keep the URL if we wanted. 
        // For now, editing a file implies re-uploading if changed, or we warn user.
        // But the current flow expects a File object for upload.
        // Simplified: If editing, we show the name. If they don't change it, we might need logic to keep existing URL.
        // For now, let's treat it as a visual placeholder.
      });
    } else {
      newItems.push({
        id: Math.random().toString(36),
        type: 'text',
        content: item.message || ''
      });
    }

    setFormData({
      date: dateStr,
      time: timeStr,
      type: item.type as any,
      items: newItems
    });

    // Auto-scroll to form (UX improvement for mobile)
    setTimeout(() => {
      document.getElementById('schedule-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
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
      type: 'general',
      items: [{ id: Math.random().toString(36), type: 'text', content: '' }]
    });
    setBatchSettings({ startDate: new Date().toISOString().split('T')[0], startTime: '09:00', months: 3, baseMessage: '' });
    setBatchDrafts([]);
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
                  {translatePlanType(client.plan_type)}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={28} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto flex flex-col-reverse lg:flex-row">

          {/* Left Panel: List of Schedules */}
          <div className="w-full lg:w-1/3 p-6 border-t lg:border-t-0 lg:border-r border-gray-800 bg-dark-900/50 block h-auto">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <CalendarIcon className="mr-2 text-primary-500" size={20} />
              Histórico / Futuro
            </h3>
            {loading ? (
              <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary-500" /></div>
            ) : (
              <div className="space-y-3">
                {schedules.length === 0 && <p className="text-gray-500 text-sm text-center py-4">Nenhum agendamento encontrado.</p>}
                {schedules.map((item) => (
                  <div key={item.id} className={`p-4 rounded-xl border transition-all ${isEditingSchedule === item.id ? 'bg-primary-900/10 border-primary-500' : 'bg-dark-800 border-gray-700'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-semibold text-primary-400 flex items-center">
                        <CalendarIcon size={14} className="mr-1" />
                        {new Date(item.date).toLocaleDateString()} <span className="text-gray-500 text-xs ml-1">({new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                      </span>
                      <span className="hidden sm:inline-block text-[10px] bg-dark-900 text-gray-400 px-1.5 py-0.5 rounded border border-gray-700 uppercase">{translateScheduleType(item.type)}</span>
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
                    <div className="mt-1 text-[10px] text-right text-gray-500 uppercase font-bold">{translateStatus(item.status)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Panel: Form Area */}
          <div className="w-full lg:w-2/3 p-6 bg-dark-800 flex flex-col" id="schedule-form">

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
                    <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full bg-dark-900 border border-gray-700 rounded-lg p-3 text-white focus:border-primary-500 outline-none [color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Horário</label>
                    <input type="time" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} className="w-full bg-dark-900 border border-gray-700 rounded-lg p-3 text-white focus:border-primary-500 outline-none [color-scheme:dark]" />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-1">Tipo</label>
                  <CustomSelect
                    value={formData.type}
                    onChange={val => setFormData({ ...formData, type: val as any })}
                    options={[
                      { value: 'general', label: 'Geral' },
                      { value: 'workout', label: 'Treino' },
                      { value: 'diet', label: 'Dieta' }
                    ]}
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm text-gray-400">Conteúdo do Envio (Mensagens e Arquivos)</label>
                  </div>

                  <div className="space-y-3 mb-4">
                    {formData.items.map((item, index) => (
                      <div key={item.id} className="bg-dark-800 border border-gray-700 rounded-xl p-3 animate-fade-in relative group">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                            {item.type === 'text' ? <><MessageCircle size={10} /> Mensagem</> : <><FileText size={10} /> Arquivo PDF</>}
                            <span className="ml-2 font-normal text-gray-600">#{index + 1}</span>
                          </span>
                          <div className="flex gap-1">
                            <button
                              disabled={index === 0}
                              onClick={() => {
                                const newItems = [...formData.items];
                                [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
                                setFormData({ ...formData, items: newItems });
                              }}
                              className="p-1 hover:bg-gray-700 rounded text-gray-500 hover:text-white disabled:opacity-30"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              disabled={index === formData.items.length - 1}
                              onClick={() => {
                                const newItems = [...formData.items];
                                [newItems[index + 1], newItems[index]] = [newItems[index], newItems[index + 1]];
                                setFormData({ ...formData, items: newItems });
                              }}
                              className="p-1 hover:bg-gray-700 rounded text-gray-500 hover:text-white disabled:opacity-30"
                            >
                              <ArrowDown size={12} />
                            </button>
                            <button
                              onClick={() => setFormData({ ...formData, items: formData.items.filter(i => i.id !== item.id) })}
                              className="p-1 hover:bg-red-500/20 rounded text-red-500 hover:text-red-400 ml-1"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>

                        {item.type === 'text' ? (
                          <textarea
                            rows={3}
                            placeholder="Digite a mensagem..."
                            value={item.content || ''}
                            onChange={e => {
                              const newItems = [...formData.items];
                              newItems[index].content = e.target.value;
                              setFormData({ ...formData, items: newItems });
                            }}
                            className="w-full bg-dark-900 border border-gray-700 rounded-lg p-3 text-white focus:border-primary-500 outline-none resize-none text-sm"
                          />
                        ) : (
                          <div className="flex gap-2">
                            <label className="flex-1 bg-dark-900 border border-gray-700 rounded-lg p-3 flex items-center justify-center cursor-pointer hover:border-primary-500 transition-colors">
                              <FileText className="text-gray-500 mr-2" />
                              <span className="text-gray-300 text-sm truncate">{item.fileName || "Selecionar PDF..."}</span>
                              <input type="file" accept=".pdf" className="hidden" onChange={e => {
                                if (e.target.files?.[0]) {
                                  const newItems = [...formData.items];
                                  newItems[index].file = e.target.files[0];
                                  newItems[index].fileName = e.target.files[0].name;
                                  setFormData({ ...formData, items: newItems });
                                }
                              }} />
                            </label>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setFormData({ ...formData, items: [...formData.items, { id: Math.random().toString(36), type: 'text', content: '' }] })}
                      className="flex-1 py-2 rounded-lg border border-dashed border-gray-600 text-gray-400 hover:border-primary-500 hover:text-primary-500 flex items-center justify-center text-sm transition-all"
                    >
                      <Type size={14} className="mr-2" /> Adicionar Texto
                    </button>
                    <button
                      onClick={() => setFormData({ ...formData, items: [...formData.items, { id: Math.random().toString(36), type: 'file', fileName: '' }] })}
                      className="flex-1 py-2 rounded-lg border border-dashed border-gray-600 text-gray-400 hover:border-primary-500 hover:text-primary-500 flex items-center justify-center text-sm transition-all"
                    >
                      <FileText size={14} className="mr-2" /> Adicionar PDF
                    </button>
                  </div>

                </div>

                <div className="pt-2">
                  <button
                    disabled={saving}
                    onClick={handleSaveSingle}
                    className="w-full py-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold flex items-center justify-center shadow-lg shadow-primary-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Enviando...' : `Agendar ${formData.items.length} Item(ns)`} <Send size={18} className="ml-2" />
                  </button>
                </div>
              </div>
            )}

            {/* BATCH MODE */}
            {activeTab === 'batch' && (
              <div className="flex-1 flex flex-col h-full animate-fade-in">

                {/* Settings Bar */}
                {/* Settings Bar */}
                <div className="flex flex-col md:flex-row gap-4 mb-6 bg-dark-900 p-4 rounded-xl border border-gray-700 md:items-end">
                  <div className="flex-1 w-full">
                    <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Início</label>
                    <input type="date" value={batchSettings.startDate} onChange={e => setBatchSettings({ ...batchSettings, startDate: e.target.value })} className="w-full bg-dark-800 border border-gray-600 rounded p-2 text-white text-sm [color-scheme:dark]" />
                  </div>
                  <div className="flex gap-4 w-full md:w-auto">
                    <div className="flex-1 md:w-24">
                      <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Hora Padrão</label>
                      <input type="time" value={batchSettings.startTime} onChange={e => setBatchSettings({ ...batchSettings, startTime: e.target.value })} className="w-full bg-dark-800 border border-gray-600 rounded p-2 text-white text-sm [color-scheme:dark]" />
                    </div>
                    <div className="flex-1 md:w-36">
                      <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Qtd. Meses</label>
                      <CustomSelect
                        value={String(batchSettings.months)}
                        onChange={val => setBatchSettings({ ...batchSettings, months: Number(val) })}
                        options={[
                          { value: '2', label: '2 Meses' },
                          { value: '3', label: '3 Meses' },
                          { value: '6', label: '6 Meses' },
                          { value: '12', label: '12 Meses' }
                        ]}
                      />
                    </div>
                  </div>
                </div>

                {/* Draggable/Scrollable List of Drafts */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 sm:pr-2">
                  {batchDrafts.map((draft, index) => (
                    <div key={draft.id} className="bg-dark-900 border border-gray-700 rounded-xl p-3 sm:p-4 flex gap-3 sm:gap-4 items-start hover:border-gray-500 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-primary-900/30 text-primary-400 flex items-center justify-center font-bold text-sm shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 flex flex-col gap-3">
                        {/* Date & Time */}
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="date"
                            value={draft.date}
                            onChange={(e) => {
                              const newDrafts = [...batchDrafts];
                              newDrafts[index].date = e.target.value;
                              setBatchDrafts(newDrafts);
                            }}
                            className="w-full sm:flex-1 bg-dark-800 border border-gray-600 rounded p-2 text-white text-sm [color-scheme:dark]"
                          />
                          <input
                            type="time"
                            value={draft.time}
                            onChange={(e) => {
                              const newDrafts = [...batchDrafts];
                              newDrafts[index].time = e.target.value;
                              setBatchDrafts(newDrafts);
                            }}
                            className="w-full sm:w-24 bg-dark-800 border border-gray-600 rounded p-2 text-white text-sm [color-scheme:dark]"
                          />
                        </div>

                        {/* Items List */}
                        <div className="space-y-2">
                          {draft.items.map((item, itemIndex) => (
                            <div key={item.id} className="bg-dark-800 border border-gray-700/50 rounded-lg p-2 relative group flex flex-col gap-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                                  {item.type === 'text' ? <><MessageCircle size={10} /> Mensagem</> : <><FileText size={10} /> Arquivo</>}
                                  <span className="ml-1">#{itemIndex + 1}</span>
                                </span>
                                <div className="flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                                  <button
                                    disabled={itemIndex === 0}
                                    onClick={() => {
                                      const newDrafts = [...batchDrafts];
                                      const items = [...newDrafts[index].items];
                                      [items[itemIndex - 1], items[itemIndex]] = [items[itemIndex], items[itemIndex - 1]];
                                      newDrafts[index].items = items;
                                      setBatchDrafts(newDrafts);
                                    }}
                                    className="p-1 hover:bg-gray-700 text-gray-400 hover:text-white rounded disabled:opacity-30"
                                  ><ArrowUp size={12} /></button>
                                  <button
                                    disabled={itemIndex === draft.items.length - 1}
                                    onClick={() => {
                                      const newDrafts = [...batchDrafts];
                                      const items = [...newDrafts[index].items];
                                      [items[itemIndex + 1], items[itemIndex]] = [items[itemIndex], items[itemIndex + 1]];
                                      newDrafts[index].items = items;
                                      setBatchDrafts(newDrafts);
                                    }}
                                    className="p-1 hover:bg-gray-700 text-gray-400 hover:text-white rounded disabled:opacity-30"
                                  ><ArrowDown size={12} /></button>
                                  <button
                                    onClick={() => {
                                      const newDrafts = [...batchDrafts];
                                      const items = [...newDrafts[index].items];
                                      newDrafts[index].items = items.filter(i => i.id !== item.id);
                                      setBatchDrafts(newDrafts);
                                    }}
                                    className="p-1 hover:bg-red-500/20 text-red-500 rounded ml-1"
                                  ><X size={12} /></button>
                                </div>
                              </div>

                              {item.type === 'text' ? (
                                <textarea
                                  rows={2}
                                  value={item.content || ''}
                                  onChange={e => {
                                    const newDrafts = [...batchDrafts];
                                    newDrafts[index].items[itemIndex].content = e.target.value;
                                    setBatchDrafts(newDrafts);
                                  }}
                                  placeholder="Digite a mensagem..."
                                  className="w-full bg-dark-900/50 border border-gray-700 rounded p-2 text-xs text-white resize-none focus:border-primary-500 outline-none"
                                />
                              ) : (
                                <label className="flex items-center gap-2 bg-dark-900/50 border border-gray-700 border-dashed rounded p-2 cursor-pointer hover:border-primary-500 transition-colors">
                                  <FileText size={14} className="text-gray-400" />
                                  <span className="text-xs text-gray-300 truncate flex-1">{item.fileName || "Selecionar PDF"}</span>
                                  <input type="file" accept=".pdf" className="hidden" onChange={e => {
                                    if (e.target.files?.[0]) {
                                      const newDrafts = [...batchDrafts];
                                      newDrafts[index].items[itemIndex].file = e.target.files[0];
                                      newDrafts[index].items[itemIndex].fileName = e.target.files[0].name;
                                      setBatchDrafts(newDrafts);
                                    }
                                  }} />
                                </label>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Add Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const newDrafts = [...batchDrafts];
                              newDrafts[index].items.push({ id: Math.random().toString(36), type: 'text', content: '' });
                              setBatchDrafts(newDrafts);
                            }}
                            className="flex-1 py-1.5 rounded border border-dashed border-gray-600 text-xs text-gray-400 hover:border-primary-500 hover:text-primary-500"
                          >+ Texto</button>
                          <button
                            onClick={() => {
                              const newDrafts = [...batchDrafts];
                              newDrafts[index].items.push({ id: Math.random().toString(36), type: 'file', fileName: '' });
                              setBatchDrafts(newDrafts);
                            }}
                            className="flex-1 py-1.5 rounded border border-dashed border-gray-600 text-xs text-gray-400 hover:border-primary-500 hover:text-primary-500"
                          >+ PDF</button>
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
    </div >
  );
};