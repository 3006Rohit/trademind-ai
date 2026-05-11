export const API_CONFIG = {
    TWELVE_DATA_API_KEY: '199bcc3490cb41b0b3e77effcbad0e8d', // User has provided their key
    // In a real app, use import.meta.env.VITE_TWELVE_DATA_API_KEY
    HUGGING_FACE_API_TOKEN: '',
};

export const getApiKey = () => {
    // Check environment variable first (Vite)
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_TWELVE_DATA_API_KEY) {
        return import.meta.env.VITE_TWELVE_DATA_API_KEY;
    }
    return API_CONFIG.TWELVE_DATA_API_KEY;
};

export const getHuggingFaceApiToken = () => {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_HUGGING_FACE_API_TOKEN) {
        return import.meta.env.VITE_HUGGING_FACE_API_TOKEN;
    }
    return API_CONFIG.HUGGING_FACE_API_TOKEN;
};
