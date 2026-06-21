import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import * as dotenv from "dotenv";

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkDb() {
  try {
    console.log("Checking municipios...");
    const muns = await getDocs(collection(db, "municipios"));
    muns.forEach(doc => {
      console.log(`Municipio: ${doc.id}`);
    });

    console.log("Checking users...");
    const users = await getDocs(collection(db, "users"));
    users.forEach(doc => {
      console.log(`User: ${doc.id} - ${JSON.stringify(doc.data())}`);
    });
    
    console.log("Checking root schools...");
    const schools = await getDocs(collection(db, "schools"));
    console.log(`Root schools count: ${schools.size}`);
    
    console.log("Done");
  } catch (e) {
    console.error("Error:", e);
  }
}

checkDb();
