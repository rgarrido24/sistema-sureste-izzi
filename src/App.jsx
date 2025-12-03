import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, writeBatch, doc, getDocs, limit, addDoc, serverTimestamp, orderBy, deleteDoc } from 'firebase/firestore';
import { Shield, Users, Cloud, LogOut, MessageSquare, Search, RefreshCw, Database, Settings, Link as LinkIcon, Check, AlertTriangle, PlayCircle, List, FileSpreadsheet, UploadCloud, Sparkles, PlusCircle, Download, MapPin, Wifi, FileText, Trash2, DollarSign, Wrench, Phone, MessageCircleQuestion, Send, X } from 'lucide-react';

// --- PANTALLA DE ERROR (DIAGNÓSTICO) ---
function ErrorDisplay({ message, details, currentKey }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-6 text-center font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-100 max-w-lg w-full">
        <AlertTriangle size={64} className="text-red-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-red-800 mb-2">Error de Conexión</h1>
        
        <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-left mb-4 text-xs text-red-800 font-mono break-all">
          {message}
        </div>

        <div className="text-left bg-slate-100 p-3 rounded mb-4">
            <p className="text-xs font-bold text-slate-500 uppercase">Tu Clave en Vercel:</p>
            <code className="text-xs text-slate-700 break-all block mt-1 p-1 bg-white border rounded">
              {currentKey ? currentKey.substring(0, 10) + "..." : "No detectada / Vacía"}
            </code>
        </div>

        <p className="text-sm text-slate-600 mb-6">
            {details}
        </p>

        <button onClick={() => window.location.reload()} className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors">
          Reintentar
        </button>
      </div>
    </div>
  );
}

// --- CONFIGURACIÓN SEGURA ---
const getEnv = () => {
  try { return import.meta.env || {}; } catch (e) { return {}; }
};

const env = getEnv();

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

const geminiApiKey = env.VITE_GEMINI_API_KEY;

// --- INICIALIZACIÓN ---
let app, auth, db;
let initError = null;

try {
  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (e) {
  initError = e;
}

// --- FUNCIONES AUXILIARES ---
async function callGemini(prompt) {
  if (!geminiApiKey) return "Falta API Key de IA";
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
    );
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Error IA";
  } catch (error) { return "Error conexión IA"; }
}

function parseCSV(text) {
  const arr = []; let quote = false; let col = 0, c = 0; let row = [''];
  for (c = 0; c < text.length; c++) {
    let cc = text[c], nc = text[c+1];
    arr[col] = arr[col] || [];
    if (cc === '"') { if (quote && nc === '"') { row[col] += '"'; ++c; } else { quote = !quote; } } 
    else if (cc === ',' && !quote) { col++; row[col] = ''; } 
    else if ((cc === '\r' || cc === '\n') && !quote) { if (cc === '\r' && nc === '\n') ++c; if (row.length > 1 || row[0].length > 0) arr.push(row); row = ['']; col = 0; } 
    else { row[col] += cc; }
  }
  if (row.length > 1 || row[0].length > 0) arr.push(row);
  return arr;
}

