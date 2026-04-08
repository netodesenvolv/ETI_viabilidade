/**
 * Configuração do Firebase otimizada para App Hosting e Studio.
 * Prioriza a configuração injetada automaticamente pelo Firebase App Hosting.
 */
const getFirebaseConfig = () => {
  // Prioridade 1: Configuração completa injetada pelo Hosting/Studio
  if (process.env.FIREBASE_WEBAPP_CONFIG) {
    try {
      return JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG);
    } catch (e) {
      console.error("Erro ao processar FIREBASE_WEBAPP_CONFIG:", e);
    }
  }

  // Prioridade 2: Variáveis de ambiente individuais (Desenvolvedor)
  const envConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  // Se o Project ID estiver definido no env, usa as variáveis do env
  if (envConfig.projectId && envConfig.projectId !== 'seu_projeto_id') {
    return envConfig;
  }

  // Fallback: Configuração padrão do Studio ou Build Local
  return {
    apiKey: "AIzaSyCQz4RgLEsHXhPUCep9_dDK3fL5Jt3-ZTM",
    authDomain: "studio-6010766644-addb1.firebaseapp.com",
    projectId: "studio-6010766644-addb1",
    storageBucket: "studio-6010766644-addb1.firebasestorage.app",
    messagingSenderId: "49738637143",
    appId: "1:49738637143:web:0fd48826178e1c6a402812"
  };
};

export const firebaseConfig = getFirebaseConfig();
