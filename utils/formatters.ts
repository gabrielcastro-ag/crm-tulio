
export const translatePlanType = (plan: string) => {
    const mapping: Record<string, string> = {
        'Monthly': 'Mensal',
        'Quarterly': 'Trimestral',
        'Semi-Annual': 'Semestral',
        'Annual': 'Anual',
        'Custom': 'Personalizado'
    };
    return mapping[plan] || plan;
};

export const translateStatus = (status: string) => {
    const mapping: Record<string, string> = {
        'active': 'Ativo',
        'expiring': 'Renovação',
        'expired': 'Vencido',
        'pending': 'Pendente',
        'sent': 'Enviado'
    };
    return mapping[status] || status;
};

export const translateScheduleType = (type: string) => {
    const mapping: Record<string, string> = {
        'workout': 'Treino',
        'diet': 'Dieta',
        'checkin': 'Check-in',
        'general': 'Geral'
    };
    return mapping[type] || type;
};