const downloadCSV = (data, filename) => {
  if (!data || !data.length) return alert("No hay datos para exportar");
  const flatData = data.map(row => {
      const { id, createdAt, ...rest } = row; 
      let dateStr = '';
      if (createdAt && createdAt.seconds) {
          dateStr = new Date(createdAt.seconds * 1000).toLocaleDateString();
      } else if (typeof createdAt === 'string') {
          dateStr = createdAt;
      }
      return { Fecha: dateStr, ...rest };
  });

  const headers = Object.keys(flatData[0]).join(",");
  const rows = flatData.map(row => {
      return Object.values(row).map(v => `"${v}"`).join(",");
  }).join("\n");

  const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --- APP PRINCIPAL ---
export default function SalesMasterCloud() {
  // 1. Validación de Claves
  if (!firebaseConfig.apiKey) {
    return <ErrorDisplay 
      message="Faltan las Variables de Entorno" 
      details="Ve a Vercel -> Settings -> Environment Variables y asegúrate de haber agregado las 7 claves." 
    />;
  }

  if (initError) return <ErrorDisplay message={initError.message} details="Error interno de Firebase." />;

  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [vendorName, setVendorName] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [currentModule, setCurrentModule] = useState('sales'); 
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      if (!auth) return;
      try { await signInAnonymously(auth); } 
      catch (error) { 
        console.error("Error Auth:", error);
        setAuthError(error);
      } 
      finally { setIsAuthenticating(false); }
    };
    initAuth();
    if (auth) return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  if (authError) {
    return <ErrorDisplay 
      message={authError.message} 
      currentKey={firebaseConfig.apiKey}
      details="Error de autenticación. Revisa que tu API Key en Vercel sea EXACTA a la de Firebase (sin comillas extra, sin espacios)." 
    />;
  }

  if (isAuthenticating) return <div className="h-screen flex items-center justify-center bg-slate-50 text-blue-600 gap-3"><RefreshCw className="animate-spin"/> Iniciando SalesMaster...</div>;
  if (!role) return <LoginScreen onLogin={(r, name) => { setRole(r); setVendorName(name); }} />;

  return role === 'admin' 
    ? <AdminDashboard user={user} currentModule={currentModule} setModule={setCurrentModule} /> 
    : <VendorDashboard user={user} myName={vendorName} currentModule={currentModule} setModule={setCurrentModule} />;
}

// --- PANTALLAS ---
function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('menu'); 
  const [inputVal, setInputVal] = useState('');

  if (mode === 'menu') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8 shadow-2xl text-center border border-slate-700">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white"><Cloud size={32} /></div>
          <h1 className="text-2xl font-bold text-white mb-2">Distribuidor Izzi</h1>
          <p className="text-slate-400 mb-8">Sistema Central de Ventas</p>
          <div className="space-y-4">
            <button onClick={() => setMode('admin')} className="w-full bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95"><Shield size={20} /> Soy el Distribuidor (Admin)</button>
            <button onClick={() => setMode('vendor')} className="w-full bg-slate-700 hover:bg-slate-600 text-white p-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95"><Users size={20} /> Soy Vendedor / Técnico</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
      <div className="max-w-sm w-full bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700">
        <button onClick={() => setMode('menu')} className="text-slate-500 hover:text-white mb-4 text-sm">← Volver</button>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">{mode === 'admin' ? 'Acceso Distribuidor' : 'Acceso Personal'}</h2>
        <input type="text" value={inputVal} onChange={(e) => setInputVal(e.target.value)} placeholder={mode === 'admin' ? "Contraseña..." : "Tu Nombre (Ej: Juan Perez)"} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white mb-4 outline-none" />
        <button onClick={() => {
            if (mode === 'admin') { 
                if (inputVal === 'admin' || inputVal === 'admin123') onLogin('admin', 'Master'); 
                else alert("Contraseña incorrecta (Usa: admin)"); 
            } else { 
                if (inputVal.trim().length > 1) onLogin('vendor', inputVal.trim()); 
                else alert("Escribe un nombre válido"); 
            }
          }} className="w-full p-3 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-500">Entrar</button>
      </div>
    </div>
  );
}

