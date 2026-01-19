import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { CheckCircle2, ChevronRight, Loader2, MessageSquare, Send } from 'lucide-react';

interface FeedbackFormPublicProps {
    submissionId?: string; // Optional (if used as component)
}

// Helper to get ID from URL if not provided prop
const getSubmissionIdFromUrl = () => {
    const path = window.location.pathname;
    const parts = path.split('/feedback/');
    return parts.length > 1 ? parts[1] : null;
};

export const FeedbackFormPublic: React.FC<FeedbackFormPublicProps> = () => {
    const [submissionId, setSubmissionId] = useState<string | null>(getSubmissionIdFromUrl());
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [errorHeader, setErrorHeader] = useState<string | null>(null);

    const [clientName, setClientName] = useState('');
    const [questions, setQuestions] = useState<{ text: string; id: string }[]>([]);
    const [answers, setAnswers] = useState<Record<string, string>>({});

    useEffect(() => {
        if (submissionId) {
            loadSubmission(submissionId);
        } else {
            setLoading(false);
            setErrorHeader('Link inválido ou incompleto.');
        }
    }, [submissionId]);

    const loadSubmission = async (id: string) => {
        setLoading(true);
        try {
            // 1. Fetch Submission
            const { data: sub, error } = await supabase
                .from('feedback_submissions')
                .select('*, clients(name)')
                .eq('id', id)
                .single();

            if (error || !sub) {
                throw new Error('Feedback não encontrado.');
            }

            if (sub.status === 'reviewed') {
                setCompleted(true);
                setLoading(false);
                return;
            }

            setClientName(sub.clients?.name || 'Aluno');

            // 2. Determine Questions
            // Priority: Snapshot > Global
            let questionsToAsk: any[] = [];

            if (sub.questions_snapshot && sub.questions_snapshot.length > 0) {
                questionsToAsk = sub.questions_snapshot.map((q: any, i: number) => ({
                    id: q.id || `q-${i}`,
                    text: q.text || q
                }));
            } else {
                // Fallback: Fetch text-only global questions if snapshot missing
                const { data: globalQ } = await supabase
                    .from('feedback_questions')
                    .select('*')
                    .order('order');

                if (globalQ) {
                    questionsToAsk = globalQ;
                }
            }

            setQuestions(questionsToAsk);

            // Track open
            supabase.from('feedback_submissions').update({ link_opened_at: new Date().toISOString() }).eq('id', id).then();

        } catch (err) {
            console.error(err);
            setErrorHeader('Não foi possível carregar o formulário.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        // Validate
        const missing = questions.some(q => !answers[q.id]?.trim());
        if (missing) {
            alert('Por favor, responda todas as perguntas.');
            return;
        }

        setSubmitting(true);

        try {
            // Format answers for DB
            const answersArray = questions.map(q => ({
                question: q.text,
                answer: answers[q.id]
            }));

            const { error } = await supabase
                .from('feedback_submissions')
                .update({
                    answers: answersArray,
                    status: 'reviewed', // Or separate status 'submitted' if desired, but 'reviewed' puts it in history
                    created_at: new Date().toISOString() // Update timestamp to submission time
                })
                .eq('id', submissionId);

            if (error) throw error;

            setCompleted(true);
        } catch (err) {
            alert('Erro ao enviar. Tente novamente.');
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center p-4">
                <Loader2 className="animate-spin text-primary-500 mb-4" size={40} />
                <p className="text-gray-400">Carregando formulário...</p>
            </div>
        );
    }

    if (errorHeader) {
        return (
            <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center p-4 text-center">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4 text-red-500">!</div>
                <h1 className="text-xl font-bold text-white mb-2">{errorHeader}</h1>
                <p className="text-gray-400">Verifique o link ou entre em contato com seu treinador.</p>
            </div>
        );
    }

    if (completed) {
        return (
            <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6 text-green-500 ring-4 ring-green-500/10">
                    <CheckCircle2 size={40} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Feedback Enviado!</h1>
                <p className="text-gray-400 max-w-md">Obrigado, {clientName}. Suas respostas foram salvas e irei analisá-las em breve para ajustar seu plano.</p>
                <div className="mt-8 text-sm text-gray-600">Pode fechar esta página.</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-dark-900 text-gray-100 font-sans selection:bg-primary-500/30">
            <div className="max-w-xl mx-auto min-h-screen flex flex-col bg-dark-800 shadow-2xl">

                {/* Header */}
                <div className="p-6 border-b border-gray-700 bg-dark-900/50 backdrop-blur sticky top-0 z-10">
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <MessageSquare className="text-primary-500" /> Check-in Semanal
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">Olá, {clientName}! Conta como foi sua semana.</p>
                </div>

                {/* Form */}
                <div className="flex-1 p-6 space-y-8 pb-32">
                    {questions.map((q, idx) => (
                        <div key={q.id} className="animate-fade-in" style={{ animationDelay: `${idx * 100}ms` }}>
                            <label className="block text-sm font-bold text-primary-400 mb-3 uppercase tracking-wider">
                                {idx + 1}. {q.text}
                            </label>
                            <textarea
                                rows={3}
                                className="w-full bg-dark-900 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-600 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-none shadow-inner text-base"
                                placeholder="Escreva sua resposta aqui..."
                                value={answers[q.id] || ''}
                                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                            />
                        </div>
                    ))}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-gray-700 bg-dark-900 sticky bottom-0 z-10">
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary-900/20 transition-all flex items-center justify-center text-lg disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-[0.98]"
                    >
                        {submitting ? (
                            <><Loader2 className="animate-spin mr-2" /> Enviando...</>
                        ) : (
                            <>Enviar Feedback <Send className="ml-2" size={20} /></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
