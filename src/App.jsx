import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, writeBatch, doc, getDocs, limit, addDoc, serverTimestamp, orderBy, deleteDoc, getDoc, setDoc, where } from 'firebase/firestore';
import { Shield, Users, Cloud, LogOut, MessageSquare, Search, RefreshCw, Database, Settings, Link as LinkIcon, Check, AlertTriangle, PlayCircle, List, FileSpreadsheet, UploadCloud, Sparkles, PlusCircle, Download, MapPin, Wifi, FileText, Trash2, DollarSign, Wrench, Phone, MessageCircleQuestion, Send, X, Youtube, Calendar, Hash, Building } from 'lucide-react';
import * as XLSX from 'xlsx';

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

// Hash simple de contraseña (básico pero funcional)
function hashPassword(password) {
  return btoa(password).split('').reverse().join('');
}

// Verificar contraseña
function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

// Login con usuario y contraseña
async function loginUser(username, password) {
  try {
    const appId = 'sales-master-production';
    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    const q = query(usersRef, where('username', '==', username.toLowerCase()));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return { success: false, error: 'Usuario no encontrado' };
    }
    
    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    
    if (!verifyPassword(password, userData.passwordHash)) {
      return { success: false, error: 'Contraseña incorrecta' };
    }
    
    return { 
      success: true, 
      user: {
        id: userDoc.id,
        username: userData.username,
        name: userData.name,
        role: userData.role,
        email: userData.email || ''
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Crear usuario nuevo
async function createUser(username, password, name, role, email = '') {
  try {
    const appId = 'sales-master-production';
    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    
    // Verificar si el usuario ya existe
    const q = query(usersRef, where('username', '==', username.toLowerCase()));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      return { success: false, error: 'El usuario ya existe' };
    }
    
    const passwordHash = hashPassword(password);
    await addDoc(usersRef, {
      username: username.toLowerCase(),
      passwordHash,
      name,
      role,
      email,
      createdAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Obtener plantilla global
async function getGlobalTemplate() {
  try {
    const appId = 'sales-master-production';
    const templateRef = doc(db, 'artifacts', appId, 'public', 'data', 'global_settings', 'cobranza_template');
    const docSnap = await getDoc(templateRef);
    
    if (docSnap.exists()) {
      return docSnap.data().template || '';
    }
    return '';
  } catch (error) {
    return '';
  }
}

// Guardar plantilla global
async function saveGlobalTemplate(template, videoLink) {
  try {
    const appId = 'sales-master-production';
    const templateRef = doc(db, 'artifacts', appId, 'public', 'data', 'global_settings', 'cobranza_template');
    await setDoc(templateRef, {
      template,
      videoLink,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Obtener plantilla de instalaciones
async function getInstallTemplate() {
  try {
    const appId = 'sales-master-production';
    const templateRef = doc(db, 'artifacts', appId, 'public', 'data', 'global_settings', 'instalaciones_template');
    const docSnap = await getDoc(templateRef);
    
    if (docSnap.exists()) {
      return {
        template: docSnap.data().template || '',
        imageLink: docSnap.data().imageLink || ''
      };
    }
    return { template: '', imageLink: '' };
  } catch (error) {
    return { template: '', imageLink: '' };
  }
}

// Guardar plantilla de instalaciones
async function saveInstallTemplate(template, imageLink) {
  try {
    const appId = 'sales-master-production';
    const templateRef = doc(db, 'artifacts', appId, 'public', 'data', 'global_settings', 'instalaciones_template');
    await setDoc(templateRef, {
      template,
      imageLink,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
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

// Función para leer archivos Excel
function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  return data;
}

// Función para convertir número de fecha de Excel a fecha legible
function excelDateToString(excelDate) {
  if (!excelDate) return '';
  
  // Si ya es una fecha en formato texto, devolverla tal cual
  if (typeof excelDate === 'string' && excelDate.includes('/')) {
    return excelDate;
  }
  
  // Si es un número (fecha serial de Excel)
  const num = parseFloat(excelDate);
  if (!isNaN(num) && num > 10000 && num < 100000) {
    // Excel usa 1/1/1900 como día 1 (con un bug del año bisiesto 1900)
    const excelEpoch = new Date(1899, 11, 30); // 30 de diciembre de 1899
    const date = new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);
    
    // Formatear como DD/MM/YYYY
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  // Si no es número ni fecha reconocible, devolver el valor original
  return String(excelDate);
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

// Calcular saldo total
const calcularSaldoTotal = (cliente) => {
  // Si ya tiene SaldoTotal, usarlo
  if (cliente.SaldoTotal) {
    return parseFloat(String(cliente.SaldoTotal).replace(/[^0-9.-]/g, '')) || 0;
  }
  // Si tiene Saldo principal
  if (cliente.Saldo) {
    return parseFloat(String(cliente.Saldo).replace(/[^0-9.-]/g, '')) || 0;
  }
  // Sumar saldos por vencer y vencido
  const porVencer = parseFloat(String(cliente.SaldoPorVencer || '0').replace(/[^0-9.-]/g, '')) || 0;
  const vencido = parseFloat(String(cliente.SaldoVencido || '0').replace(/[^0-9.-]/g, '')) || 0;
  const monto = parseFloat(String(cliente.Monto || '0').replace(/[^0-9.-]/g, '')) || 0;
  return porVencer + vencido + monto;
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
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [currentModule, setCurrentModule] = useState('sales'); 
  const [authError, setAuthError] = useState(null);

  // Ya no usamos autenticación anónima, ahora es con login manual

  if (authError) {
    return <ErrorDisplay 
      message={authError.message} 
      currentKey={firebaseConfig.apiKey}
      details="Error de autenticación. Revisa que tu API Key en Vercel sea EXACTA a la de Firebase (sin comillas extra, sin espacios)." 
    />;
  }

  if (isAuthenticating) return <div className="h-screen flex items-center justify-center bg-slate-50 text-blue-600 gap-3"><RefreshCw className="animate-spin"/> Iniciando SalesMaster...</div>;
  if (!role) return <LoginScreen onLogin={(r, name, userData) => { setRole(r); setVendorName(name); setUser(userData); }} />;

  return role === 'admin' 
    ? <AdminDashboard user={user} currentModule={currentModule} setModule={setCurrentModule} /> 
    : <VendorDashboard user={user} myName={vendorName} currentModule={currentModule} setModule={setCurrentModule} />;
}

// --- PANTALLAS ---
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Inicializar usuario admin si no existe
  useEffect(() => {
    const initAdmin = async () => {
      try {
        const appId = 'sales-master-production';
        const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
        const q = query(usersRef, where('username', '==', 'admin'));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          // Crear usuario admin por defecto
          await createUser('admin', 'admin123', 'Administrador', 'admin', '');
          console.log('Usuario admin creado: admin / admin123');
        }
      } catch (error) {
        console.error('Error inicializando admin:', error);
      }
    };
    initAdmin();
  }, []);

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Completa todos los campos');
      return;
    }

    setLoading(true);
    setError('');

    const result = await loginUser(username.trim(), password);
    
    if (result.success) {
      onLogin(result.user.role, result.user.name, result.user);
    } else {
      setError(result.error || 'Error al iniciar sesión');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700">
        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white">
          <Cloud size={32} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2 text-center">Distribuidor Izzi Sureste</h1>
        <p className="text-slate-400 mb-8 text-center">Sistema de Cobranza y Ventas</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-slate-300 text-sm mb-2">Usuario</label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              placeholder="Tu usuario" 
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white mb-2 outline-none focus:border-blue-500"
              autoComplete="username"
              disabled={loading}
            />
          </div>
          
          <div>
            <label className="block text-slate-300 text-sm mb-2">Contraseña</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Tu contraseña" 
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white mb-2 outline-none focus:border-blue-500"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full p-3 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="animate-spin" size={18} />
                Iniciando sesión...
              </>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminDashboard({ user, currentModule, setModule }) {
  const [activeTab, setActiveTab] = useState('clients');
  const [dbCount, setDbCount] = useState(0);
  const [previewData, setPreviewData] = useState([]);
  const [reportsData, setReportsData] = useState([]); 
  const [packages, setPackages] = useState([]);
  const [newPackage, setNewPackage] = useState({ name: '', price: '' });
  const [uploadStep, setUploadStep] = useState(1);
  
  // Estados para gestión de usuarios
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: 'vendor', email: '' });
  const [creatingUser, setCreatingUser] = useState(false);
  
  // Estados para plantilla global
  const [globalTemplate, setGlobalTemplate] = useState('');
  const [globalVideoLink, setGlobalVideoLink] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [rawFileRows, setRawFileRows] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [progress, setProgress] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [fileName, setFileName] = useState('');
  const appId = 'sales-master-production';
  
  // Estados para vista de clientes
  const [allClients, setAllClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [vendors, setVendors] = useState([]);
  const [regions, setRegions] = useState([]);
  const [videoLink, setVideoLink] = useState(localStorage.getItem('adminVideoLink') || 'https://youtu.be/TU-VIDEO-AQUI');
  const [salesTemplate, setSalesTemplate] = useState(localStorage.getItem('adminSalesTemplate') || `¡Hola {Cliente}! 👋

Somos de *Izzi Sureste*. Te contactamos porque tienes un saldo pendiente:

📋 *Cuenta:* {Cuenta}
📍 *Plaza:* {Plaza}
💰 *Saldo Total:* \${SaldoTotal}

📺 *¿Cómo pagar?* Mira este video:
{Video}

¿Tienes dudas? ¡Responde este mensaje! 📱`);
  
  // Estados para plantilla de instalaciones
  const [installTemplate, setInstallTemplate] = useState('');
  const [installImageLink, setInstallImageLink] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  
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
    const unsubMain = onSnapshot(qMain, (snap) => {
      setDbCount(snap.size);
      // Cargar todos los clientes para la vista de clientes
      const clients = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllClients(clients);
      // Extraer vendedores únicos
      const uniqueVendors = [...new Set(clients.map(c => c.Vendedor).filter(v => v))];
      setVendors(uniqueVendors.sort());
      // Extraer regiones únicas
      const uniqueRegions = [...new Set(clients.map(c => c.Region).filter(r => r))];
      setRegions(uniqueRegions.sort());
    });

    // Cargar usuarios
    const qUsers = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Cargar plantilla global de cobranza
    const loadGlobalTemplate = async () => {
      const template = await getGlobalTemplate();
      if (template) {
        setGlobalTemplate(template);
      } else {
        // Plantilla por defecto
        setGlobalTemplate(`¡Hola {Cliente}! 👋

Somos de *Izzi Sureste*. Te contactamos porque tienes un saldo pendiente:

📋 *Cuenta:* {Cuenta}
📍 *Plaza:* {Plaza}
💰 *Saldo Total:* \${SaldoTotal}
⏰ *Por vencer:* \${SaldoPorVencer}
⚠️ *Vencido:* \${SaldoVencido}

📺 *¿Cómo pagar?* Mira este video:
{Video}

¿Tienes dudas? ¡Responde este mensaje! 📱`);
      }
      
      const templateDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'global_settings', 'cobranza_template'));
      if (templateDoc.exists()) {
        setGlobalVideoLink(templateDoc.data().videoLink || '');
      }
    };
    
    // Cargar plantilla de instalaciones
    const loadInstallTemplate = async () => {
      const installData = await getInstallTemplate();
      if (installData.template) {
        setInstallTemplate(installData.template);
      } else {
        // Plantilla por defecto para instalaciones
        setInstallTemplate(`¡Hola {Cliente}! 👋

Tenemos *excelentes noticias* para ti 🎉

Tu servicio de *Izzi* está listo para instalarse.

📋 *Cuenta:* {Cuenta}
📍 *Plaza:* {Plaza}
👤 *Vendedor:* {Vendedor}

📸 *Instrucciones para recibir tu instalación:*
{Imagen}

¿Tienes dudas? ¡Responde este mensaje! 📱`);
      }
      setInstallImageLink(installData.imageLink || '');
    };
    
    loadGlobalTemplate();
    loadInstallTemplate();

    return () => { unsubPack(); unsubRep(); unsubMain(); unsubUsers(); };
  }, [user, currentModule]);

  const addPackage = async () => {
      if (!newPackage.name || !newPackage.price) return;
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'izzi_packages'), newPackage);
      setNewPackage({ name: '', price: '' });
  };

  const deletePackage = async (id) => await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'izzi_packages', id));

  // Función para enviar WhatsApp desde Admin
  const sendTemplate = (cliente) => {
    const saldoTotal = calcularSaldoTotal(cliente);
    
    // Determinar qué plantilla usar según el módulo
    let templateToUse = salesTemplate;
    let imageToUse = '';
    
    if (currentModule === 'install') {
      templateToUse = installTemplate;
      imageToUse = installImageLink;
    }
    
    let msg = templateToUse
      .replace('{Cliente}', cliente.Cliente || 'Cliente')
      .replace('{Cuenta}', cliente.Cuenta || 'N/A')
      .replace('{Plaza}', cliente.Plaza || 'N/A')
      .replace('{Region}', cliente.Region || 'N/A')
      .replace('{Saldo}', cliente.Saldo || '0')
      .replace('{SaldoPorVencer}', cliente.SaldoPorVencer || '0')
      .replace('{SaldoVencido}', cliente.SaldoVencido || '0')
      .replace('{SaldoTotal}', cliente.SaldoTotal || cliente.Saldo || saldoTotal.toFixed(2))
      .replace('{Estatus}', cliente.Estatus || 'N/A')
      .replace('{FechaInstalacion}', cliente.FechaInstalacion || 'N/A')
      .replace('{FechaVencimiento}', cliente.FechaVencimiento || 'N/A')
      .replace('{Vendedor}', cliente.Vendedor || 'N/A')
      .replace('{Video}', videoLink)
      .replace('{Imagen}', imageToUse || '');
    
    let ph = String(cliente.Telefono || '').replace(/\D/g,'');
    if (ph && !ph.startsWith('52') && ph.length === 10) {
      ph = '52' + ph;
    }
    
    // Si hay imagen, agregarla al mensaje
    if (imageToUse && currentModule === 'install') {
      msg = msg + '\n\n' + imageToUse;
    }
    
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const saveConfig = () => {
    localStorage.setItem('adminSalesTemplate', salesTemplate);
    localStorage.setItem('adminVideoLink', videoLink);
    alert('¡Configuración guardada!');
    setShowConfig(false);
  };

  // Filtrar clientes
  const filteredClients = allClients.filter(c => {
    const matchesSearch = searchTerm === '' || JSON.stringify(c).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesVendor = filterVendor === '' || c.Vendedor === filterVendor;
    const matchesRegion = filterRegion === '' || c.Region === filterRegion;
    return matchesSearch && matchesVendor && matchesRegion;
  });

  // Obtener saldo para mostrar
  const getSaldo = (c) => {
    if (c.SaldoTotal) return c.SaldoTotal;
    if (c.Saldo) return c.Saldo;
    return calcularSaldoTotal(c).toFixed(2);
  };

  const fetchPreview = async () => {
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', collectionName), limit(50));
    const snap = await getDocs(q);
    setPreviewData(snap.docs.map(d => d.data()));
  };

  useEffect(() => { if (activeTab === 'view') fetchPreview(); }, [activeTab, currentModule]);

  // COLUMNAS QUE NOS INTERESAN (el resto se ignora automáticamente)
  const COLUMNAS_IMPORTANTES = {
    'cuenta': 'Cuenta',
    'plaza': 'Plaza',
    'region': 'Region',
    'región': 'Region',
    'noreste': 'Region',
    'pacifico': 'Region',
    'pacífico': 'Region',
    'metropolitana': 'Region',
    'occidente': 'Region',
    'sureste': 'Region',
    'saldo': 'Saldo',
    'saldo por vencer': 'SaldoPorVencer',
    'saldo_por_vencer': 'SaldoPorVencer',
    'saldo vencido': 'SaldoVencido',
    'saldo_vencido': 'SaldoVencido',
    'fecha instalacion': 'FechaInstalacion',
    'fecha_instalacion': 'FechaInstalacion',
    'fecha perdida fpd': 'FechaPerdida',
    'fecha_perdida_fpd': 'FechaPerdida',
    'estatus fpd': 'Estatus',
    'estatus_fpd': 'Estatus',
    'estatus': 'Estatus',
    'fecha vencimiento': 'FechaVencimiento',
    'fecha_vencimiento': 'FechaVencimiento',
    'vendedor': 'Vendedor',
    'cliente': 'Cliente',
    'telefono1': 'Telefono',
    'telefono': 'Telefono',
    'tel': 'Telefono'
  };

  // Función mejorada para manejar CSV y Excel
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    console.log("Archivo seleccionado:", file.name, "Tamaño:", file.size);
    
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    
    if (isExcel) {
      // Leer archivo Excel
      const reader = new FileReader();
      reader.onerror = () => {
        alert("Error al leer el archivo");
        console.error("FileReader error:", reader.error);
      };
      reader.onload = (evt) => {
        try {
          console.log("Archivo cargado, procesando Excel...");
          const data = new Uint8Array(evt.target.result);
          const rows = parseExcel(data);
          console.log("Filas encontradas:", rows.length);
          console.log("Primera fila (encabezados):", rows[0]);
          if (rows.length > 0) {
            processFileRows(rows);
          } else {
            alert("El archivo está vacío o no se pudo leer");
          }
        } catch (error) {
          console.error("Error parseando Excel:", error);
          alert("Error al leer el archivo Excel: " + error.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Leer CSV o TXT
      const reader = new FileReader();
      reader.onerror = () => {
        alert("Error al leer el archivo");
      };
      reader.onload = (evt) => {
        try {
          const text = evt.target.result;
          console.log("Archivo cargado, procesando CSV/TXT...");
          let rows = [];
          if (text.includes('\t')) {
            rows = text.trim().split('\n').map(l => l.split('\t'));
          } else {
            rows = parseCSV(text);
          }
          console.log("Filas encontradas:", rows.length);
          if (rows.length > 0) {
            processFileRows(rows);
          } else {
            alert("El archivo está vacío");
          }
        } catch (error) {
          console.error("Error parseando CSV:", error);
          alert("Error al leer el archivo: " + error.message);
        }
      };
      reader.readAsText(file);
    }
  };

  // Procesar filas del archivo - DETECCIÓN AUTOMÁTICA
  const processFileRows = (rows) => {
    console.log("processFileRows llamado con", rows.length, "filas");
    
    // Filtrar filas vacías
    const filteredRows = rows.filter(row => {
      if (!row || !Array.isArray(row)) return false;
      return row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
    });
    
    console.log("Filas después de filtrar vacías:", filteredRows.length);
    
    if (filteredRows.length < 2) {
      alert("El archivo no tiene suficientes datos (necesita al menos encabezados + 1 fila)");
      return;
    }
    
    setRawFileRows(filteredRows);
    const initialMap = {};
    const headers = filteredRows[0];
    let columnasDetectadas = [];
    
    console.log("Encabezados detectados:", headers);
    
    headers.forEach((header, index) => {
      const h = String(header || '').toLowerCase().trim().replace(/_/g, ' ');
      
      // Buscar en nuestro diccionario de columnas importantes
      let encontrado = false;
      for (const [patron, campo] of Object.entries(COLUMNAS_IMPORTANTES)) {
        if (h === patron || h.includes(patron)) {
          // Verificar que no sea una asignación duplicada incorrecta
          // Por ejemplo, "fecha perdida" debe ser FechaPerdida, no FechaInstalacion
          if (patron === 'fecha' && h.includes('perdida')) continue;
          if (patron === 'fecha' && h.includes('vencimiento')) continue;
          
          initialMap[index] = campo;
          columnasDetectadas.push(`${header} → ${campo}`);
          encontrado = true;
          break;
        }
      }
      
      if (!encontrado) {
        initialMap[index] = 'Ignorar';
      }
    });
    
    console.log("Columnas detectadas:", columnasDetectadas);
    console.log("Mapeo automático:", initialMap);
    setColumnMapping(initialMap);
    
    // Mostrar resumen de lo que se detectó
    const columnasUtiles = Object.values(initialMap).filter(v => v !== 'Ignorar').length;
    const columnasIgnoradas = Object.values(initialMap).filter(v => v === 'Ignorar').length;
    
    console.log(`Columnas útiles: ${columnasUtiles}, Ignoradas: ${columnasIgnoradas}`);
    
    setUploadStep(2);
  };

  const executeUpload = async () => {
    console.log("Iniciando carga...");
    console.log("rawFileRows:", rawFileRows.length, "filas");
    console.log("columnMapping:", columnMapping);
    
    if (!confirm(`¿Reemplazar base de ${currentModule}? (${rawFileRows.length - 1} registros)`)) return;
    
    setUploadStep(3); setSyncing(true); setProgress('Iniciando...');
    
    try {
        // Limpiar base anterior
        const snapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', collectionName));
        console.log("Documentos existentes a borrar:", snapshot.size);
        
        const chunks = []; 
        snapshot.docs.forEach(d => chunks.push(d));
        setProgress(`Limpiando ${snapshot.size} registros anteriores...`);
        
        while(chunks.length) { 
          const batch = writeBatch(db); 
          chunks.splice(0, 400).forEach(d => batch.delete(d.ref)); 
          await batch.commit(); 
        }
        console.log("Base limpiada");

        // Procesar nuevos registros
        const validRows = rawFileRows.slice(1); // Quitar encabezados
        console.log("Filas a procesar (sin encabezados):", validRows.length);
        
        const processedRows = [];
        validRows.forEach((row, rowIndex) => {
            const docData = {}; 
            let hasData = false;
            
            row.forEach((cellVal, colIndex) => {
                const fieldName = columnMapping[colIndex];
                if (fieldName && fieldName !== 'Ignorar') {
                    let value = String(cellVal ?? '').trim();
                    
                    // Convertir fechas de Excel (números) a formato legible
                    if (fieldName.toLowerCase().includes('fecha') && value) {
                      value = excelDateToString(value);
                    }
                    
                    if (value) {
                      docData[fieldName] = value;
                      hasData = true;
                    }
                    if (fieldName === 'Vendedor' && value) {
                      docData['normalized_resp'] = value.toLowerCase();
                    }
                    // Normalizar región
                    if (fieldName === 'Region' && value) {
                      const regionLower = value.toLowerCase().trim();
                      // Normalizar nombres de regiones
                      if (regionLower.includes('noreste') || regionLower === 'ne') {
                        docData['Region'] = 'Noreste';
                      } else if (regionLower.includes('pacifico') || regionLower.includes('pacífico') || regionLower === 'pac') {
                        docData['Region'] = 'Pacífico';
                      } else if (regionLower.includes('metropolitana') || regionLower.includes('metro') || regionLower === 'met') {
                        docData['Region'] = 'Metropolitana';
                      } else if (regionLower.includes('occidente') || regionLower === 'occ') {
                        docData['Region'] = 'Occidente';
                      } else if (regionLower.includes('sureste') || regionLower === 'se') {
                        docData['Region'] = 'Sureste';
                      } else {
                        // Capitalizar primera letra
                        docData['Region'] = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
                      }
                    }
                }
            });
            
            // Calcular saldo total
            // Si ya viene el campo Saldo, usarlo como SaldoTotal
            if (docData.Saldo) {
                docData.SaldoTotal = docData.Saldo;
            }
            // Si hay saldos separados (por vencer y vencido), sumarlos
            if (docData.SaldoPorVencer || docData.SaldoVencido) {
                const porVencer = parseFloat(String(docData.SaldoPorVencer || '0').replace(/[^0-9.-]/g, '')) || 0;
                const vencido = parseFloat(String(docData.SaldoVencido || '0').replace(/[^0-9.-]/g, '')) || 0;
                const saldoBase = parseFloat(String(docData.Saldo || '0').replace(/[^0-9.-]/g, '')) || 0;
                // El saldo total es la suma de todos
                if (!docData.Saldo) {
                  docData.SaldoTotal = (porVencer + vencido).toFixed(2);
                }
            }
            
            if (hasData) {
              processedRows.push(docData);
              if (rowIndex < 3) console.log(`Fila ${rowIndex} procesada:`, docData);
            }
        });

        console.log("Total registros procesados:", processedRows.length);
        
        if (processedRows.length === 0) {
          alert("No se encontraron datos válidos para subir. Verifica el mapeo de columnas.");
          setUploadStep(2);
          setSyncing(false);
          return;
        }

        // Subir en lotes
        const insertChunks = [];
        for (let i = 0; i < processedRows.length; i += 300) {
          insertChunks.push(processedRows.slice(i, i + 300));
        }
        
        let inserted = 0;
        for (const chunk of insertChunks) {
            const batch = writeBatch(db);
            chunk.forEach(data => { 
              const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', collectionName)); 
              batch.set(ref, data); 
            });
            await batch.commit(); 
            inserted += chunk.length; 
            setProgress(`Subiendo: ${inserted} de ${processedRows.length}...`);
            console.log(`Subidos ${inserted} de ${processedRows.length}`);
            await new Promise(r => setTimeout(r, 100));
        }
        
        console.log("Carga completada!");
        alert(`¡Listo! Se cargaron ${processedRows.length} registros.`); 
        setUploadStep(1); 
        fetchPreview(); 
        setActiveTab('view');
    } catch (e) { 
      console.error("Error en carga:", e);
      alert("Error: " + e.message); 
      setUploadStep(2); 
    }
    setSyncing(false);
  };

  // Campos disponibles para mapeo
  const FIELDS = ['Ignorar', 'Cliente', 'Vendedor', 'Cuenta', 'Plaza', 'Region', 'Telefono', 'Saldo', 'SaldoPorVencer', 'SaldoVencido', 'FechaInstalacion', 'FechaVencimiento', 'FechaPerdida', 'Estatus', 'Direccion'];

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
          <div className="flex bg-slate-100 p-1 rounded-lg flex-wrap">
            <button onClick={() => setActiveTab('clients')} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${activeTab === 'clients' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}><Users size={16}/> Clientes</button>
            <button onClick={() => setActiveTab('reports')} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${activeTab === 'reports' ? 'bg-green-100 text-green-700' : 'text-slate-500'}`}><FileSpreadsheet size={16}/> Reportes</button>
            <button onClick={() => setActiveTab('users')} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${activeTab === 'users' ? 'bg-purple-100 text-purple-700' : 'text-slate-500'}`}><Shield size={16}/> Usuarios</button>
            <button onClick={() => setActiveTab('template')} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${activeTab === 'template' ? 'bg-yellow-100 text-yellow-700' : 'text-slate-500'}`}><FileText size={16}/> Plantilla</button>
            <button onClick={() => setActiveTab('packages')} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${activeTab === 'packages' ? 'bg-orange-100 text-orange-700' : 'text-slate-500'}`}><Wifi size={16}/> Paquetes</button>
            <button onClick={() => setActiveTab('view')} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${activeTab === 'view' ? 'bg-white shadow' : 'text-slate-500'}`}><List size={16}/> Ver BD</button>
            <button onClick={() => setActiveTab('upload')} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${activeTab === 'upload' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}><Cloud size={16}/> Cargar</button>
          </div>
          <div className="flex items-center gap-4 text-xs">
             <span className="bg-slate-100 px-3 py-1 rounded-full">BD: <b>{collectionName}</b> ({dbCount})</span>
             <button onClick={() => window.location.reload()} className="text-red-500 hover:bg-red-50 p-2 rounded-full"><LogOut size={18}/></button>
          </div>
        </div>

        {/* VISTA DE CLIENTES PARA ADMIN */}
        {activeTab === 'clients' && (
          <div className="space-y-4">
            {/* Configuración */}
            {showConfig && (
              <div className="bg-white p-4 rounded-xl shadow-lg border-t-4 border-blue-500">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Settings size={16}/> Configuración de Plantilla</h3>
                <div className="mb-3">
                  <label className="text-xs font-bold text-slate-600 mb-1 block flex items-center gap-1"><Youtube size={14} className="text-red-500"/> Link del Video de Pago</label>
                  <input value={videoLink} onChange={e=>setVideoLink(e.target.value)} className="w-full p-2 border rounded text-xs" placeholder="https://youtu.be/tu-video"/>
                </div>
                <div className="mb-3">
                  <label className="text-xs font-bold text-slate-600 mb-1 block">Plantilla de WhatsApp</label>
                  <textarea value={salesTemplate} onChange={e=>setSalesTemplate(e.target.value)} className="w-full p-2 border rounded text-xs h-40 font-mono"/>
                  <p className="text-[10px] text-slate-400 mt-1">Variables: {'{Cliente}'}, {'{Cuenta}'}, {'{Plaza}'}, {'{SaldoTotal}'}, {'{SaldoPorVencer}'}, {'{SaldoVencido}'}, {'{Estatus}'}, {'{Vendedor}'}, {'{Video}'}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveConfig} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-bold">Guardar</button>
                  <button onClick={()=>setShowConfig(false)} className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg text-xs font-bold">Cancelar</button>
                </div>
              </div>
            )}

            {/* Barra de búsqueda y filtros */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row gap-3">
                <input 
                  value={searchTerm} 
                  onChange={e=>setSearchTerm(e.target.value)} 
                  placeholder="🔍 Buscar cliente, cuenta, teléfono..." 
                  className="flex-1 p-3 rounded-lg border border-slate-200 text-sm"
                />
                <select 
                  value={filterRegion} 
                  onChange={e=>setFilterRegion(e.target.value)}
                  className="p-3 rounded-lg border border-slate-200 text-sm min-w-[180px]"
                >
                  <option value="">Todas las regiones</option>
                  <option value="Noreste">Noreste</option>
                  <option value="Pacífico">Pacífico</option>
                  <option value="Metropolitana">Metropolitana</option>
                  <option value="Occidente">Occidente</option>
                  <option value="Sureste">Sureste</option>
                  {regions.filter(r => !['Noreste', 'Pacífico', 'Metropolitana', 'Occidente', 'Sureste'].includes(r)).map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <select 
                  value={filterVendor} 
                  onChange={e=>setFilterVendor(e.target.value)}
                  className="p-3 rounded-lg border border-slate-200 text-sm min-w-[200px]"
                >
                  <option value="">Todos los vendedores</option>
                  {vendors.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <button onClick={()=>setShowConfig(!showConfig)} className="p-3 bg-slate-100 rounded-lg hover:bg-slate-200">
                  <Settings size={18}/>
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Mostrando {filteredClients.length} de {allClients.length} clientes
                {filterRegion && ` • Región: ${filterRegion}`}
                {filterVendor && ` • Vendedor: ${filterVendor}`}
              </p>
            </div>

            {/* Lista de clientes */}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filteredClients.slice(0, 100).map((c, i) => (
                <div key={c.id || i} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  {/* Encabezado */}
                  <div className="flex justify-between mb-2">
                    <h3 className="font-bold text-slate-800 text-sm truncate flex-1">{c.Cliente || 'Sin nombre'}</h3>
                    <span className="font-mono font-bold text-green-600 text-lg">${getSaldo(c)}</span>
                  </div>
                  
                  {/* Información */}
                  <div className="grid grid-cols-2 gap-1 mb-3 text-xs text-slate-500">
                    {c.Cuenta && <div className="flex items-center gap-1"><Hash size={12}/> {c.Cuenta}</div>}
                    {c.Plaza && <div className="flex items-center gap-1"><Building size={12}/> {c.Plaza}</div>}
                    {c.Region && <div className="flex items-center gap-1 text-blue-600 font-bold"><MapPin size={12}/> {c.Region}</div>}
                    {c.FechaVencimiento && <div className="flex items-center gap-1 text-red-500"><Calendar size={12}/> Vence: {c.FechaVencimiento}</div>}
                    {c.Telefono && <div className="flex items-center gap-1"><Phone size={12}/> {c.Telefono}</div>}
                  </div>

                  {/* Vendedor */}
                  {c.Vendedor && (
                    <div className="mb-2 text-xs">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">👤 {c.Vendedor}</span>
                    </div>
                  )}

                  {/* Saldos desglosados */}
                  {(c.SaldoPorVencer || c.SaldoVencido) && (
                    <div className="flex gap-2 mb-3 text-[10px] flex-wrap">
                      {c.SaldoPorVencer && <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded">Por vencer: ${c.SaldoPorVencer}</span>}
                      {c.SaldoVencido && <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded">Vencido: ${c.SaldoVencido}</span>}
                    </div>
                  )}

                  {/* Estatus */}
                  <div className="flex gap-2 mb-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      c.Estatus?.includes('Perdida') ? 'bg-red-100 text-red-700' : 
                      c.Estatus === 'M1' ? 'bg-amber-100 text-amber-700' : 
                      c.Estatus === 'M2' ? 'bg-orange-100 text-orange-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>{c.Estatus || 'Sin estatus'}</span>
                  </div>
                  
                  {/* Botones */}
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={()=>sendTemplate(c)} 
                      className="bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                      <MessageSquare size={16}/> WhatsApp
                    </button>
                    <a 
                      href={`tel:${c.Telefono}`} 
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border border-slate-200 transition-colors"
                    >
                      <Phone size={16}/> Llamar
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {filteredClients.length > 100 && (
              <p className="text-center text-slate-400 text-sm">Mostrando primeros 100 de {filteredClients.length} resultados. Usa los filtros para ver más específicos.</p>
            )}

            {filteredClients.length === 0 && (
              <div className="text-center py-10 text-slate-400 bg-white rounded-xl">
                <Users size={48} className="mx-auto mb-4 opacity-50"/>
                <p>No hay clientes que coincidan con la búsqueda.</p>
              </div>
            )}
          </div>
        )}

        {/* GESTIÓN DE USUARIOS */}
        {activeTab === 'users' && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Shield size={20} className="text-purple-500"/> Gestión de Usuarios</h3>
            
            {/* Formulario para crear usuario */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6">
              <h4 className="font-bold text-sm mb-3 text-purple-800">Crear Nuevo Usuario</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input 
                  className="border p-2 rounded-lg text-sm" 
                  placeholder="Usuario (ej: juan.perez)" 
                  value={newUser.username}
                  onChange={e => setNewUser({...newUser, username: e.target.value})}
                />
                <input 
                  type="password"
                  className="border p-2 rounded-lg text-sm" 
                  placeholder="Contraseña" 
                  value={newUser.password}
                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                />
                <input 
                  className="border p-2 rounded-lg text-sm" 
                  placeholder="Nombre completo" 
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                />
                <select 
                  className="border p-2 rounded-lg text-sm"
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value})}
                >
                  <option value="vendor">Vendedor</option>
                  <option value="admin">Administrador</option>
                </select>
                <input 
                  type="email"
                  className="border p-2 rounded-lg text-sm md:col-span-2" 
                  placeholder="Email (opcional)" 
                  value={newUser.email}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                />
              </div>
              <button 
                onClick={async () => {
                  if (!newUser.username || !newUser.password || !newUser.name) {
                    alert('Completa todos los campos obligatorios');
                    return;
                  }
                  setCreatingUser(true);
                  const result = await createUser(newUser.username, newUser.password, newUser.name, newUser.role, newUser.email);
                  if (result.success) {
                    alert('¡Usuario creado exitosamente!');
                    setNewUser({ username: '', password: '', name: '', role: 'vendor', email: '' });
                  } else {
                    alert('Error: ' + result.error);
                  }
                  setCreatingUser(false);
                }}
                disabled={creatingUser}
                className="mt-3 bg-purple-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50"
              >
                {creatingUser ? 'Creando...' : 'Crear Usuario'}
              </button>
            </div>

            {/* Lista de usuarios */}
            <div>
              <h4 className="font-bold text-sm mb-3">Usuarios Registrados ({users.length})</h4>
              <div className="space-y-2">
                {users.map(u => (
                  <div key={u.id} className="flex justify-between items-center p-3 border rounded-lg bg-slate-50">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{u.name}</p>
                      <p className="text-xs text-slate-500">Usuario: {u.username} | Rol: {u.role === 'admin' ? 'Administrador' : 'Vendedor'}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      u.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {u.role === 'admin' ? 'Admin' : 'Vendedor'}
                    </span>
                  </div>
                ))}
                {users.length === 0 && (
                  <p className="text-center text-slate-400 py-4">No hay usuarios registrados aún</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PLANTILLAS GLOBALES */}
        {activeTab === 'template' && (
          <div className="space-y-6">
            {/* PLANTILLA DE COBRANZA */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><FileText size={20} className="text-yellow-500"/> Plantilla Global de Cobranza</h3>
              <p className="text-sm text-slate-500 mb-4">Esta plantilla será la predeterminada para todos los vendedores. Cada vendedor puede personalizar la suya.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <Youtube size={16} className="text-red-500"/> Link del Video de Pago
                  </label>
                  <input 
                    value={globalVideoLink} 
                    onChange={e => setGlobalVideoLink(e.target.value)} 
                    className="w-full p-3 border rounded-lg text-sm"
                    placeholder="https://youtu.be/tu-video"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Plantilla de Mensaje WhatsApp</label>
                  <textarea 
                    value={globalTemplate} 
                    onChange={e => setGlobalTemplate(e.target.value)} 
                    className="w-full p-3 border rounded-lg text-sm h-64 font-mono"
                    placeholder="Escribe tu plantilla aquí..."
                  />
                  <p className="text-xs text-slate-400 mt-2">
                    Variables disponibles: {'{Cliente}'}, {'{Cuenta}'}, {'{Plaza}'}, {'{Region}'}, {'{SaldoTotal}'}, {'{SaldoPorVencer}'}, {'{SaldoVencido}'}, {'{Estatus}'}, {'{Vendedor}'}, {'{Video}'}
                  </p>
                </div>
                
                <button 
                  onClick={async () => {
                    setSavingTemplate(true);
                    const result = await saveGlobalTemplate(globalTemplate, globalVideoLink);
                    if (result.success) {
                      alert('¡Plantilla de cobranza guardada exitosamente!');
                    } else {
                      alert('Error: ' + result.error);
                    }
                    setSavingTemplate(false);
                  }}
                  disabled={savingTemplate}
                  className="w-full bg-yellow-600 text-white px-6 py-3 rounded-lg font-bold disabled:opacity-50"
                >
                  {savingTemplate ? 'Guardando...' : '💾 Guardar Plantilla de Cobranza'}
                </button>
              </div>
            </div>

            {/* PLANTILLA DE INSTALACIONES */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><FileText size={20} className="text-purple-500"/> Plantilla Global de Instalaciones</h3>
              <p className="text-sm text-slate-500 mb-4">Plantilla para notificar a clientes sobre instalaciones disponibles. Incluye imagen con instrucciones.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <FileText size={16} className="text-purple-500"/> Link de la Imagen con Instrucciones
                  </label>
                  <input 
                    value={installImageLink} 
                    onChange={e => setInstallImageLink(e.target.value)} 
                    className="w-full p-3 border rounded-lg text-sm"
                    placeholder="https://ejemplo.com/imagen-instrucciones.jpg o link de Google Drive/Imgur"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    💡 Tip: Sube la imagen a Google Drive, Imgur o similar y pega el link directo aquí
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Plantilla de Mensaje WhatsApp</label>
                  <textarea 
                    value={installTemplate} 
                    onChange={e => setInstallTemplate(e.target.value)} 
                    className="w-full p-3 border rounded-lg text-sm h-64 font-mono"
                    placeholder="Escribe tu plantilla aquí..."
                  />
                  <p className="text-xs text-slate-400 mt-2">
                    Variables disponibles: {'{Cliente}'}, {'{Cuenta}'}, {'{Plaza}'}, {'{Region}'}, {'{Vendedor}'}, {'{Imagen}'}
                  </p>
                </div>
                
                <button 
                  onClick={async () => {
                    setSavingTemplate(true);
                    const result = await saveInstallTemplate(installTemplate, installImageLink);
                    if (result.success) {
                      alert('¡Plantilla de instalaciones guardada exitosamente!');
                    } else {
                      alert('Error: ' + result.error);
                    }
                    setSavingTemplate(false);
                  }}
                  disabled={savingTemplate}
                  className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-bold disabled:opacity-50"
                >
                  {savingTemplate ? 'Guardando...' : '💾 Guardar Plantilla de Instalaciones'}
                </button>
              </div>
            </div>
          </div>
        )}

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
                        <p className="text-slate-500 mb-4 text-sm">Soporta archivos <b>Excel (.xlsx)</b> y <b>CSV</b></p>
                        <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold inline-flex items-center gap-2">
                          <UploadCloud size={20}/> Seleccionar Archivo
                          <input type="file" accept=".csv,.txt,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                        </label>
                    </div>
                )}
                {uploadStep === 2 && (
                    <div>
                        {/* Resumen de detección automática */}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                          <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                            <Check size={20}/> Columnas detectadas automáticamente
                          </h3>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {Object.entries(columnMapping).filter(([_, v]) => v !== 'Ignorar').map(([idx, campo]) => (
                              <span key={idx} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                                {rawFileRows[0][idx]} → {campo}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-blue-600">
                            ✅ {Object.values(columnMapping).filter(v => v !== 'Ignorar').length} columnas se usarán | 
                            ⏭️ {Object.values(columnMapping).filter(v => v === 'Ignorar').length} columnas se ignorarán
                          </p>
                        </div>

                        <div className="flex justify-between items-center mb-4">
                          <div>
                            <h3 className="font-bold text-lg">Archivo: {fileName}</h3>
                            <p className="text-xs text-slate-500">{rawFileRows.length - 1} registros listos para subir</p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setUploadStep(1)} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold text-sm">Cancelar</button>
                            <button onClick={executeUpload} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 text-lg"><UploadCloud size={20}/> ¡Subir Ahora!</button>
                          </div>
                        </div>
                        
                        <details className="mb-4">
                          <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700">
                            ⚙️ Ajustar mapeo manualmente (opcional)
                          </summary>
                          <div className="mt-3 overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-left text-sm">
                              <thead>
                                <tr className="bg-slate-100">
                                  {rawFileRows[0].map((header, index) => (
                                    <th key={index} className="p-2 min-w-[150px]">
                                      <select 
                                        value={columnMapping[index] || 'Ignorar'} 
                                        onChange={(e) => setColumnMapping({...columnMapping, [index]: e.target.value})} 
                                        className="w-full p-2 rounded border border-slate-300 font-bold text-slate-700 text-xs"
                                      >
                                        {FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                                      </select>
                                      <div className="mt-1 text-xs text-slate-500 truncate">{String(header)}</div>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {rawFileRows.slice(1, 4).map((row, rIdx) => (
                                  <tr key={rIdx}>
                                    {row.map((cell, cIdx) => (
                                      <td key={cIdx} className="p-3 text-slate-600 truncate max-w-[150px] text-xs">{String(cell)}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                    </div>
                )}
                {uploadStep === 3 && <div className="text-center py-20"><RefreshCw className="animate-spin mx-auto text-slate-400 mb-4" size={48}/><p className="text-slate-500">{progress}</p></div>}
            </div>
        )}

        {activeTab === 'view' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
               <h3 className="font-bold text-slate-800 mb-4">Vista Previa ({collectionName}) - {previewData.length} registros</h3>
               {previewData.length === 0 ? <div className="text-center py-10 text-slate-400">Vacío. (Sube datos desde la pestaña Cargar)</div> : 
                   <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                       <thead className="bg-slate-50 font-bold text-xs uppercase">
                         <tr>{Object.keys(previewData[0]).filter(k=>k!=='normalized_resp').map(k=><th key={k} className="p-3 whitespace-nowrap">{k}</th>)}</tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                         {previewData.map((r,i) => (
                           <tr key={i}>
                             {Object.keys(r).filter(k=>k!=='normalized_resp').map(k=>(
                               <td key={k} className="p-3 text-xs max-w-[200px] truncate">{r[k]}</td>
                             ))}
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
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
  const [videoLink, setVideoLink] = useState(localStorage.getItem('videoLink') || 'https://youtu.be/TU-VIDEO-AQUI');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportForm, setReportForm] = useState({ client: '', package: '', folio: '', coords: '', portability: '', docs: false });
  const [packages, setPackages] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState([{role: 'system', text: 'Hola, soy tu asistente Izzi. ¿En qué te ayudo?'}]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const appId = 'sales-master-production';
  const collectionName = currentModule === 'sales' ? 'sales_master' : 'install_master';
  
  // Plantilla mejorada con más campos
  const defaultTemplate = `¡Hola {Cliente}! 👋

Somos de *Izzi Sureste*. Te contactamos porque tienes un saldo pendiente:

📋 *Cuenta:* {Cuenta}
📍 *Plaza:* {Plaza}
💰 *Saldo Total:* ${'{SaldoTotal}'}
⏰ *Por vencer:* ${'{SaldoPorVencer}'}
⚠️ *Vencido:* ${'{SaldoVencido}'}

📺 *¿Cómo pagar?* Mira este video:
{Video}

¿Tienes dudas? ¡Responde este mensaje! 📱`;

  const [salesTemplate, setSalesTemplate] = useState(localStorage.getItem('salesTemplate') || defaultTemplate);
  const [usingGlobalTemplate, setUsingGlobalTemplate] = useState(false);

  useEffect(() => {
    if (!user || !myName) return;
    
    // Cargar plantilla global al inicio
    const loadGlobalTemplate = async () => {
      const global = await getGlobalTemplate();
      if (global) {
        const savedPersonal = localStorage.getItem('salesTemplate');
        if (!savedPersonal) {
          // Si no tiene plantilla personal, usar la global
          setSalesTemplate(global);
          setUsingGlobalTemplate(true);
        } else {
          setSalesTemplate(savedPersonal);
          setUsingGlobalTemplate(false);
        }
        
        // Cargar video link global
        const templateDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'global_settings', 'cobranza_template'));
        if (templateDoc.exists() && !localStorage.getItem('videoLink')) {
          setVideoLink(templateDoc.data().videoLink || '');
        }
      }
    };
    loadGlobalTemplate();
    
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

  const saveConfig = () => {
    localStorage.setItem('salesTemplate', salesTemplate);
    localStorage.setItem('videoLink', videoLink);
    alert('¡Configuración guardada!');
    setShowConfig(false);
  };

  const submitSaleReport = async () => {
      if (!reportForm.client || !reportForm.package || !reportForm.folio) return alert("Faltan datos obligatorios");
      if (!reportForm.docs) return alert("Debes confirmar la documentación.");
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sales_reports'), { ...reportForm, vendor: myName, createdAt: serverTimestamp() });
      alert("¡Venta Registrada!"); setReportModalOpen(false); setReportForm({ client: '', package: '', folio: '', coords: '', portability: '', docs: false });
  };

  // Función mejorada para enviar WhatsApp con todos los datos
  const sendTemplate = (cliente) => {
    // Calcular saldo total
    const saldoTotal = calcularSaldoTotal(cliente);
    
    let msg = salesTemplate
      .replace('{Cliente}', cliente.Cliente || 'Cliente')
      .replace('{Cuenta}', cliente.Cuenta || 'N/A')
      .replace('{Plaza}', cliente.Plaza || 'N/A')
      .replace('{Saldo}', cliente.Saldo || '0')
      .replace('{SaldoPorVencer}', cliente.SaldoPorVencer || '0')
      .replace('{SaldoVencido}', cliente.SaldoVencido || '0')
      .replace('{SaldoTotal}', cliente.SaldoTotal || cliente.Saldo || saldoTotal.toFixed(2))
      .replace('{Monto}', cliente.Monto || cliente.SaldoTotal || cliente.Saldo || saldoTotal.toFixed(2))
      .replace('{Estatus}', cliente.Estatus || 'N/A')
      .replace('{FechaInstalacion}', cliente.FechaInstalacion || 'N/A')
      .replace('{FechaVencimiento}', cliente.FechaVencimiento || 'N/A')
      .replace('{Vendedor}', cliente.Vendedor || myName)
      .replace('{Video}', videoLink);
    
    let ph = String(cliente.Telefono || '').replace(/\D/g,'');
    // Si el teléfono no empieza con 52, agregarlo
    if (ph && !ph.startsWith('52') && ph.length === 10) {
      ph = '52' + ph;
    }
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault(); if (!chatInput.trim()) return;
    const userMsg = chatInput; setChatHistory(prev => [...prev, {role: 'user', text: userMsg}]); setChatInput(''); setChatLoading(true);
    const packagesContext = packages.map(p => `- ${p.name}: $${p.price}`).join('\n');
    const response = await callGemini(`Experto Izzi. Paquetes:\n${packagesContext}\nUsuario: ${userMsg}`);
    setChatHistory(prev => [...prev, {role: 'ai', text: response}]); setChatLoading(false);
  };

  // Obtener saldo para mostrar
  const getSaldo = (c) => {
    if (c.SaldoTotal) return c.SaldoTotal;
    if (c.Saldo) return c.Saldo;
    if (c.Monto) return c.Monto;
    return calcularSaldoTotal(c).toFixed(2);
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

       {/* Panel de Configuración Mejorado */}
       {showConfig && (
         <div className="bg-white p-4 rounded-xl shadow-lg mb-4 border-t-4 border-blue-500">
           <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Settings size={16}/> Configuración de Plantilla</h3>
           
           {usingGlobalTemplate && (
             <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-3 text-xs text-yellow-800">
               ℹ️ Estás usando la plantilla global. Puedes personalizarla aquí.
             </div>
           )}
           
           <div className="mb-3">
             <label className="text-xs font-bold text-slate-600 mb-1 block flex items-center gap-1"><Youtube size={14} className="text-red-500"/> Link del Video de Pago</label>
             <input 
               value={videoLink} 
               onChange={e=>setVideoLink(e.target.value)} 
               className="w-full p-2 border rounded text-xs"
               placeholder="https://youtu.be/tu-video"
             />
           </div>
           
           <div className="mb-3">
             <label className="text-xs font-bold text-slate-600 mb-1 block">Plantilla de WhatsApp (Personalizada)</label>
             <textarea 
               value={salesTemplate} 
               onChange={e=>{
                 setSalesTemplate(e.target.value);
                 setUsingGlobalTemplate(false);
               }} 
               className="w-full p-2 border rounded text-xs h-40 font-mono"
             />
             <p className="text-[10px] text-slate-400 mt-1">
               Variables: {'{Cliente}'}, {'{Cuenta}'}, {'{Plaza}'}, {'{SaldoTotal}'}, {'{SaldoPorVencer}'}, {'{SaldoVencido}'}, {'{Estatus}'}, {'{FechaInstalacion}'}, {'{FechaVencimiento}'}, {'{Video}'}
             </p>
           </div>
           
           <div className="flex gap-2">
             <button onClick={() => {
               saveConfig();
               setUsingGlobalTemplate(false);
             }} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-bold">Guardar Personalizada</button>
             <button onClick={async () => {
               const global = await getGlobalTemplate();
               if (global) {
                 setSalesTemplate(global);
                 setUsingGlobalTemplate(true);
                 const templateDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'global_settings', 'cobranza_template'));
                 if (templateDoc.exists()) {
                   setVideoLink(templateDoc.data().videoLink || '');
                 }
                 alert('Plantilla global restaurada');
               }
             }} className="flex-1 bg-yellow-500 text-white py-2 rounded-lg text-xs font-bold">Usar Global</button>
             <button onClick={()=>setShowConfig(false)} className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg text-xs font-bold">Cerrar</button>
           </div>
         </div>
       )}

       {/* Modal Chat */}
       {chatOpen && (
           <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
               <div className="bg-white w-full max-w-md h-[80vh] sm:h-[600px] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                   <div className="bg-violet-600 p-4 flex justify-between items-center text-white"><h3 className="font-bold flex gap-2"><Sparkles size={18}/> Asistente Izzi</h3><button onClick={()=>setChatOpen(false)}><X size={20}/></button></div>
                   <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-3">{chatHistory.map((msg, i) => (<div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] p-3 rounded-xl text-sm ${msg.role === 'user' ? 'bg-violet-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'}`}>{msg.text}</div></div>))} {chatLoading && <div className="text-xs text-slate-400 text-center">Escribiendo...</div>}</div>
                   <form onSubmit={handleChatSubmit} className="p-3 bg-white border-t flex gap-2"><input autoFocus className="flex-1 bg-slate-100 border-0 rounded-full px-4 py-2 text-sm outline-none" placeholder="Pregunta..." value={chatInput} onChange={e=>setChatInput(e.target.value)}/><button type="submit" className="bg-violet-600 text-white p-2 rounded-full"><Send size={18}/></button></form>
               </div>
           </div>
       )}

       {/* Modal Reportar Venta */}
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

       {/* Buscador */}
       <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="🔍 Buscar cliente, cuenta, teléfono..." className="w-full p-3 rounded-xl border border-slate-200 mb-4 shadow-sm"/>
       
       {/* Contador */}
       <p className="text-xs text-slate-500 mb-3">Mostrando {data.filter(i => JSON.stringify(i).toLowerCase().includes(searchTerm.toLowerCase())).length} de {data.length} clientes asignados</p>

       {/* Lista de Clientes */}
       {loading ? (
         <div className="text-center opacity-50 mt-10">Cargando...</div>
       ) : (
         <div className="grid gap-3 md:grid-cols-2">
           {data.filter(i => JSON.stringify(i).toLowerCase().includes(searchTerm.toLowerCase())).map((c, i) => (
             <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
               {/* Encabezado */}
               <div className="flex justify-between mb-2">
                 <h3 className="font-bold text-slate-800 text-sm">{c.Cliente || 'Sin nombre'}</h3>
                 <span className="font-mono font-bold text-green-600 text-lg">${getSaldo(c)}</span>
               </div>
               
               {/* Información */}
               <div className="grid grid-cols-2 gap-1 mb-3 text-xs text-slate-500">
                 {c.Cuenta && <div className="flex items-center gap-1"><Hash size={12}/> {c.Cuenta}</div>}
                 {c.Plaza && <div className="flex items-center gap-1"><Building size={12}/> {c.Plaza}</div>}
                 {c.Region && <div className="flex items-center gap-1 text-blue-600 font-bold"><MapPin size={12}/> {c.Region}</div>}
                 {c.FechaVencimiento && <div className="flex items-center gap-1 text-red-500"><Calendar size={12}/> Vence: {c.FechaVencimiento}</div>}
                 {c.Telefono && <div className="flex items-center gap-1"><Phone size={12}/> {c.Telefono}</div>}
               </div>

               {/* Saldos desglosados */}
               {(c.SaldoPorVencer || c.SaldoVencido) && (
                 <div className="flex gap-2 mb-3 text-[10px] flex-wrap">
                   {c.SaldoPorVencer && <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded">Por vencer: ${c.SaldoPorVencer}</span>}
                   {c.SaldoVencido && <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded">Vencido: ${c.SaldoVencido}</span>}
                 </div>
               )}

               {/* Estatus */}
               <div className="flex gap-2 mb-3">
                 <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                   c.Estatus === 'M1' ? 'bg-amber-100 text-amber-700' : 
                   c.Estatus === 'M2' ? 'bg-orange-100 text-orange-700' :
                   c.Estatus === 'M3' ? 'bg-red-100 text-red-700' :
                   'bg-slate-100 text-slate-500'
                 }`}>{c.Estatus || 'Sin estatus'}</span>
               </div>
               
               {/* Botones */}
               <div className="grid grid-cols-2 gap-2">
                 <button 
                   onClick={()=>sendTemplate(c)} 
                   className="bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                 >
                   <MessageSquare size={16}/> WhatsApp
                 </button>
                 <a 
                   href={`tel:${c.Telefono}`} 
                   className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border border-slate-200 transition-colors"
                 >
                   <Phone size={16}/> Llamar
                 </a>
               </div>
             </div>
           ))}
         </div>
       )}

       {/* Mensaje si no hay datos */}
       {!loading && data.length === 0 && (
         <div className="text-center py-10 text-slate-400">
           <Users size={48} className="mx-auto mb-4 opacity-50"/>
           <p>No tienes clientes asignados.</p>
           <p className="text-xs mt-2">El administrador debe cargar la base de datos y asignarte clientes.</p>
         </div>
       )}
    </div>
  );
}
