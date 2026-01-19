
const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY || 'b9461961d9msh688b758d94c5f90p162d7ejsn405c20f723cc';
const RAPIDAPI_HOST = 'whatsapp-profile-data1.p.rapidapi.com';

interface ProfileResponse {
    status: number;
    description: string;
    profile_picture_url?: string;
    is_business?: boolean;
}

// Simple in-memory cache to save requests
const profileCache: Record<string, string | null> = {};

export const fetchProfilePicture = async (phone: string): Promise<string | null> => {
    // 1. Clean phone number
    const cleanPhone = phone.replace(/\D/g, '');

    // Check cache first
    if (profileCache[cleanPhone] !== undefined) {
        console.log(`[ProfileService] Cache hit for ${cleanPhone}`);
        return profileCache[cleanPhone];
    }

    // 2. Ensure basic format (Country Code)
    let formattedPhone = cleanPhone;
    if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
        // Assume BR if not provided
        formattedPhone = `55${cleanPhone}`;
    }

    // Helper to request API
    const tryFetch = async (targetPhone: string, label: string) => {
        try {
            console.log(`[ProfileService] Fetching (${label}): ${targetPhone}`);
            const response = await fetch(`https://${RAPIDAPI_HOST}/WhatsappProfilePhotoWithToken`, {
                method: 'POST',
                headers: {
                    'x-rapidapi-key': RAPIDAPI_KEY,
                    'x-rapidapi-host': RAPIDAPI_HOST,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ phone_number: targetPhone })
            });

            if (!response.ok) {
                console.warn(`[ProfileService] API Error (${response.status}):`, response.statusText);
                return null;
            }

            const data = await response.json();
            console.log(`[ProfileService] Response (${label}):`, data);

            // Check for valid URL in likely fields
            if (data && data.url && typeof data.url === 'string' && data.url.startsWith('http')) return data.url; // Found in logs
            if (data && data.avatar && typeof data.avatar === 'string' && data.avatar.startsWith('http')) return data.avatar;
            if (data && data.profile_pic_url && typeof data.profile_pic_url === 'string' && data.profile_pic_url.startsWith('http')) return data.profile_pic_url;

            // Sometimes it returns the string directly
            if (typeof data === 'string' && data.startsWith('http')) return data;

            return null;
        } catch (e) {
            console.error(`[ProfileService] Network/Parse Error (${label}):`, e);
            return null;
        }
    };

    // 3. Attempt 1: As formatted
    let url = await tryFetch(formattedPhone, 'Attempt 1');

    // 4. Attempt 2: Fallback for Brazil 9-digit issue
    if (!url && formattedPhone.startsWith('55') && formattedPhone.length === 13) {
        const areaCode = formattedPhone.substring(2, 4);
        const ninthDigit = formattedPhone.substring(4, 5);
        if (ninthDigit === '9') {
            const fallbackPhone = `55${areaCode}${formattedPhone.substring(5)}`; // Remove the 9
            url = await tryFetch(fallbackPhone, 'Attempt 2 (No-9)');
        }
    }

    // Update Cache
    profileCache[cleanPhone] = url;
    return url;
};
