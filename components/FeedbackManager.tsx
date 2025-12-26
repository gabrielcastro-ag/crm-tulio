
import React, { useState, useEffect } from 'react';
import { Client, FeedbackQuestion, FeedbackSubmission } from '../types';
import { supabase } from '../services/supabase';
import { Plus, Trash2, Save, MessageSquare, CheckCircle2, ChevronDown, ChevronUp, Send, FileEdit, History, Settings, Loader2 } from 'lucide-react';

interface FeedbackManagerProps {
  clients: Client[];
}

export const FeedbackManager: React.FC<FeedbackManagerProps> = ({ clients }) => {
  const [activeTab, setActiveTab] = useState<'register' | 'history' | 'config'>('register');
  const [loading, setLoading] = useState(false);

  // Custom State
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [submissions, setSubmissions] = useState<FeedbackSubmission[]>([]);

  // Inputs
  const [newQuestionText, setNewQuestionText] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [feedbackDate, setFeedbackDate] = useState(new Date().toISOString().split('T')[0]);
  const [inputAnswers, setInputAnswers] = useState<Record<string, string>>({});
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);

  // --- Initial Data Fetch ---
  useEffect(() => {
    fetchQuestions();
    fetchSubmissions();
  }, []);

  const fetchQuestions = async () => {
    const { data } = await supabase.from('feedback_questions').select('*').order('order', { ascending: true });
    if (data) setQuestions(data as FeedbackQuestion[]);
  };

  const fetchSubmissions = async () => {
    // Note: We need to join with clients to get names/avatars if not stored.
    // Ideally we store minimal client info or join.
    // For simplicity, I'll fetch submissions and map client details from the prop `clients` or do a join in Supabase.
    // Supabase JS join syntax:
    const { data, error } = await supabase
      .from('feedback_submissions')
      .select('*, clients(name, avatar_url, phone)')
      .order('created_at', { ascending: false });

    if (data) {
      // Transform to match our interface (if needed) or cast
      setSubmissions(data as any);
    }
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

  // Manual Registration (Admin fills it out for the client, OR this simulates the client filling it)
  // The user asked "eu possa ver as repostas resumidas em uma pasta", implying he receives them.
  // This manual registration is good for when he interviews them.
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

  const handleSendQuestionsToWhatsApp = () => {
    if (!selectedClientId) {
      alert("Selecione um aluno primeiro.");
      return;
    }
    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;

    let message = `Fala ${client.name.split(' ')[0]}! Tudo certo? \n\nChegou a hora do nosso check-in semanal. Por favor, responda as perguntas abaixo:\n\n`;
    questions.forEach((q, idx) => {
      message += `${idx + 1}. ${q.text}\n`;
    });
    message += `\nAguardo seu retorno! 💪`;

    window.open(`https://wa.me/${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="animate-fade-in max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Gerenciador de Feedbacks</h2>
          <p className="text-gray-400">Envie perguntas, registre respostas e acompanhe a evolução.</p>
        </div>

        {/* Tabs */}
        <div className="bg-dark-800 p-1 rounded-xl flex">
          <button
            onClick={() => setActiveTab('register')}
            className={`px-4 lg:px-6 py-2 rounded-lg font-medium transition-all flex items-center ${activeTab === 'register' ? 'bg-primary-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            <FileEdit size={18} className="mr-2" /> Registrar
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 lg:px-6 py-2 rounded-lg font-medium transition-all flex items-center ${activeTab === 'history' ? 'bg-primary-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            <History size={18} className="mr-2" /> Histórico
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 lg:px-6 py-2 rounded-lg font-medium transition-all flex items-center ${activeTab === 'config' ? 'bg-primary-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            <Settings size={18} className="mr-2" /> Perguntas
          </button>
        </div>
      </div>

      {/* --- TAB: MANUAL REGISTER --- */}
      {activeTab === 'register' && (
        <div className="bg-dark-800 rounded-2xl border border-gray-700 p-6 lg:p-8 shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sidebar controls */}
            <div className="lg:col-span-1 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Selecione o Aluno</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full bg-dark-900 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="">-- Selecione --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
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
                  onClick={handleSendQuestionsToWhatsApp}
                  disabled={!selectedClientId}
                  className={`w-full py-3 rounded-xl font-bold flex items-center justify-center transition-all ${!selectedClientId ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-[#25D366] text-white hover:bg-[#20bd5a]'}`}
                >
                  <Send size={18} className="mr-2" /> Enviar Perguntas (Zap)
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
    </div>
  );
};