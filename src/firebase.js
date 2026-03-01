
/**
 * ARQUIVO DEPRECADO
 * Utilize apenas as instâncias de src/firebase/index.ts para garantir a estabilidade da sessão.
 */
import { initializeFirebase } from './firebase/index';
const { auth, db } = initializeFirebase();
export { auth, db };
