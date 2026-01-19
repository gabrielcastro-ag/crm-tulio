import React, { useState, useEffect } from 'react';
import { Client, FeedbackQuestion, FeedbackSubmission, ServiceType } from '../types';
import { supabase } from '../services/supabase';
import { sendMessage } from '../services/whatsapp';
import { Plus, Trash2, Save, MessageSquare, CheckCircle2, ChevronDown, ChevronUp, ChevronRight, Send, FileEdit, History, Settings, Loader2, Bot, CalendarClock, Power, User, Users, X, ArrowLeft } from 'lucide-react';
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
  clients: { name: string; service_type: string | null } | null;
}

// Helper Component for Folders
const QuestionFolder = ({ title, questions, onDelete, onAdd }: { title: string, questions: FeedbackQuestion[], onDelete: (id: string) => void, onAdd: (text: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newText, setNewText] = useState('');

  const handleAdd = () => {
    if (newText.trim()) {
      onAdd(newText);
      setNewText('');
    }
  };

  return (
    <div className="bg-dark-900 border border-gray-700 rounded-xl overflow-hidden mb-4">
      <div
        className="p-4 bg-dark-800 flex items-center justify-between cursor-pointer hover:bg-dark-700/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h4 className="font-bold text-white flex items-center gap-2">
          {title === 'Geral' ? <Settings size={18} className="text-primary-500" /> : <Bot size={18} className="text-secondary-500" />}
          {title}
          <span className="bg-dark-900 border border-gray-700 text-xs px-2 py-0.5 rounded-full text-gray-400 font-normal">{questions.length}</span>
        </h4>
        {isOpen ? <ChevronUp size={20} className="text-gray-500" /> : <ChevronDown size={20} className="text-gray-500" />}
      </div>

      {isOpen && (
        <div className="p-4 border-t border-gray-700 animate-fade-in">
          <div className="space-y-3 mb-4">
            {questions.length === 0 && <p className="text-gray-500 text-sm italic py-2">Nenhuma pergunta nesta categoria.</p>}
            {questions.map((q, idx) => (
              <div key={q.id} className="flex items-center justify-between bg-dark-800 p-3 rounded-lg border border-gray-700/50">
                <span className="text-gray-300 text-sm flex-1">{idx + 1}. {q.text}</span>
                <button onClick={() => onDelete(q.id)} className="text-gray-500 hover:text-red-400 p-1"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder={`Nova pergunta para ${title}...`}
              className="flex-1 bg-dark-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-primary-500 outline-none"
            />
            <button onClick={handleAdd} className="bg-primary-600 hover:bg-primary-500 text-white px-4 rounded-lg text-sm font-bold transition-colors">Add</button>
          </div>
        </div>
      )}
    </div>
  );
};

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


  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);

  // Question Selector Modal State
  const [showQuestionSelector, setShowQuestionSelector] = useState(false);
  const [selectedQuestionsToSend, setSelectedQuestionsToSend] = useState<string[]>([]);

  // Automation: Global Question Selector
  const [globalQuestionToAdd, setGlobalQuestionToAdd] = useState('');

  // History Folder State
  const [selectedHistoryClient, setSelectedHistoryClient] = useState<string | null>(null);

  // Grouped Submissions for History Folder View
  const groupedSubmissions = React.useMemo(() => {
    const groups: Record<string, FeedbackSubmission[]> = {};
    submissions.forEach(sub => {
      if (!sub.client_id) return;
      if (!groups[sub.client_id]) groups[sub.client_id] = [];
      groups[sub.client_id].push(sub);
    });
    return groups;
  }, [submissions]);

  // View Questions Modal
  const [viewQuestionsModal, setViewQuestionsModal] = useState(false);
  const [questionsToView, setQuestionsToView] = useState<{ title: string; list: FeedbackQuestion[] } | null>(null);

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
    const { data } = await supabase
      .from('feedback_schedules')
      .select('*, clients(name, service_type)')
      .order('created_at', { ascending: false });
    if (data) setSchedules(data as any);
  };

  // ... (rest of the file) ...

  // UI Rendering part (Scanning for the list rendering to replace)


  const fetchServiceTypes = async () => {
    const { data } = await supabase.from('service_types').select('*').order('name');
    if (data) setServiceTypes(data);
  };

  // --- Handlers ---

  const handleAddQuestion = async (text: string, category: string = 'Geral') => {
    if (!text.trim()) return;
    const newOrder = questions.length;
    const { data, error } = await supabase
      .from('feedback_questions')
      .insert([{ text, order: newOrder, category }])
      .select();

    if (data) {
      setQuestions([...questions, data[0] as FeedbackQuestion]);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    await supabase.from('feedback_questions').delete().eq('id', id);
    setQuestions(questions.filter(q => q.id !== id));
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

    // Prepare Questions Snapshot
    // We filter the full 'questions' object based on selected text to get IDs and Order correct if needed
    // Or just save the text as the snapshot since that's what matters for the form
    const questionsSnapshot = questions.filter(q => selectedQuestionsToSend.includes(q.text));

    setLoading(true);

    try {
      // Helper to process one client
      const processClient = async (client: Client) => {
        // 1. Create Submission Record (Pending)
        const { data: sub, error } = await supabase.from('feedback_submissions').insert([{
          client_id: client.id,
          created_at: new Date().toISOString(),
          status: 'pending',
          answers: null, // Explicitly null as they haven't answered
          questions_snapshot: questionsSnapshot
        }]).select().single();

        if (error || !sub) throw new Error('Failed to create submission');

        // 2. Generate Link
        const link = `${window.location.origin}/feedback/${sub.id}`;
        const message = `Olá ${client.name.split(' ')[0]}! 👋\n\nChegou a hora do seu check-in de acompanhamento.\nPor favor, responda as perguntas no link abaixo:\n\n🔗 ${link}\n\nAguardo seu retorno! 🚀`;

        // 3. Send WhatsApp
        return await sendMessage({
          phone: client.phone,
          message: message
        });
      };

      // MODE: INDIVIDUAL
      if (registerMode === 'individual') {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client) return;

        const response = await processClient(client);

        if (response.success) {
          alert("Link de feedback enviado com sucesso!");
          setShowQuestionSelector(false);
        } else {
          console.error(response.error);
          alert("Erro ao enviar mensagem.");
        }

      }
      // MODE: BULK
      else {
        if (!window.confirm(`Tem certeza que deseja enviar o LINK para TODOS os alunos de "${selectedServiceTypeForBulk}"?`)) {
          setLoading(false);
          return;
        }

        const { data: targetClients } = await supabase
          .from('clients')
          .select('*')
          .eq('service_type', selectedServiceTypeForBulk)
          .in('status', ['active', 'expiring']);

        if (!targetClients || targetClients.length === 0) {
          alert("Nenhum aluno ativo encontrado.");
          setLoading(false);
          return;
        }

        let successCount = 0;
        let failCount = 0;

        for (const client of targetClients) {
          if (!client.phone) continue;
          try {
            const res = await processClient(client);
            if (res.success) successCount++;
            else failCount++;
            // Rate limit
            await new Promise(r => setTimeout(r, 1000));
          } catch (e) {
            console.error(e);
            failCount++;
          }
        }

        alert(`Finalizado!\nEnviados: ${successCount}\nFalhas: ${failCount}`);
        setShowQuestionSelector(false);
      }

    } catch (err) {
      console.error(err);
      alert("Erro no processo de envio.");
    } finally {
      setLoading(false);
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

    const frequencyDays = parseInt(newSchedule.frequency);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + frequencyDays);

    const { data, error } = await supabase.from('feedback_schedules').insert([{
      name: newSchedule.name,
      service_type: targetType === 'service' ? newSchedule.service_type : null,
      client_id: targetType === 'client' ? newSchedule.client_id : null,
      frequency_days: frequencyDays,
      active: true,
      questions: customQuestions, // Save the custom list
      next_run_at: startDate.toISOString() // Start in future
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

  // Delete Submission
  const handleDeleteSubmission = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent toggling the card
    if (!window.confirm("Tem certeza que deseja excluir este feedback permanentemente?")) return;

    setLoading(true);
    const { error } = await supabase.from('feedback_submissions').delete().eq('id', id);
    setLoading(false);

    if (error) {
      alert("Erro ao excluir.");
      console.error(error);
    } else {
      setSubmissions(submissions.filter(s => s.id !== id));
      // If closing the last submission of a client, go back to list?
      // Not strictly necessary as the filter will just show empty list which is fine
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
            <Send size={18} className="mr-2" /> Solicitar
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

      {/* --- TAB: MANUAL REGISTER (NOW SEND REQUEST) --- */}
      {activeTab === 'register' && (
        <div className="bg-dark-800 rounded-2xl border border-gray-700 p-8 shadow-xl max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h3 className="text-xl font-bold text-white mb-2">Solicitar Feedback</h3>
            <p className="text-gray-400 text-sm">Envie o link de check-in para seus alunos via WhatsApp.</p>
          </div>

          <div className="space-y-6">
            {/* Toggle Mode */}
            <div className="flex bg-dark-900 p-1 rounded-lg">
              <button
                onClick={() => setRegisterMode('individual')}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${registerMode === 'individual' ? 'bg-primary-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Individual
              </button>
              <button
                onClick={() => setRegisterMode('bulk')}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${registerMode === 'bulk' ? 'bg-primary-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Em Massa
              </button>
            </div>

            {/* Selectors */}
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

            {/* Send Button */}
            <div className="pt-4 border-t border-gray-700">
              <button
                onClick={handleOpenWhatsAppModal}
                disabled={loading ? true : (registerMode === 'individual' ? !selectedClientId : !selectedServiceTypeForBulk)}
                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center transition-all shadow-lg ${(registerMode === 'individual' ? !selectedClientId : !selectedServiceTypeForBulk)
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-[#25D366] text-white hover:bg-[#20bd5a] hover:scale-[1.02]'
                  }`}
              >
                <Send size={24} className="mr-3" />
                {registerMode === 'individual' ? 'Enviar Perguntas' : 'Enviar em Massa'}
              </button>
              <p className="text-xs text-gray-500 mt-3 text-center">
                Você poderá selecionar as perguntas no próximo passo.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: CONFIG --- */}
      {activeTab === 'config' && (
        <div className="bg-dark-800 rounded-2xl border border-gray-700 p-8 shadow-xl">
          <div className="max-w-3xl mx-auto">
            <div className="mb-8 text-center">
              <h3 className="text-xl font-bold text-white mb-2">Perguntas de Check-in</h3>
              <p className="text-gray-400 text-sm">Organize as perguntas por categoria (ex: Serviços ou Geral).</p>
            </div>

            {/* Folders List */}
            <div className="space-y-6">
              {/* 1. GERAL (Default) */}
              <QuestionFolder
                title="Geral"
                questions={questions.filter(q => !q.category || q.category === 'Geral')}
                onDelete={handleDeleteQuestion}
                onAdd={(text) => handleAddQuestion(text, 'Geral')}
              />

              {/* 2. Service Types */}
              {serviceTypes.map(st => (
                <QuestionFolder
                  key={st.id}
                  title={st.name}
                  questions={questions.filter(q => q.category === st.name)}
                  onDelete={handleDeleteQuestion}
                  onAdd={(text) => handleAddQuestion(text, st.name)}
                />
              ))}
            </div>

          </div>
        </div>
      )}

      {/* --- TAB: HISTORY --- */}
      {activeTab === 'history' && (
        <div className="space-y-4">

          {/* FOLDER VIEW: List Clients */}
          {!selectedHistoryClient && (
            <div className="space-y-4">
              {Object.values(groupedSubmissions).length === 0 && (
                <div className="text-center py-20 bg-dark-800 rounded-2xl border border-dashed border-gray-700 text-gray-500">
                  Nenhum histórico encontrado.
                </div>
              )}

              {Object.values(groupedSubmissions)
                .sort((a, b) => new Date(b[0].created_at).getTime() - new Date(a[0].created_at).getTime()) // Sort by most recent submission
                .map((group: FeedbackSubmission[]) => {
                  const latestSub = group[0];
                  const client = latestSub.clients;
                  return (
                    <div
                      key={latestSub.client_id}
                      onClick={() => setSelectedHistoryClient(latestSub.client_id!)}
                      className="bg-dark-800 rounded-2xl border border-gray-700 p-6 flex items-center justify-between cursor-pointer hover:border-primary-500/50 hover:bg-dark-700/50 transition-all group"
                    >
                      <div className="flex items-center space-x-4">
                        <img
                          src={client?.avatar_url || `https://ui-avatars.com/api/?name=${client?.name || 'User'}`}
                          alt={client?.name}
                          className="w-14 h-14 rounded-full ring-2 ring-gray-700 group-hover:ring-primary-500/50 transition-all"
                        />
                        <div>
                          <h4 className="font-bold text-white text-lg flex items-center gap-2">
                            {client?.name || 'Cliente Removido'}
                            <span className="bg-dark-900 text-xs px-2 py-0.5 rounded text-gray-400 border border-gray-700">{group.length} feedbacks</span>
                          </h4>
                          <p className="text-primary-400 text-sm flex items-center mt-1">
                            Último registro em: {new Date(latestSub.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="text-gray-600 group-hover:text-primary-500 transition-colors" />
                    </div>
                  );
                })}
            </div>
          )}

          {/* DETAIL VIEW: Specific Client Feedbacks */}
          {selectedHistoryClient && (
            <div className="animate-fade-in">
              <button
                onClick={() => setSelectedHistoryClient(null)}
                className="mb-4 flex items-center text-gray-400 hover:text-white transition-colors text-sm font-bold"
              >
                <ArrowLeft size={16} className="mr-1" /> Voltar para Pastas
              </button>

              <div className="space-y-4">
                {submissions.filter(s => s.client_id === selectedHistoryClient).map((sub) => (
                  <div key={sub.id} className="bg-dark-800 rounded-2xl border border-gray-700 overflow-hidden transition-all duration-300">
                    <div
                      className="p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between cursor-pointer hover:bg-dark-700/50 transition-colors gap-4"
                      onClick={() => setExpandedSubmission(expandedSubmission === sub.id ? null : sub.id)}
                    >
                      <div className="w-full md:w-auto">
                        <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Data do Registro</p>
                        <h4 className="font-bold text-white text-lg flex items-center">
                          {new Date(sub.created_at).toLocaleDateString()}
                          <span className="text-gray-500 text-sm font-normal ml-2">
                            às {new Date(sub.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </h4>
                      </div>

                      <div className="flex items-center justify-between w-full md:w-auto gap-4 border-t border-gray-700/50 pt-3 md:border-t-0 md:pt-0">
                        {/* Badge */}
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${sub.status === 'reviewed' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                          {sub.status === 'reviewed' ? 'Revisado' : 'Pendente'}
                        </span>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => handleDeleteSubmission(sub.id, e)}
                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors z-10"
                            title="Excluir Feedback"
                          >
                            <Trash2 size={18} />
                          </button>
                          <div className="text-gray-500 p-1">
                            {expandedSubmission === sub.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {expandedSubmission === sub.id && (
                      <div className="px-6 pb-6 pt-2 bg-dark-900/30 border-t border-gray-700">
                        <div className="space-y-4 mt-4">
                          {!sub.answers && <p className="text-gray-500 italic">Cliente ainda não respondeu.</p>}

                          {sub.answers?.map((ans, idx) => (
                            <div key={idx} className="bg-dark-900 p-4 rounded-xl border border-gray-700/50">
                              <p className="text-primary-400 text-xs font-bold mb-1 uppercase tracking-wider">{ans.question}</p>
                              <p className="text-gray-200 mt-1 whitespace-pre-wrap">{ans.answer}</p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-6 flex justify-end border-t border-gray-800 pt-6">
                          <a
                            href={`https://wa.me/${sub.clients?.phone.replace(/\D/g, '')}?text=Fala ${sub.clients?.name.split(' ')[0]}! Analisei seu feedback de ${new Date(sub.created_at).toLocaleDateString()}. Segue o plano...`}
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
              </div>
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
                <div key={schedule.id} className="bg-dark-800 rounded-xl border border-gray-700 p-5 group hover:border-gray-500 transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${schedule.active ? 'bg-primary-500/20 text-primary-400' : 'bg-gray-700/50 text-gray-500'}`}>
                        <Bot size={20} />
                      </div>
                      <div>
                        {/* Title Row */}
                        <h4 className={`font-bold text-lg ${schedule.active ? 'text-white' : 'text-gray-500'}`}>{schedule.name}</h4>

                        {/* Details Row */}
                        <div className="flex flex-wrap gap-2 text-sm text-gray-400 mt-2">
                          {/* Target Badge */}
                          {schedule.service_type && (
                            <span className="bg-dark-900 px-2 py-0.5 rounded border border-gray-700 flex items-center gap-1">
                              <Users size={12} className="text-primary-500" />
                              {schedule.service_type}
                            </span>
                          )}
                          {schedule.client_id && (
                            <span className="bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded border border-blue-800 flex items-center gap-1">
                              <User size={12} />
                              {schedule.clients?.name}
                              {schedule.clients?.service_type && <span className="text-blue-200/50 text-[10px] ml-1">({schedule.clients.service_type})</span>}
                            </span>
                          )}

                          {/* Frequency */}
                          <span className="bg-dark-900 px-2 py-0.5 rounded border border-gray-700 flex items-center gap-1">
                            <CalendarClock size={12} /> {schedule.frequency_days} dias
                          </span>

                          {/* Questions Count (Clickable) */}
                          <button
                            onClick={() => {
                              setQuestionsToView({ title: schedule.name, list: schedule.questions });
                              setViewQuestionsModal(true);
                            }}
                            className="bg-dark-900 hover:bg-dark-700 px-2 py-0.5 rounded border border-gray-700 flex items-center gap-1 text-xs cursor-pointer transition-colors"
                          >
                            <FileEdit size={12} /> {schedule.questions?.length || 0} perguntas
                          </button>

                          {/* Next Run */}
                          <span className="bg-dark-900 px-2 py-0.5 rounded border border-gray-700 flex items-center gap-1 text-green-400/80">
                            Próximo: {new Date(schedule.next_run_at).toLocaleDateString('pt-BR')}
                          </span>
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
                </div>
              ))
            )}
          </div>

        </div>
      )}

      {/* --- VIEW QUESTIONS MODAL --- */}
      {viewQuestionsModal && questionsToView && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewQuestionsModal(false)}>
          <div className="bg-dark-800 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Perguntas da Regra</h3>
                <p className="text-gray-400 text-sm">{questionsToView.title}</p>
              </div>
              <button onClick={() => setViewQuestionsModal(false)} className="text-gray-500 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
              {questionsToView.list && questionsToView.list.length > 0 ? (
                questionsToView.list.map((q, idx) => (
                  <div key={idx} className="flex gap-3 bg-dark-900 p-3 rounded-xl border border-gray-700/50">
                    <span className="w-6 h-6 rounded-full bg-primary-500/10 text-primary-400 flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-gray-200 text-sm">{q.text}</p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center italic">Nenhuma pergunta configurada.</p>
              )}
            </div>
            <div className="p-4 bg-dark-900/50 border-t border-gray-700 flex justify-end">
              <button
                onClick={() => setViewQuestionsModal(false)}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
              >
                Fechar
              </button>
            </div>
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

            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-6">
              {questions.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Nenhuma pergunta cadastrada.</p>
              ) : (
                ['Geral', ...serviceTypes.map(s => s.name)].map(category => {
                  const categoryQuestions = questions.filter(q =>
                    category === 'Geral'
                      ? (!q.category || q.category === 'Geral')
                      : q.category === category
                  );

                  if (categoryQuestions.length === 0) return null;

                  return (
                    <div key={category}>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-700/50 pb-1 ml-1">{category}</h4>
                      <div className="space-y-2">
                        {categoryQuestions.map((q) => (
                          <div
                            key={q.id}
                            onClick={() => toggleQuestionSelection(q.text)}
                            className={`flex items-start p-3 rounded-xl border cursor-pointer transition-all ${selectedQuestionsToSend.includes(q.text) ? 'bg-primary-500/10 border-primary-500/50' : 'bg-dark-900 border-gray-700 hover:border-gray-500'}`}
                          >
                            <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border mr-3 ${selectedQuestionsToSend.includes(q.text) ? 'bg-primary-500 border-primary-500' : 'border-gray-600'}`}>
                              {selectedQuestionsToSend.includes(q.text) && <CheckCircle2 size={14} className="text-white" />}
                            </div>
                            <span className={`text-sm ${selectedQuestionsToSend.includes(q.text) ? 'text-white' : 'text-gray-400'}`}>{q.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
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