import React, { useState, useEffect } from 'react';
import { Client, FeedbackQuestion, FeedbackSubmission, ServiceType } from '../types';
import { supabase } from '../services/supabase';
import { sendMessage } from '../services/whatsapp';
import { Plus, Trash2, Save, MessageSquare, CheckCircle2, ChevronDown, ChevronUp, Send, FileEdit, History, Settings, Loader2, Bot, CalendarClock, Power, User, Users } from 'lucide-react';
import { CustomSelect } from './CustomSelect';

interface FeedbackManagerProps {
  clients: Client[];
}

interface FeedbackSchedule {
  id: string;
  name: string;
  service_type: string | null;
  client_id: string | null;
  frequency_days: number;
  next_run_at: string;
  active: boolean;
  questions: FeedbackQuestion[];
}

export const FeedbackManager: React.FC<FeedbackManagerProps> = ({ clients }) => {
  const [activeTab, setActiveTab] = useState<'register' | 'history' | 'config' | 'automation'>('register');
  const [loading, setLoading] = useState(false);

  // Custom State
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [submissions, setSubmissions] = useState<FeedbackSubmission[]>([]);

  // Automation State
  const [schedules, setSchedules] = useState<FeedbackSchedule[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);

  // New Automation Form State
  const [targetType, setTargetType] = useState<'service' | 'client'>('service');
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    service_type: '',
    client_id: '',
    frequency: '7'
  });
  const [customQuestions, setCustomQuestions] = useState<FeedbackQuestion[]>([]);

  // Inputs
  const [registerMode, setRegisterMode] = useState<'individual' | 'bulk'>('individual');
  const [selectedServiceTypeForBulk, setSelectedServiceTypeForBulk] = useState('');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [feedbackDate, setFeedbackDate] = useState(new Date().toISOString().split('T')[0]);
  const [inputAnswers, setInputAnswers] = useState<Record<string, string>>({});

  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);

  // Question Selector Modal State
  const [showQuestionSelector, setShowQuestionSelector] = useState(false);
  const [selectedQuestionsToSend, setSelectedQuestionsToSend] = useState<string[]>([]);

  // Automation: Global Question Selector
  const [globalQuestionToAdd, setGlobalQuestionToAdd] = useState('');

  // --- Initial Data Fetch ---
  useEffect(() => {
    fetchQuestions();
    fetchSubmissions();
    fetchSchedules();
    fetchServiceTypes();
  }, []);

  // When opening automation tab or fetching questions, init custom questions with default ones
  useEffect(() => {
    if (questions.length > 0 && customQuestions.length === 0) {
      setCustomQuestions([...questions]);
    }
    // Also init selected questions for manual send
    if (questions.length > 0) {
      setSelectedQuestionsToSend(questions.map(q => q.text));
    }
  }, [questions]);

  const fetchQuestions = async () => {
    const { data } = await supabase.from('feedback_questions').select('*').order('order', { ascending: true });
    if (data) setQuestions(data as FeedbackQuestion[]);
  };

  const fetchSubmissions = async () => {
    const { data, error } = await supabase
      .from('feedback_submissions')
      .select('*, clients(name, avatar_url, phone)')
      .order('created_at', { ascending: false });

    if (data) {
      setSubmissions(data as any);
    }
  };

  const fetchSchedules = async () => {
    const { data } = await supabase.from('feedback_schedules').select('*').order('created_at', { ascending: false });
    if (data) setSchedules(data as FeedbackSchedule[]);
  };

  const fetchServiceTypes = async () => {
    const { data } = await supabase.from('service_types').select('*').order('name');
    if (data) setServiceTypes(data);
  };

  // --- Handlers ---

  const handleAddQuestion = async () => {
    if (!newQuestionText.trim()) return;
    const newOrder = questions.length;
    const { data, error } = await supabase
      .from('feedback_questions')
      .insert([{ text: newQuestionText, order: newOrder }])
      .select();

    if (data) {
      setQuestions([...questions, data[0] as FeedbackQuestion]);
      setNewQuestionText('');
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    await supabase.from('feedback_questions').delete().eq('id', id);
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleSaveManualFeedback = async () => {
    if (!selectedClientId) {
      alert("Selecione um aluno.");
      return;
    }

    const answersArray = questions.map(q => ({
      question: q.text,
      answer: inputAnswers[q.id] || 'Não informado'
    }));

    setLoading(true);
    const { error } = await supabase.from('feedback_submissions').insert([{
      client_id: selectedClientId,
      created_at: new Date(feedbackDate).toISOString(),
      answers: answersArray, // Supabase handles JSONB
      status: 'reviewed'
    }]);

    setLoading(false);

    if (!error) {
      alert("Feedback salvo com sucesso!");
      setInputAnswers({});
      fetchSubmissions(); // Refresh history
      setActiveTab('history');
    } else {
      alert("Erro ao salvar.");
    }
  };

  const handleOpenWhatsAppModal = () => {
    if (registerMode === 'individual' && !selectedClientId) {
      alert("Selecione um aluno primeiro.");
      return;
    }
    if (registerMode === 'bulk' && !selectedServiceTypeForBulk) {
      alert("Selecione um serviço primeiro.");
      return;
    }
    setShowQuestionSelector(true);
  };

  const handleSendSelectedQuestions = async () => {
    if (selectedQuestionsToSend.length === 0) {
      alert("Selecione pelo menos uma pergunta.");
      return;
    }

    // Construct Message
    let messageBody = ``;
    selectedQuestionsToSend.forEach((qText) => {
      messageBody += `${qText}\n`;
    });

    // MODE: INDIVIDUAL (Direct API)
    if (registerMode === 'individual') {
      const client = clients.find(c => c.id === selectedClientId);
      if (!client) return;

      setLoading(true);

      const fullMessage = messageBody;

      // Send immediately via Client-side service
      const response = await sendMessage({
        phone: client.phone,
        message: fullMessage
      });

      setLoading(false);
      setShowQuestionSelector(false);

      if (response.success) {
        alert(response.method === 'link' ? "Abrindo WhatsApp..." : "Mensagem enviada com sucesso!");
        if (response.method === 'link' && response.url) {
          window.open(response.url, '_blank');
        }
      } else {
        console.error(response.error);
        alert("Erro ao enviar mensagem. Verifique a configuração da API.");
      }
    }
    // MODE: BULK (Loop calling API)
    else {
      if (!window.confirm(`Tem certeza que deseja enviar para TODOS os alunos de "${selectedServiceTypeForBulk}"? ISSO SERÁ FEITO AGORA.`)) return;

      setLoading(true);

      // 1. Fetch targeted clients
      const { data: targetClients } = await supabase
        .from('clients')
        .select('*')
        .eq('service_type', selectedServiceTypeForBulk)
        .in('status', ['active', 'expiring']);

      if (!targetClients || targetClients.length === 0) {
        alert("Nenhum aluno ativo encontrado para este serviço.");
        setLoading(false);
        return;
      }

      // 2. Loop and send directly (Frontend Loop)
      let successCount = 0;
      let failCount = 0;

      for (const client of targetClients) {
        if (!client.phone) continue;

        const fullMessage = messageBody;

        try {
          // Short delay to avoid rate limit spam
          await new Promise(r => setTimeout(r, 1000));

          const res = await sendMessage({
            phone: client.phone,
            message: fullMessage
          });

          if (res.success) successCount++;
          else failCount++;

        } catch (err) {
          console.error(`Failed to send to ${client.name}`, err);
          failCount++;
        }
      }

      setLoading(false);
      setShowQuestionSelector(false);
      alert(`Processo finalizado!\nEnviados: ${successCount}\nFalhas: ${failCount}`);
    }
  };

  const toggleQuestionSelection = (qText: string) => {
    if (selectedQuestionsToSend.includes(qText)) {
      setSelectedQuestionsToSend(selectedQuestionsToSend.filter(t => t !== qText));
    } else {
      setSelectedQuestionsToSend([...selectedQuestionsToSend, qText]);
    }
  };

  // --- Automation Handlers ---

  // Custom Questions Management for Automation
  const addGlobalQuestion = (qText: string) => {
    if (!qText) return;
    setCustomQuestions([...customQuestions, { id: Math.random().toString(), text: qText, order: customQuestions.length }]);
    setGlobalQuestionToAdd('');
  };

  const addCustomQuestion = () => {
    const text = prompt('Nova pergunta para esta automação:');
    if (text) {
      setCustomQuestions([...customQuestions, { id: Math.random().toString(), text, order: customQuestions.length }]);
    }
  };

  const removeCustomQuestion = (idx: number) => {
    const newQ = [...customQuestions];
    newQ.splice(idx, 1);
    setCustomQuestions(newQ);
  };

  const handleCreateSchedule = async () => {
    if (!newSchedule.name) {
      alert('Preencha o nome da automação.');
      return;
    }
    if (targetType === 'service' && !newSchedule.service_type) {
      alert('Selecione um serviço.');
      return;
    }
    if (targetType === 'client' && !newSchedule.client_id) {
      alert('Selecione um aluno.');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.from('feedback_schedules').insert([{
      name: newSchedule.name,
      service_type: targetType === 'service' ? newSchedule.service_type : null,
      client_id: targetType === 'client' ? newSchedule.client_id : null,
      frequency_days: parseInt(newSchedule.frequency),
      active: true,
      questions: customQuestions, // Save the custom list
      next_run_at: new Date().toISOString() // Start immediately
    }]).select();

    setLoading(false);

    if (error) {
      alert('Erro ao criar automação.');
      console.error(error);
    } else {
      setSchedules([data[0], ...schedules]);
      setNewSchedule({ name: '', service_type: '', client_id: '', frequency: '7' });
      alert('Automação criada com sucesso!');
    }
  };

  const toggleSchedule = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('feedback_schedules').update({ active: !currentStatus }).eq('id', id);
    if (!error) {
      setSchedules(schedules.map(s => s.id === id ? { ...s, active: !currentStatus } : s));
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!window.confirm('Tem certeza?')) return;
    const { error } = await supabase.from('feedback_schedules').delete().eq('id', id);
    if (!error) {
      setSchedules(schedules.filter(s => s.id !== id));
    }
  };

  return (
    <div className="animate-fade-in max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Gerenciador de Feedbacks</h2>
          <p className="text-gray-400">Envie perguntas, registre respostas e acompanhe a evolução.</p>
        </div>

        {/* Tabs */}
        <div className="bg-dark-800 p-1 rounded-xl flex overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('register')}
            className={`px-4 lg:px-6 py-2 rounded-lg font-medium transition-all flex items-center whitespace-nowrap ${activeTab === 'register' ? 'bg-primary-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            <FileEdit size={18} className="mr-2" /> Registrar
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 lg:px-6 py-2 rounded-lg font-medium transition-all flex items-center whitespace-nowrap ${activeTab === 'history' ? 'bg-primary-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            <History size={18} className="mr-2" /> Histórico
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 lg:px-6 py-2 rounded-lg font-medium transition-all flex items-center whitespace-nowrap ${activeTab === 'config' ? 'bg-primary-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            <Settings size={18} className="mr-2" /> Perguntas
          </button>
          <button
            onClick={() => setActiveTab('automation')}
            className={`px-4 lg:px-6 py-2 rounded-lg font-medium transition-all flex items-center whitespace-nowrap ${activeTab === 'automation' ? 'bg-primary-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            <Bot size={18} className="mr-2" /> Automação
          </button>
        </div>
      </div>

      {/* --- TAB: MANUAL REGISTER --- */}
      {activeTab === 'register' && (
        <div className="bg-dark-800 rounded-2xl border border-gray-700 p-6 lg:p-8 shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sidebar controls */}
            <div className="lg:col-span-1 space-y-6">

              {/* Toggle Mode */}
              <div className="flex bg-dark-900 p-1 rounded-lg">
                <button
                  onClick={() => setRegisterMode('individual')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${registerMode === 'individual' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Individual
                </button>
                <button
                  onClick={() => setRegisterMode('bulk')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${registerMode === 'bulk' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Em Massa
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  {registerMode === 'individual' ? 'Selecione o Aluno' : 'Selecione o Serviço'}
                </label>

                {registerMode === 'individual' ? (
                  <CustomSelect
                    value={selectedClientId}
                    onChange={(val) => setSelectedClientId(val)}
                    options={[
                      { value: '', label: '-- Selecione --' },
                      ...clients.map(c => ({ value: c.id, label: c.name }))
                    ]}
                    placeholder="-- Selecione --"
                  />
                ) : (
                  <CustomSelect
                    value={selectedServiceTypeForBulk}
                    onChange={(val) => setSelectedServiceTypeForBulk(val)}
                    options={[
                      { value: '', label: '-- Selecione --' },
                      ...serviceTypes.map(s => ({ value: s.name, label: s.name }))
                    ]}
                    placeholder="-- Selecione --"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Data do Feedback</label>
                <input
                  type="date"
                  value={feedbackDate}
                  onChange={(e) => setFeedbackDate(e.target.value)}
                  className="w-full bg-dark-900 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div className="pt-4 border-t border-gray-700">
                <p className="text-xs text-gray-500 mb-3">Ações Rápidas</p>
                <button
                  onClick={handleOpenWhatsAppModal}
                  disabled={registerMode === 'individual' ? !selectedClientId : !selectedServiceTypeForBulk}
                  className={`w-full py-3 rounded-xl font-bold flex items-center justify-center transition-all ${(registerMode === 'individual' ? !selectedClientId : !selectedServiceTypeForBulk)
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-[#25D366] text-white hover:bg-[#20bd5a]'
                    }`}
                >
                  <Send size={18} className="mr-2" />
                  {registerMode === 'individual' ? 'Enviar Perguntas' : 'Enviar Perguntas em Massa'}
                </button>
                <p className="text-xs text-gray-500 mt-2 text-center">Abre o WhatsApp com as perguntas configuradas.</p>
              </div>
            </div>

            {/* Form Inputs */}
            <div className="lg:col-span-2 bg-dark-900 rounded-xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center">
                <FileEdit className="mr-2 text-primary-500" /> Preencher Respostas
              </h3>

              {questions.length === 0 ? (
                <div className="text-center text-gray-500 py-10">Configure as perguntas na aba "Configuração" primeiro.</div>
              ) : (
                <div className="space-y-6">
                  {questions.map((q, idx) => (
                    <div key={q.id}>
                      <label className="block text-sm font-semibold text-primary-400 mb-2">{idx + 1}. {q.text}</label>
                      <textarea
                        rows={2}
                        placeholder="Digite a resposta do aluno..."
                        value={inputAnswers[q.id] || ''}
                        onChange={(e) => setInputAnswers({ ...inputAnswers, [q.id]: e.target.value })}
                        className="w-full bg-dark-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-1 focus:ring-primary-500 outline-none resize-y"
                      />
                    </div>
                  ))}

                  <div className="pt-4 flex justify-end">
                    <button
                      onClick={handleSaveManualFeedback}
                      disabled={loading}
                      className="bg-primary-600 hover:bg-primary-500 text-white px-8 py-3 rounded-xl font-bold flex items-center shadow-lg shadow-primary-900/20 transition-all"
                    >
                      {loading ? 'Salvando...' : <><Save size={20} className="mr-2" /> Salvar na Pasta</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: CONFIG --- */}
      {activeTab === 'config' && (
        <div className="bg-dark-800 rounded-2xl border border-gray-700 p-8 shadow-xl">
          <div className="max-w-3xl mx-auto">
            <div className="mb-8 text-center">
              <h3 className="text-xl font-bold text-white mb-2">Modelo de Check-in</h3>
              <p className="text-gray-400 text-sm">Defina as perguntas padrão que serão enviadas e respondidas semanalmente.</p>
            </div>

            <div className="space-y-4 mb-8">
              {questions.map((q, index) => (
                <div key={q.id} className="flex items-center bg-dark-900 border border-gray-700 p-4 rounded-xl group hover:border-primary-500/50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center font-bold mr-4 text-sm">
                    {index + 1}
                  </div>
                  <span className="flex-1 text-gray-200">{q.text}</span>
                  <button
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddQuestion()}
                placeholder="Digite uma nova pergunta..."
                className="flex-1 bg-dark-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary-500 outline-none"
              />
              <button
                onClick={handleAddQuestion}
                className="bg-primary-600 hover:bg-primary-500 text-white px-6 rounded-xl font-bold flex items-center transition-colors"
              >
                <Plus size={20} className="mr-2" /> Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: HISTORY --- */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {submissions.map((sub) => (
            <div key={sub.id} className="bg-dark-800 rounded-2xl border border-gray-700 overflow-hidden transition-all duration-300">
              <div
                className="p-6 flex flex-col md:flex-row items-center justify-between cursor-pointer hover:bg-dark-700/50 transition-colors"
                onClick={() => setExpandedSubmission(expandedSubmission === sub.id ? null : sub.id)}
              >
                <div className="flex items-center space-x-4 w-full md:w-auto mb-4 md:mb-0">
                  <img
                    src={sub.clients?.avatar_url || `https://ui-avatars.com/api/?name=${sub.clients?.name || 'User'}`}
                    alt={sub.clients?.name}
                    className="w-12 h-12 rounded-full ring-2 ring-gray-700"
                  />
                  <div>
                    <h4 className="font-bold text-white text-lg flex items-center">
                      {sub.clients?.name || 'Cliente Removido'}
                    </h4>
                    <p className="text-gray-500 text-sm">Registrado em: {new Date(sub.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs bg-green-500/10 text-green-400 px-3 py-1 rounded-full border border-green-500/20">
                    Revisado
                  </span>
                  <div className="text-gray-500">
                    {expandedSubmission === sub.id ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedSubmission === sub.id && (
                <div className="px-6 pb-6 pt-2 bg-dark-900/30 border-t border-gray-700">
                  <div className="space-y-4 mt-4">
                    {sub.answers.map((ans, idx) => (
                      <div key={idx} className="bg-dark-900 p-4 rounded-xl border border-gray-700/50">
                        <p className="text-primary-400 text-xs font-bold mb-1 uppercase tracking-wider">{ans.question}</p>
                        <p className="text-gray-200 mt-1 whitespace-pre-wrap">{ans.answer}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex justify-end border-t border-gray-800 pt-6">
                    <a
                      href={`https://wa.me/${sub.clients?.phone.replace(/\D/g, '')}?text=Fala ${sub.clients?.name.split(' ')[0]}! Analisei seu feedback. Segue o plano...`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center transition-colors"
                    >
                      <MessageSquare size={20} className="mr-2" /> Dar Feedback (Zap)
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))}

          {submissions.length === 0 && (
            <div className="text-center py-20 bg-dark-800 rounded-2xl border border-dashed border-gray-700 text-gray-500">
              Nenhum histórico encontrado.
            </div>
          )}
        </div>
      )}

      {/* --- TAB: AUTOMATION V2 --- */}
      {activeTab === 'automation' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Create New Automation */}
          <div className="lg:col-span-1 bg-dark-800 rounded-2xl border border-gray-700 p-6 shadow-xl h-fit">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <Plus className="mr-2 text-primary-500" size={20} /> Nova Regra
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Nome da Automação</label>
                <input
                  type="text"
                  placeholder="Ex: Check-in Nutricional"
                  value={newSchedule.name}
                  onChange={e => setNewSchedule({ ...newSchedule, name: e.target.value })}
                  className="w-full bg-dark-900 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              {/* Target Type Toggle */}
              <div className="flex bg-dark-900 p-1 rounded-lg">
                <button
                  onClick={() => setTargetType('service')}
                  className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${targetType === 'service' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Por Serviço
                </button>
                <button
                  onClick={() => setTargetType('client')}
                  className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${targetType === 'client' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Por Aluno
                </button>
              </div>

              {targetType === 'service' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Serviço Alvo</label>
                  <CustomSelect
                    value={newSchedule.service_type}
                    onChange={val => setNewSchedule({ ...newSchedule, service_type: val })}
                    options={[
                      { label: 'Selecione um serviço', value: '' },
                      ...serviceTypes.map(t => ({ label: t.name, value: t.name }))
                    ]}
                    placeholder="Selecione..."
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Aluno Alvo</label>
                  <CustomSelect
                    value={newSchedule.client_id || ''}
                    onChange={val => setNewSchedule({ ...newSchedule, client_id: val })}
                    options={[
                      { label: 'Selecione um aluno', value: '' },
                      ...clients.map(t => ({ label: t.name, value: t.id! }))
                    ]}
                    placeholder="Selecione..."
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Frequência</label>
                <CustomSelect
                  value={newSchedule.frequency}
                  onChange={val => setNewSchedule({ ...newSchedule, frequency: val })}
                  options={[
                    { label: 'A cada 7 Dias (Semanal)', value: '7' },
                    { label: 'A cada 15 Dias (Quinzenal)', value: '15' },
                    { label: 'A cada 30 Dias (Mensal)', value: '30' },
                  ]}
                />
              </div>

              <div className="bg-dark-900 p-4 rounded-xl border border-gray-700">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-gray-300 uppercase">Perguntas dessa regra</label>
                  <button onClick={addCustomQuestion} className="text-xs text-primary-400 hover:text-primary-300 flex items-center"><Plus size={12} /> Add</button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">

                  {/* Add Global Dropdown */}
                  <div className="flex gap-2 mb-3">
                    <select
                      value={globalQuestionToAdd}
                      onChange={(e) => addGlobalQuestion(e.target.value)}
                      className="flex-1 bg-dark-800 border border-gray-700 text-xs text-gray-300 rounded p-1.5 outline-none focus:border-primary-500"
                    >
                      <option value="">+ Selecionar existente...</option>
                      {questions.map(q => (
                        <option key={q.id} value={q.text}>{q.text}</option>
                      ))}
                    </select>
                  </div>

                  {customQuestions.map((q, idx) => (
                    <div key={idx} className="flex items-center text-sm bg-dark-800 p-2 rounded border border-gray-700">
                      <span className="w-5 h-5 flex items-center justify-center bg-gray-700 text-white rounded-full text-xs mr-2 shrink-0">{idx + 1}</span>
                      <span className="flex-1 truncate text-gray-300">{q.text}</span>
                      <button onClick={() => removeCustomQuestion(idx)} className="text-gray-500 hover:text-red-400"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleCreateSchedule}
                  disabled={loading}
                  className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex justify-center items-center"
                >
                  {loading ? <Loader2 className="animate-spin" /> : 'Criar Automação'}
                </button>
              </div>
            </div>
          </div>

          {/* List existing */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <Bot className="mr-2 text-primary-500" size={20} /> Regras Ativas
            </h3>

            {schedules.length === 0 ? (
              <div className="text-center py-10 bg-dark-800 rounded-2xl border border-dashed border-gray-700 text-gray-500">
                Nenhuma automação configurada.
              </div>
            ) : (
              schedules.map(schedule => (
                <div key={schedule.id} className="bg-dark-800 rounded-xl border border-gray-700 p-5 flex items-center justify-between group hover:border-gray-500 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${schedule.active ? 'bg-primary-500/20 text-primary-400' : 'bg-gray-700/50 text-gray-500'}`}>
                      <Bot size={20} />
                    </div>
                    <div>
                      <h4 className={`font-bold text-lg ${schedule.active ? 'text-white' : 'text-gray-500'}`}>{schedule.name}</h4>
                      <div className="flex gap-2 text-sm text-gray-400 mt-1">
                        {schedule.service_type && <span className="bg-dark-900 px-2 py-0.5 rounded border border-gray-700 flex items-center gap-1"><Users size={12} /> {schedule.service_type}</span>}
                        {schedule.client_id && <span className="bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded border border-blue-800 flex items-center gap-1"><User size={12} /> Aluno VIP</span>}
                        <span className="bg-dark-900 px-2 py-0.5 rounded border border-gray-700 flex items-center gap-1"><CalendarClock size={12} /> {schedule.frequency_days} dias</span>
                        <span className="bg-dark-900 px-2 py-0.5 rounded border border-gray-700 flex items-center gap-1 text-xs">{schedule.questions?.length || 0} perguntas</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleSchedule(schedule.id, schedule.active)}
                      className={`p-2 rounded-lg transition-colors ${schedule.active ? 'text-green-400 hover:bg-green-500/10' : 'text-gray-500 hover:text-white'}`}
                      title={schedule.active ? "Desativar" : "Ativar"}
                    >
                      <Power size={20} />
                    </button>
                    <button
                      onClick={() => deleteSchedule(schedule.id)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      )}
      {/* --- QUESTION SELECTOR MODAL --- */}
      {showQuestionSelector && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-dark-800 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-xl font-bold text-white mb-1">Selecionar Perguntas</h3>
              <p className="text-gray-400 text-sm">Quais perguntas você deseja enviar?</p>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
              {questions.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Nenhuma pergunta cadastrada.</p>
              ) : (
                questions.map((q, idx) => (
                  <div
                    key={q.id}
                    onClick={() => toggleQuestionSelection(q.text)}
                    className={`flex items-start p-3 rounded-xl border cursor-pointer transition-all ${selectedQuestionsToSend.includes(q.text) ? 'bg-primary-500/10 border-primary-500/50' : 'bg-dark-900 border-gray-700 hover:border-gray-500'}`}
                  >
                    <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border mr-3 ${selectedQuestionsToSend.includes(q.text) ? 'bg-primary-500 border-primary-500' : 'border-gray-600'}`}>
                      {selectedQuestionsToSend.includes(q.text) && <CheckCircle2 size={14} className="text-white" />}
                    </div>
                    <span className={`text-sm ${selectedQuestionsToSend.includes(q.text) ? 'text-white' : 'text-gray-400'}`}>{idx + 1}. {q.text}</span>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 border-t border-gray-700 flex justify-end gap-3 bg-dark-900/50">
              <button
                onClick={() => setShowQuestionSelector(false)}
                className="px-4 py-2 text-gray-400 hover:text-white font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSendSelectedQuestions}
                disabled={selectedQuestionsToSend.length === 0}
                className="bg-[#25D366] hover:bg-[#20bd5a] text-white px-6 py-2 rounded-xl font-bold flex items-center shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={18} className="mr-2" /> Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};