function AdminDashboard({ user, currentModule, setModule }) {
  const [activeTab, setActiveTab] = useState('reports');
  const [dbCount, setDbCount] = useState(0);
  const [previewData, setPreviewData] = useState([]);
  const [reportsData, setReportsData] = useState([]); 
  const [packages, setPackages] = useState([]);
  const [newPackage, setNewPackage] = useState({ name: '', price: '' });
  const [uploadStep, setUploadStep] = useState(1);
  const [rawFileRows, setRawFileRows] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [progress, setProgress] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [fileName, setFileName] = useState('');
  const appId = 'sales-master-production';
  
  const collectionName = currentModule === 'sales' ? 'sales_master' : 'install_master';

  useEffect(() => {
    if (!user) return;
    const qPack = query(collection(db, 'artifacts', appId, 'public', 'data', 'izzi_packages'));
    const unsubPack = onSnapshot(qPack, (snap) => setPackages(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qRep = query(collection(db, 'artifacts', appId, 'public', 'data', 'sales_reports'), orderBy('createdAt', 'desc'), limit(50));
    const unsubRep = onSnapshot(qRep, (snap) => {
        setReportsData(snap.docs.map(d => ({ 
            id: d.id, ...d.data(), 
            createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate().toLocaleString() : 'Reciente' 
        })));
    });

    const qMain = query(collection(db, 'artifacts', appId, 'public', 'data', collectionName));
    const unsubMain = onSnapshot(qMain, (snap) => setDbCount(snap.size));

    return () => { unsubPack(); unsubRep(); unsubMain(); };
  }, [user, currentModule]);

  const addPackage = async () => {
      if (!newPackage.name || !newPackage.price) return;
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'izzi_packages'), newPackage);
      setNewPackage({ name: '', price: '' });
  };

  const deletePackage = async (id) => await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'izzi_packages', id));

  const fetchPreview = async () => {
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', collectionName), limit(50));
    const snap = await getDocs(q);
    setPreviewData(snap.docs.map(d => d.data()));
  };

  useEffect(() => { if (activeTab === 'view') fetchPreview(); }, [activeTab, currentModule]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      let rows = [];
      if (text.includes('\t')) rows = text.trim().split('\n').map(l => l.split('\t'));
      else rows = parseCSV(text);
      if (rows.length > 0) {
        setRawFileRows(rows);
        const initialMap = {};
        rows[0].forEach((header, index) => {
            const h = header.toLowerCase().trim();
            if (h.includes('cliente') || h.includes('nombre')) initialMap[index] = 'Cliente';
            else if (h.includes('vendedor') || h.includes('tecnico')) initialMap[index] = 'Responsable';
            else if (h.includes('monto')) initialMap[index] = 'Monto';
            else if (h.includes('cuenta') || h.includes('contrato')) initialMap[index] = 'Cuenta';
            else if (h.includes('estatus') || h.includes('estado')) initialMap[index] = 'Estatus';
            else if (h.includes('tel') || h.includes('cel')) initialMap[index] = 'Telefono';
            else initialMap[index] = 'Ignorar';
        });
        setColumnMapping(initialMap);
        setUploadStep(2);
      }
    };
    reader.readAsText(file);
  };

  const executeUpload = async () => {
    if (!confirm(`¿Reemplazar base de ${currentModule}?`)) return;
    setUploadStep(3); setSyncing(true); setProgress('Iniciando...');
    try {
        const snapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', collectionName));
        const chunks = []; snapshot.docs.forEach(d => chunks.push(d));
        while(chunks.length) { const batch = writeBatch(db); chunks.splice(0, 400).forEach(doc => batch.delete(doc.ref)); await batch.commit(); }

        const validRows = rawFileRows.slice(1);
        const processedRows = [];
        validRows.forEach(row => {
            const docData = {}; let hasData = false;
            row.forEach((cellVal, index) => {
                const fieldName = columnMapping[index];
                if (fieldName && fieldName !== 'Ignorar') {
                    docData[fieldName] = cellVal?.trim() || ''; hasData = true;
                    if (fieldName === 'Responsable') docData['normalized_resp'] = cellVal?.trim().toLowerCase();
                }
            });
            if (hasData) processedRows.push(docData);
        });

        const insertChunks = [];
        for (let i = 0; i < processedRows.length; i += 300) insertChunks.push(processedRows.slice(i, i + 300));
        let inserted = 0;
        for (const chunk of insertChunks) {
            const batch = writeBatch(db);
            chunk.forEach(data => { const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', collectionName)); batch.set(ref, data); });
            await batch.commit(); inserted += chunk.length; setProgress(`Subiendo: ${inserted}...`);
            await new Promise(r => setTimeout(r, 100));
        }
        alert("¡Listo!"); setUploadStep(1); fetchPreview(); setActiveTab('view');
    } catch (e) { alert("Error: " + e.message); setUploadStep(2); }
    setSyncing(false);
  };

  const FIELDS = ['Ignorar', 'Cliente', 'Responsable', 'Monto', 'Cuenta', 'Estatus', 'Telefono', 'Direccion', 'Fecha'];

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
             <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Shield className="text-blue-600"/> Admin</h1>
             <div className="flex bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setModule('sales')} className={`px-4 py-1 rounded-md text-sm font-bold transition-all ${currentModule === 'sales' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Cobranza</button>
                <button onClick={() => setModule('install')} className={`px-4 py-1 rounded-md text-sm font-bold transition-all ${currentModule === 'install' ? 'bg-white shadow text-purple-600' : 'text-slate-500'}`}>Instalaciones</button>
             </div>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setActiveTab('reports')} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${activeTab === 'reports' ? 'bg-green-100 text-green-700' : 'text-slate-500'}`}><FileSpreadsheet size={16}/> Reportes</button>
            <button onClick={() => setActiveTab('packages')} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${activeTab === 'packages' ? 'bg-orange-100 text-orange-700' : 'text-slate-500'}`}><Wifi size={16}/> Paquetes</button>
            <button onClick={() => setActiveTab('view')} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${activeTab === 'view' ? 'bg-white shadow' : 'text-slate-500'}`}><List size={16}/> Ver BD</button>
            <button onClick={() => setActiveTab('upload')} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${activeTab === 'upload' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}><Cloud size={16}/> Cargar</button>
          </div>
          <div className="flex items-center gap-4 text-xs">
             <span className="bg-slate-100 px-3 py-1 rounded-full">BD: <b>{collectionName}</b> ({dbCount})</span>
             <button onClick={() => window.location.reload()} className="text-red-500 hover:bg-red-50 p-2 rounded-full"><LogOut size={18}/></button>
          </div>
        </div>

        {activeTab === 'packages' && (
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 animate-in fade-in">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Wifi size={20} className="text-orange-500"/> Catálogo Izzi</h3>
                <div className="flex gap-2 mb-6">
                    <input className="border p-2 rounded-lg w-full text-sm" placeholder="Nombre (ej: Izzi 50)" value={newPackage.name} onChange={e=>setNewPackage({...newPackage, name: e.target.value})} />
                    <input className="border p-2 rounded-lg w-24 text-sm" placeholder="$ Precio" type="number" value={newPackage.price} onChange={e=>setNewPackage({...newPackage, price: e.target.value})} />
                    <button onClick={addPackage} className="bg-orange-500 text-white px-4 py-2 rounded-lg font-bold text-sm">+</button>
                </div>
                <div className="space-y-2">
                    {packages.map(p => (
                        <div key={p.id} className="flex justify-between items-center p-3 border rounded-lg bg-orange-50/50 border-orange-100">
                            <div><p className="font-bold text-slate-800 text-sm">{p.name}</p><p className="text-xs text-slate-500">${p.price}</p></div>
                            <button onClick={()=>deletePackage(p.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'reports' && (
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 animate-in fade-in">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><FileSpreadsheet size={20} className="text-green-600"/> Ventas Reportadas</h3>
                {reportsData.length === 0 ? <div className="text-center py-10 text-slate-400">Sin ventas aún.</div> : 
                   <div className="overflow-x-auto">
                       <table className="w-full text-sm text-left">
                           <thead className="bg-slate-50 font-bold text-xs uppercase text-slate-500">
                               <tr><th className="p-3">Fecha</th><th className="p-3">Vendedor</th><th className="p-3">Cliente</th><th className="p-3">Paquete</th><th className="p-3">Folio</th></tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100 text-slate-700">
                               {reportsData.map((r) => (
                                   <tr key={r.id}>
                                       <td className="p-3 text-xs text-slate-400">{r.createdAt}</td>
                                       <td className="p-3 font-bold text-blue-600">{r.vendor}</td>
                                       <td className="p-3">{r.client}</td>
                                       <td className="p-3"><span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-xs font-bold">{r.package}</span></td>
                                       <td className="p-3 font-mono text-xs">{r.folio}</td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   </div>
                }
                <button onClick={() => downloadCSV(reportsData, 'ventas_izzi.csv')} className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-green-700 w-full justify-center"><Download size={16}/> Exportar CSV</button>
            </div>
        )}

        {activeTab === 'upload' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                {uploadStep === 1 && (
                    <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
                        <div className="mb-4 bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto"><FileSpreadsheet size={40} className="text-slate-400" /></div>
                        <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold inline-flex items-center gap-2"><UploadCloud size={20}/> Seleccionar CSV<input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" /></label>
                    </div>
                )}
                {uploadStep === 2 && (
                    <div>
                        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">Mapeo de Columnas</h3><button onClick={executeUpload} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"><Check size={18}/> Subir</button></div>
                        <div className="overflow-x-auto border border-slate-200 rounded-xl"><table className="w-full text-left text-sm"><thead><tr className="bg-slate-100">{rawFileRows[0].map((header, index) => (<th key={index} className="p-2 min-w-[150px]"><select value={columnMapping[index] || 'Ignorar'} onChange={(e) => setColumnMapping({...columnMapping, [index]: e.target.value})} className="w-full p-2 rounded border border-slate-300 font-bold text-slate-700">{FIELDS.map(f => <option key={f} value={f}>{f}</option>)}</select><div className="mt-1 text-xs text-slate-500 truncate">{header}</div></th>))}</tr></thead><tbody className="divide-y divide-slate-100">{rawFileRows.slice(1, 6).map((row, rIdx) => (<tr key={rIdx}>{row.map((cell, cIdx) => <td key={cIdx} className="p-3 text-slate-600 truncate max-w-[150px]">{cell}</td>)}</tr>))}</tbody></table></div>
                    </div>
                )}
                {uploadStep === 3 && <div className="text-center py-20"><RefreshCw className="animate-spin mx-auto text-slate-400 mb-4" size={48}/><p className="text-slate-500">{progress}</p></div>}
            </div>
        )}

        {activeTab === 'view' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
               <h3 className="font-bold text-slate-800 mb-4">Vista Previa ({collectionName})</h3>
               {previewData.length === 0 ? <div className="text-center py-10 text-slate-400">Vacío. (Sube datos desde PC)</div> : 
                   <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 font-bold text-xs uppercase"><tr>{Object.keys(previewData[0]).filter(k=>k!=='normalized_resp').map(k=><th key={k} className="p-3">{k}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{previewData.map((r,i) => <tr key={i}>{Object.keys(r).filter(k=>k!=='normalized_resp').map(k=><td key={k} className="p-3">{r[k]}</td>)}</tr>)}</tbody></table></div>
               }
            </div>
        )}
      </div>
    </div>
  );
}

function VendorDashboard({ user, myName, currentModule, setModule }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [videoLink, setVideoLink] = useState('https://youtu.be/tu-video-aqui');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportForm, setReportForm] = useState({ client: '', package: '', folio: '', coords: '', portability: '', docs: false });
  const [packages, setPackages] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState([{role: 'system', text: 'Hola, soy tu asistente Izzi. ¿En qué te ayudo?'}]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const appId = 'sales-master-production';
  const collectionName = currentModule === 'sales' ? 'sales_master' : 'install_master';
  const [salesTemplate, setSalesTemplate] = useState(localStorage.getItem('salesTemplate') || "Hola {Cliente}, saldo pendiente: ${Monto}. Paga aquí: {Video}");

  useEffect(() => {
    if (!user || !myName) return;
    setLoading(true);
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', collectionName));
    const qPack = query(collection(db, 'artifacts', appId, 'public', 'data', 'izzi_packages'));
    onSnapshot(qPack, (snap) => setPackages(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return onSnapshot(q, (snap) => {
      const all = snap.docs.map(doc => doc.data());
      const mine = all.filter(i => i['normalized_resp']?.includes(myName.toLowerCase()));
      setData(mine); setLoading(false);
    });
  }, [user, myName, currentModule]);

  const saveTemplate = (val) => { if (currentModule === 'sales') { setSalesTemplate(val); localStorage.setItem('salesTemplate', val); } };
  const submitSaleReport = async () => {
      if (!reportForm.client || !reportForm.package || !reportForm.folio) return alert("Faltan datos obligatorios");
      if (!reportForm.docs) return alert("Debes confirmar la documentación.");
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sales_reports'), { ...reportForm, vendor: myName, createdAt: serverTimestamp() });
      alert("¡Venta Registrada!"); setReportModalOpen(false); setReportForm({ client: '', package: '', folio: '', coords: '', portability: '', docs: false });
  };
  const sendTemplate = (client) => {
      let msg = salesTemplate.replace('{Cliente}', client.Cliente).replace('{Monto}', client.Monto).replace('{Video}', videoLink);
      let ph = client.Telefono?.replace(/\D/g,'') || '';
      window.open(`https://wa.me/52${ph}?text=${encodeURIComponent(msg)}`, '_blank');
  };
  const handleChatSubmit = async (e) => {
    e.preventDefault(); if (!chatInput.trim()) return;
    const userMsg = chatInput; setChatHistory(prev => [...prev, {role: 'user', text: userMsg}]); setChatInput(''); setChatLoading(true);
    const packagesContext = packages.map(p => `- ${p.name}: $${p.price}`).join('\n');
    const response = await callGemini(`Experto Izzi. Paquetes:\n${packagesContext}\nUsuario: ${userMsg}`);
    setChatHistory(prev => [...prev, {role: 'ai', text: response}]); setChatLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-20 font-sans">
       <nav className="flex flex-col gap-4 mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center">
            <div><p className="text-xs text-slate-400 font-bold uppercase">Vendedor</p><h1 className="font-bold text-slate-800 truncate text-lg">{myName}</h1></div>
            <div className="flex gap-2">
                <button onClick={()=>setChatOpen(true)} className="bg-violet-100 text-violet-600 p-2 rounded-full"><MessageCircleQuestion size={18}/></button>
                <button onClick={()=>setReportModalOpen(true)} className="bg-orange-500 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 shadow-lg"><PlusCircle size={16}/> Venta</button>
                <button onClick={()=>setShowConfig(!showConfig)} className="p-2 bg-slate-100 rounded-full"><Settings size={18}/></button>
            </div>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg w-full">
            <button onClick={() => setModule('sales')} className={`flex-1 py-2 rounded-md text-xs font-bold flex items-center justify-center gap-1 ${currentModule === 'sales' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}><DollarSign size={16}/> Cobranza</button>
            <button onClick={() => setModule('install')} className={`flex-1 py-2 rounded-md text-xs font-bold flex items-center justify-center gap-1 ${currentModule === 'install' ? 'bg-white shadow text-purple-600' : 'text-slate-400'}`}><Wrench size={16}/> Instalaciones</button>
          </div>
       </nav>

       {showConfig && <div className="bg-white p-4 rounded-xl shadow-lg mb-4 border-t-4 border-blue-500"><h3 className="font-bold text-sm mb-2">Plantilla</h3><input value={videoLink} onChange={e=>setVideoLink(e.target.value)} className="w-full p-2 border rounded mb-2 text-xs"/><textarea value={salesTemplate} onChange={e=>setSalesTemplate(e.target.value)} className="w-full p-2 border rounded text-xs h-20"/></div>}

       {chatOpen && (
           <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
               <div className="bg-white w-full max-w-md h-[80vh] sm:h-[600px] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                   <div className="bg-violet-600 p-4 flex justify-between items-center text-white"><h3 className="font-bold flex gap-2"><Sparkles size={18}/> Asistente Izzi</h3><button onClick={()=>setChatOpen(false)}><X size={20}/></button></div>
                   <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-3">{chatHistory.map((msg, i) => (<div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] p-3 rounded-xl text-sm ${msg.role === 'user' ? 'bg-violet-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'}`}>{msg.text}</div></div>))} {chatLoading && <div className="text-xs text-slate-400 text-center">Escribiendo...</div>}</div>
                   <form onSubmit={handleChatSubmit} className="p-3 bg-white border-t flex gap-2"><input autoFocus className="flex-1 bg-slate-100 border-0 rounded-full px-4 py-2 text-sm outline-none" placeholder="Pregunta..." value={chatInput} onChange={e=>setChatInput(e.target.value)}/><button type="submit" className="bg-violet-600 text-white p-2 rounded-full"><Send size={18}/></button></form>
               </div>
           </div>
       )}

       {reportModalOpen && (
           <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
               <div className="bg-white p-6 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                   <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-orange-600"><PlusCircle size={24}/> Reportar Venta</h3>
                   <div className="space-y-3">
                       <input className="w-full p-3 border rounded-lg text-sm" placeholder="Cliente" value={reportForm.client} onChange={e=>setReportForm({...reportForm, client: e.target.value})}/>
                       <select className="w-full p-3 border rounded-lg text-sm" value={reportForm.package} onChange={e=>setReportForm({...reportForm, package: e.target.value})}><option value="">Paquete...</option>{packages.map(p => <option key={p.id} value={p.name}>{p.name} (${p.price})</option>)}</select>
                       <input className="w-full p-3 border rounded-lg text-sm" placeholder="Folio" value={reportForm.folio} onChange={e=>setReportForm({...reportForm, folio: e.target.value})}/>
                       <div className="bg-blue-50 p-3 rounded-lg flex gap-2"><input type="checkbox" checked={reportForm.docs} onChange={e=>setReportForm({...reportForm, docs: e.target.checked})}/><p className="text-xs text-blue-800">Documentos completos.</p></div>
                   </div>
                   <button onClick={submitSaleReport} className="mt-6 w-full py-3 bg-orange-500 text-white rounded-xl font-bold">Registrar</button>
                   <button onClick={()=>setReportModalOpen(false)} className="mt-2 w-full py-3 text-slate-400 text-sm">Cancelar</button>
               </div>
           </div>
       )}

       <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Buscar cliente..." className="w-full p-3 rounded-xl border border-slate-200 mb-4 shadow-sm"/>
       {loading ? <div className="text-center opacity-50 mt-10">Cargando...</div> : <div className="grid gap-3 md:grid-cols-2">{data.filter(i => JSON.stringify(i).toLowerCase().includes(searchTerm.toLowerCase())).map((c, i) => (<div key={i} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm"><div className="flex justify-between mb-1"><h3 className="font-bold text-slate-800">{c['Cliente']}</h3><span className="font-mono font-bold text-blue-600">${c['Monto']}</span></div><div className="flex gap-2 mb-3"><span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${c['Estatus'] === 'M1' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{c['Estatus']}</span></div><div className="grid grid-cols-2 gap-2"><button onClick={()=>sendTemplate(c)} className="bg-green-50 text-green-700 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border border-green-100"><MessageSquare size={16}/> WA</button><a href={`tel:${c['Telefono']}`} className="bg-slate-50 text-slate-600 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border border-slate-200"><Phone size={16}/> Llamar</a></div></div>))}</div>}
    </div>
  );
}


