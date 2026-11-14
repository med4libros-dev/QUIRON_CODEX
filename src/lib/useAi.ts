import { useSettings } from '../store/settings';

/** ¿Está configurado el motor de IA elegido (Claude o Gemini)? Se actualiza solo al cambiarlo. */
export const useAiReady = () => useSettings((s) => !!(s.aiProvider === 'gemini' ? s.geminiKey : s.apiKey).trim());

/** Proveedor elegido, para los textos de la interfaz. */
export const useAiProvider = () => useSettings((s) => s.aiProvider);

/** Guarda la clave en el proveedor activo. */
export function saveAiKey(key: string) {
  const s = useSettings.getState();
  if (s.aiProvider === 'gemini') s.setGeminiKey(key);
  else s.setApiKey(key);
}
