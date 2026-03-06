/**
 * Configuração do Firebase otimizada para App Hosting e Studio.
 * Prioriza a configuração injetada automaticamente pelo Firebase App Hosting.
 */
const getFirebaseConfig = () => {
  if (process.env.FIREBASE_WEBAPP_CONFIG) {
    try {
      return JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG);
    } catch (e) {
      console.error("Erro ao processar FIREBASE_WEBAPP_CONFIG:", e);
    }
  }

  // Fallback para desenvolvimento no Studio e build local
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
