
interface SendMessageParams {
    phone: string;
    message: string;
    attachmentUrl?: string; // Link to PDF if available
}

export const sendMessage = async ({ phone, message, attachmentUrl }: SendMessageParams) => {
    const evolutionApiUrl = import.meta.env.VITE_EVOLUTION_API_URL;
    const evolutionApiKey = import.meta.env.VITE_EVOLUTION_API_KEY;
    const instanceName = import.meta.env.VITE_EVOLUTION_INSTANCE || 'default';

    // Clean phone number (keep only digits)
    const cleanPhone = phone.replace(/\D/g, '');
    // Ensure 55 prefix (Brazil) matches scheduler logic
    const number = cleanPhone.startsWith('55') && cleanPhone.length > 11 ? cleanPhone : `55${cleanPhone}`;

    // 1. Try Evolution API (if configured)
    if (evolutionApiUrl && evolutionApiKey) {
        try {
            let endpoint = `${evolutionApiUrl}/message/sendText/${instanceName}`;
            let body: any = {
                number: number,
                options: {
                    delay: 1200,
                    presence: "composing",
                    linkPreview: true
                },
                text: message
            };

            // If there is an attachment, we can chose to send as Media or just append the link.
            // Sending as Media is more "Pro".
            if (attachmentUrl) {
                endpoint = `${evolutionApiUrl}/message/sendMedia/${instanceName}`;
                body = {
                    number: number,
                    options: {
                        delay: 1200,
                        presence: "composing"
                    },
                    mediatype: "document",
                    mimetype: "application/pdf",
                    caption: message || "",
                    media: attachmentUrl,
                    fileName: "Plano.pdf"
                };
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': evolutionApiKey
                },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                return { success: true, method: 'api' };
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('Evolution API Error:', errorData);
                // Return failure but with method 'api' so UI knows it tried and failed.
                // We'll fallback to link ONLY if the user explicitly wants to, 
                // but the prompt says "Tem que ser enviada usando a evo".
                // So let's alert the error.
                return { success: false, method: 'api', error: errorData };
            }

        } catch (error) {
            console.error('Network Error sending via API:', error);
            return { success: false, method: 'api', error };
        }
    }

    // 2. Fallback: Generate WhatsApp Link (Manual send) - ONLY if API keys are missing
    const encodedMessage = encodeURIComponent(message + (attachmentUrl ? `\n\n📄 Ver anexo: ${attachmentUrl}` : ''));
    const waLink = `https://wa.me/${number}?text=${encodedMessage}`;

    return { success: true, method: 'link', url: waLink };
};
