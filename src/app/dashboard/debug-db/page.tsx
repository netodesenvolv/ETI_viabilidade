"use client";
import { useEffect, useState } from "react";
import { useFirestore } from "@/firebase";
import { collection, getDocs } from "firebase/firestore";

export default function DebugDB() {
  const db = useFirestore();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      if (!db) return;
      try {
        const querySnapshot = await getDocs(collection(db, "municipios"));
        const results = [];
        for (const doc of querySnapshot.docs) {
          // get a count of schools
          const schoolsSnap = await getDocs(collection(db, `municipios/${doc.id}/schools`));
          const expensesSnap = await getDocs(collection(db, `municipios/${doc.id}/expenses`));
          results.push({
            id: doc.id,
            data: doc.data(),
            schoolsCount: schoolsSnap.size,
            expensesCount: expensesSnap.size,
          });
        }
        setData(results);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [db]);

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error}</div>;

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-4">Debug DB: Coleção "municipios"</h1>
      <pre className="bg-gray-100 p-4 rounded">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
