import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, DollarSign, Receipt, Wallet, Car, Settings, Plus, Trash2, ClipboardList, Edit2, Check, Download, Upload, X, ArrowUpDown, ChevronUp, ChevronDown, PieChart, BarChart3, Printer, Zap, ArrowRightLeft, ShieldCheck, Target, Package, AlertTriangle, Image as ImageIcon, Map as MapIcon, Loader2
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- FIREBASE SETUP ---
const isPreviewEnv = typeof __firebase_config !== 'undefined';
const firebaseConfig = isPreviewEnv ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyAXtaglk0mUuQyknLmyGuT6yoB8a0KYH7g",
  authDomain: "apex-performance-ledger.firebaseapp.com",
  projectId: "apex-performance-ledger",
  storageBucket: "apex-performance-ledger.firebasestorage.app",
  messagingSenderId: "833698468013",
  appId: "1:833698468013:web:a2665043c9a345afd0f624",
  measurementId: "G-0NR5S32JGE"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const getColRef = (colName) => isPreviewEnv ? collection(db, 'artifacts', appId, 'public', 'data', colName) : collection(db, colName);
const getDocRef = (colName, docId) => isPreviewEnv ? doc(db, 'artifacts', appId, 'public', 'data', colName, docId) : doc(db, colName, docId);

// --- HELPERS ---
const exportToCsv = (filename, rows) => {
  const escapeCsv = (val) => '"' + String(val || '').replace(/"/g, '""') + '"';
  const csvContent = rows.map(row => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

const parseCSV = (text) => {
  const rows = []; let currentRow = []; let currentCell = ''; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') { currentCell += '"'; i++; } 
        else { inQuotes = false; }
      } else { currentCell += char; }
    } else {
      if (char === '"') { inQuotes = true; } 
      else if (char === ',') { currentRow.push(currentCell); currentCell = ''; } 
      else if (char === '\n' || char === '\r') {
        currentRow.push(currentCell); rows.push(currentRow); currentRow = []; currentCell = '';
        if (char === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
      } else { currentCell += char; }
    }
  }
  if (currentCell || text[text.length - 1] === ',') currentRow.push(currentCell);
  if (currentRow.length > 0) rows.push(currentRow);
  return rows;
};

const useSortableData = (items, defaultKey = 'date') => {
  const [sortConfig, setSortConfig] = useState({ key: defaultKey, direction: 'descending' });
  const sortedItems = useMemo(() => {
    let sortableItems = [...items];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aVal = a[sortConfig.key]; let bVal = b[sortConfig.key];
        if (aVal === undefined || aVal === null || aVal === '') aVal = '';
        if (bVal === undefined || bVal === null || bVal === '') bVal = '';
        if (!isNaN(aVal) && !isNaN(bVal) && aVal !== '' && bVal !== '') { aVal = Number(aVal); bVal = Number(bVal); } 
        else if (sortConfig.key === 'date') { aVal = new Date(aVal).getTime() || 0; bVal = new Date(bVal).getTime() || 0; } 
        else { aVal = String(aVal).toLowerCase(); bVal = String(bVal).toLowerCase(); }
        if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);
  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') { direction = 'descending'; }
    setSortConfig({ key, direction });
  };
  return { items: sortedItems, requestSort, sortConfig };
};

const SortableHeader = ({ label, sortKey, currentSort, requestSort, alignRight, textColor }) => {
  const isActive = currentSort?.key === sortKey;
  return (
    <th className={`p-4 font-medium cursor-pointer hover:bg-slate-100 transition-colors group select-none ${textColor || 'text-slate-500'}`} onClick={() => requestSort(sortKey)}>
      <div className={`flex items-center space-x-1 ${alignRight ? 'justify-end' : ''}`}>
        <span>{label}</span>
        <span className={`${isActive ? 'text-blue-500' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`}>
          {isActive ? (currentSort.direction === 'ascending' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ArrowUpDown size={14} />}
        </span>
      </div>
    </th>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [quickAction, setQuickAction] = useState(null);

  // --- STATE MANAGEMENT ---
  const [revenues, setRevenues] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [equities, setEquities] = useState([]);
  const [mileages, setMileages] = useState([]);
  const [restocks, setRestocks] = useState([]);
  
  const [appSettings, setAppSettings] = useState({ initialInvestment: 1219.00 });
  const [cogs, setCogs] = useState({
    blackSpoolCost: 20.00, blackGramsUsed: 533, 
    whiteSpoolCost: 20.00, whiteGramsUsed: 11,
    concreteCost: 0.15, lbsUsed: 5, 
    boxCost: 1.25, bubbleWrapCost: 0.30,
    screwsCost: 0.10, insertsCost: 0.15, washersCost: 0.05
  });

  // --- FIREBASE AUTHENTICATION ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) { console.error("Auth error:", error); }
    };
    initAuth();
    const unsubscribe = auth.onAuthStateChanged(setUser);
    return () => unsubscribe();
  }, []);

  // --- REALTIME DATA FETCHING ---
  useEffect(() => {
    if (!user) return;
    
    const unsubRevs = onSnapshot(getColRef('revenues'), (snap) => setRevenues(snap.docs.map(d => ({ id: d.id, ...d.data() }))), console.error);
    const unsubExps = onSnapshot(getColRef('expenses'), (snap) => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))), console.error);
    const unsubEqs = onSnapshot(getColRef('equities'), (snap) => setEquities(snap.docs.map(d => ({ id: d.id, ...d.data() }))), console.error);
    const unsubMiles = onSnapshot(getColRef('mileages'), (snap) => setMileages(snap.docs.map(d => ({ id: d.id, ...d.data() }))), console.error);
    const unsubRestocks = onSnapshot(getColRef('restocks'), (snap) => setRestocks(snap.docs.map(d => ({ id: d.id, ...d.data() }))), console.error);
    
    const unsubCogs = onSnapshot(getDocRef('settings', 'cogs'), (docSnap) => { 
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCogs(prev => ({ 
          ...prev, ...data,
          // Legacy mapping just in case old cogs variables exist
          blackSpoolCost: data.blackSpoolCost ?? data.spoolCost ?? 20.00,
          blackGramsUsed: data.blackGramsUsed ?? (data.gramsUsed === 250 ? 533 : data.gramsUsed) ?? 533,
          whiteSpoolCost: data.whiteSpoolCost ?? 20.00,
          whiteGramsUsed: data.whiteGramsUsed ?? 11,
        }));
      } 
    }, console.error);
    const unsubSettings = onSnapshot(getDocRef('settings', 'app'), (docSnap) => { if (docSnap.exists()) setAppSettings(docSnap.data()); }, console.error);

    return () => { unsubRevs(); unsubExps(); unsubEqs(); unsubMiles(); unsubRestocks(); unsubCogs(); unsubSettings(); };
  }, [user]);

  // --- MUTATION HANDLERS ---
  const handleAdd = async (collectionName, data) => {
    if (!user) return;
    await setDoc(getDocRef(collectionName, Date.now().toString() + Math.random().toString(36).substr(2, 5)), data);
  };

  const handleUpdateRecord = async (collectionName, id, updatedData) => {
    if (!user) return;
    const cleanData = { ...updatedData };
    delete cleanData.id; delete cleanData.net; delete cleanData.trueProfit; 
    delete cleanData.margin; delete cleanData.deduction;
    await updateDoc(getDocRef(collectionName, id.toString()), cleanData);
  };
  
  const handleDelete = async (collectionName, id) => {
    if (!user) return;
    await deleteDoc(getDocRef(collectionName, id.toString()));
  };

  const handleUpdateCogs = async (newCogs) => {
    if (!user) return;
    setCogs(newCogs);
    await setDoc(getDocRef('settings', 'cogs'), newCogs);
  };

  const handleUpdateSettings = async (newSettings) => {
    if (!user) return;
    setAppSettings(newSettings);
    await setDoc(getDocRef('settings', 'app'), newSettings);
  };

  const uploadReceipt = async (file) => {
    if (!file || !user) return null;
    try {
      const storageRef = ref(storage, `receipts/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    } catch (err) {
      console.error("Storage upload failed.", err);
      alert("Upload failed. Make sure Storage is enabled in Test Mode in Firebase.");
      return null;
    }
  };

  // --- CALCULATIONS & PREDICTIVE SUPPLY CHAIN ---
  const blackPetgCostPerGram = (cogs.blackSpoolCost || 20) / 1000;
  const whitePetgCostPerGram = (cogs.whiteSpoolCost || 20) / 1000;
  
  const costPerTrainer = 
    (blackPetgCostPerGram * (cogs.blackGramsUsed || 533)) + 
    (whitePetgCostPerGram * (cogs.whiteGramsUsed || 11)) + 
    ((cogs.concreteCost || 0.15) * (cogs.lbsUsed || 5)) + 
    Number(cogs.boxCost || 0) + 
    Number(cogs.bubbleWrapCost || 0) + 
    Number(cogs.screwsCost || 0) + 
    Number(cogs.insertsCost || 0) + 
    Number(cogs.washersCost || 0);

  // Revenue & Profit Math
  const totalUnitsSold = useMemo(() => revenues.reduce((sum, r) => sum + Number(r.qty || 1), 0), [revenues]);
  const totalGrossRevenue = useMemo(() => revenues.reduce((sum, r) => sum + Number(r.gross || 0), 0), [revenues]);
  const totalPlatformFees = useMemo(() => revenues.reduce((sum, r) => sum + Number(r.ebay || 0) + Number(r.ad || 0) + Number(r.shipping || 0), 0), [revenues]);
  
  const totalOperatingExpenses = useMemo(() => expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0), [expenses]);
  const totalMiles = useMemo(() => mileages.reduce((sum, m) => sum + Number(m.miles || 0), 0), [mileages]);
  const taxShield = totalOperatingExpenses + (totalMiles * 0.725);
  const netProfit = totalGrossRevenue - totalPlatformFees - totalOperatingExpenses;
  const taxReserve = netProfit > 0 ? netProfit * 0.25 : 0;
  
  const totalTrueProfit = useMemo(() => {
    return revenues.reduce((sum, r) => {
      const net = Number(r.gross) - Number(r.ebay || 0) - Number(r.ad || 0) - Number(r.shipping || 0);
      return sum + (net - (costPerTrainer * Number(r.qty || 1)));
    }, 0);
  }, [revenues, costPerTrainer]);
  const avgProfitPerUnit = totalUnitsSold > 0 ? totalTrueProfit / totalUnitsSold : 0;

  // Draws & Bank Math
  const drawsRecoup = useMemo(() => equities.filter(e => e.category === 'Recoup Investment' || !e.category).reduce((sum, e) => sum + Number(e.amount || 0), 0), [equities]);
  const drawsGolf = useMemo(() => equities.filter(e => e.category === 'Golf Fund').reduce((sum, e) => sum + Number(e.amount || 0), 0), [equities]);
  const drawsOther = useMemo(() => equities.filter(e => e.category === 'Other Draw').reduce((sum, e) => sum + Number(e.amount || 0), 0), [equities]);
  const amexTransfers = useMemo(() => equities.filter(e => e.category === 'Amex Transfer (Op Cash)').reduce((sum, e) => sum + Number(e.amount || 0), 0), [equities]);

  const AMEX_START_DATE = '2026-04-29';
  const amexOperatingExpenses = useMemo(() => expenses.filter(e => e.date >= AMEX_START_DATE).reduce((sum, e) => sum + Number(e.amount || 0), 0), [expenses]);
  const estimatedCashBalance = amexTransfers - amexOperatingExpenses;

  const initialGoal = Number(appSettings.initialInvestment || 0);
  const remainingToRecoup = Math.max(0, initialGoal - drawsRecoup);
  const safeCash = netProfit - taxReserve;
  const isGolfUnlocked = safeCash >= initialGoal;
  const availableGolfFund = isGolfUnlocked ? Math.max(0, safeCash - initialGoal - drawsGolf - drawsOther) : 0;

  // --- WAREHOUSE & PREDICTIVE ENGINE ---
  const fourteenDaysAgoStr = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  }, []);
  
  const recentSales = useMemo(() => revenues.filter(r => r.date >= fourteenDaysAgoStr), [revenues, fourteenDaysAgoStr]);
  const recentUnitsSold = useMemo(() => recentSales.reduce((sum, r) => sum + Number(r.qty || 1), 0), [recentSales]);
  const dailySalesVelocity = recentUnitsSold / 14;

  const restockTotals = useMemo(() => {
    return restocks.reduce((acc, r) => { acc[r.material] = (acc[r.material] || 0) + Number(r.qty || 0); return acc; }, {});
  }, [restocks]);

  const currentStock = useMemo(() => ({
    // Note: Legacy "PETG (grams)" gets automatically added into Black PETG to save their old data
    blackPetg: ((restockTotals['Black PETG (grams)'] || 0) + (restockTotals['PETG (grams)'] || 0)) - (totalUnitsSold * (cogs.blackGramsUsed || 533)),
    whitePetg: (restockTotals['White PETG (grams)'] || 0) - (totalUnitsSold * (cogs.whiteGramsUsed || 11)),
    concrete: (restockTotals['Concrete (lbs)'] || 0) - (totalUnitsSold * (cogs.lbsUsed || 5)),
    boxes: (restockTotals['Boxes (qty)'] || 0) - totalUnitsSold,
    wrap: (restockTotals['Bubble Wrap (qty)'] || 0) - totalUnitsSold,
    screws: (restockTotals['Screws (sets)'] || 0) - totalUnitsSold,
    inserts: (restockTotals['Inserts (sets)'] || 0) - totalUnitsSold,
    washers: (restockTotals['Washers (sets)'] || 0) - totalUnitsSold,
  }), [restockTotals, totalUnitsSold, cogs]);

  const buildableUnits = useMemo(() => Math.floor(Math.min(
    cogs.blackGramsUsed > 0 ? Math.max(0, currentStock.blackPetg / cogs.blackGramsUsed) : Infinity,
    cogs.whiteGramsUsed > 0 ? Math.max(0, currentStock.whitePetg / cogs.whiteGramsUsed) : Infinity,
    cogs.lbsUsed > 0 ? Math.max(0, currentStock.concrete / cogs.lbsUsed) : Infinity,
    Math.max(0, currentStock.boxes), Math.max(0, currentStock.wrap), Math.max(0, currentStock.screws), Math.max(0, currentStock.inserts), Math.max(0, currentStock.washers)
  )), [currentStock, cogs]);

  // Predict exact runout days per material
  const runoutDays = useMemo(() => ({
    blackPetg: dailySalesVelocity > 0 ? Math.max(0, Math.floor((currentStock.blackPetg / (cogs.blackGramsUsed || 1)) / dailySalesVelocity)) : Infinity,
    whitePetg: dailySalesVelocity > 0 ? Math.max(0, Math.floor((currentStock.whitePetg / (cogs.whiteGramsUsed || 1)) / dailySalesVelocity)) : Infinity,
    concrete: dailySalesVelocity > 0 ? Math.max(0, Math.floor((currentStock.concrete / (cogs.lbsUsed || 1)) / dailySalesVelocity)) : Infinity,
    boxes: dailySalesVelocity > 0 ? Math.max(0, Math.floor(currentStock.boxes / dailySalesVelocity)) : Infinity,
    wrap: dailySalesVelocity > 0 ? Math.max(0, Math.floor(currentStock.wrap / dailySalesVelocity)) : Infinity,
    screws: dailySalesVelocity > 0 ? Math.max(0, Math.floor(currentStock.screws / dailySalesVelocity)) : Infinity,
    inserts: dailySalesVelocity > 0 ? Math.max(0, Math.floor(currentStock.inserts / dailySalesVelocity)) : Infinity,
    washers: dailySalesVelocity > 0 ? Math.max(0, Math.floor(currentStock.washers / dailySalesVelocity)) : Infinity,
  }), [dailySalesVelocity, currentStock, cogs]);

  // Aggregate alerts for the Dashboard banner
  const lowStockAlerts = useMemo(() => {
    if (dailySalesVelocity === 0) return [];
    const alerts = [];
    if (runoutDays.blackPetg <= 7) alerts.push({ name: 'Black PETG', days: runoutDays.blackPetg });
    if (runoutDays.whitePetg <= 7) alerts.push({ name: 'White PETG', days: runoutDays.whitePetg });
    if (runoutDays.concrete <= 7) alerts.push({ name: 'Concrete', days: runoutDays.concrete });
    if (runoutDays.boxes <= 7) alerts.push({ name: 'Boxes', days: runoutDays.boxes });
    if (runoutDays.wrap <= 7) alerts.push({ name: 'Bubble Wrap', days: runoutDays.wrap });
    if (runoutDays.screws <= 7) alerts.push({ name: 'Screws', days: runoutDays.screws });
    if (runoutDays.inserts <= 7) alerts.push({ name: 'Inserts', days: runoutDays.inserts });
    if (runoutDays.washers <= 7) alerts.push({ name: 'Washers', days: runoutDays.washers });
    return alerts;
  }, [runoutDays, dailySalesVelocity]);

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  
  const TabButton = ({ id, icon: Icon, label }) => (
    <button onClick={() => setActiveTab(id)} className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors w-full sm:w-auto ${activeTab === id ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
      <Icon size={18} /><span>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans print-bg-white">
      
      {/* QUICK ACTION MODALS */}
      {quickAction === 'revenue' && <QuickRevenueModal onClose={() => setQuickAction(null)} onAdd={(d) => { handleAdd('revenues', d); setQuickAction(null); }} />}
      {quickAction === 'expense' && <QuickExpenseModal uploadReceipt={uploadReceipt} onClose={() => setQuickAction(null)} onAdd={(d) => { handleAdd('expenses', d); setQuickAction(null); }} />}
      {quickAction === 'equity' && <QuickEquityModal onClose={() => setQuickAction(null)} onAdd={(d) => { handleAdd('equities', d); setQuickAction(null); }} />}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Apex Performance Concepts LLC</h1>
              <p className="text-sm text-slate-500">Automated Business Ledger</p>
            </div>
          </div>
          <div className="flex overflow-x-auto hide-scrollbar border-t border-slate-100">
            <TabButton id="dashboard" icon={LayoutDashboard} label="Dashboard" />
            <TabButton id="analytics" icon={MapIcon} label="Analytics & Maps" />
            <TabButton id="revenue" icon={DollarSign} label="Revenue Log" />
            <TabButton id="warehouse" icon={Package} label="Warehouse" />
            <TabButton id="expenses" icon={Receipt} label="Expense Vault" />
            <TabButton id="equity" icon={Wallet} label="Payouts" />
            <TabButton id="mileage" icon={Car} label="Mileage Log" />
            <TabButton id="cogs" icon={Settings} label="Mfg. Settings" />
            <TabButton id="tax" icon={ClipboardList} label="Tax Summary" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print-no-padding">
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* SUPPLY CHAIN ALERT BANNER */}
            {lowStockAlerts.length > 0 && (
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-2 rounded-r-xl shadow-sm flex items-start animate-in slide-in-from-top-2">
                <AlertTriangle className="text-amber-500 mr-3 mt-0.5 flex-shrink-0" size={20} />
                <div>
                  <h3 className="text-amber-800 font-bold text-sm">Supply Chain Alert</h3>
                  <p className="text-amber-700 text-sm mt-1">Based on your recent sales velocity ({dailySalesVelocity.toFixed(1)} units/day), you will run out of:</p>
                  <ul className="text-amber-700 text-sm mt-1 list-disc list-inside font-medium">
                    {lowStockAlerts.map((alert, i) => (
                      <li key={i}>{alert.name} <span className="font-normal opacity-80">(in {alert.days} days)</span></li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Command Center</h2>
              <div className="flex space-x-3">
                <button onClick={() => setQuickAction('revenue')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-colors shadow-sm"><Plus size={16} className="mr-1.5"/> Log Sale</button>
                <button onClick={() => setQuickAction('expense')} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-colors shadow-sm"><Receipt size={16} className="mr-1.5"/> Expense</button>
                <button onClick={() => setQuickAction('equity')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-colors shadow-sm"><ArrowRightLeft size={16} className="mr-1.5"/> Transfer</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <DashboardCard title="Total Revenue (Gross)" amount={totalGrossRevenue} subtitle="Total sales before fees" color="blue" />
              <DashboardCard title="Total Platform Fees" amount={totalPlatformFees} subtitle="eBay, Ads, & Shipping" color="red" isNegative />
              <DashboardCard title="Operating Expenses" amount={totalOperatingExpenses} subtitle="Printers, tools, gear" color="orange" isNegative />
              <div className="col-span-1 md:col-span-2 lg:col-span-3 border-t border-slate-200 my-2"></div>
              <DashboardCard title="Net Profit" amount={netProfit} subtitle="The actual 'Apex' earnings" color={netProfit >= 0 ? "emerald" : "red"} highlight />
              <DashboardCard title="Tax Reserve (25%)" amount={taxReserve} subtitle="Set aside for IRS & Iowa" color="indigo" />
              <DashboardCard title="Amex Checking Balance" amount={estimatedCashBalance} subtitle="Transfers in minus expenses out (since Apr 29)" color="blue" highlight />
              
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-center">
                <h3 className="text-sm font-medium text-slate-500 flex items-center"><Target size={16} className="mr-1.5"/> Mfg. Efficiency</h3>
                <div className="text-3xl font-bold mt-2 text-emerald-600">{formatCurrency(avgProfitPerUnit)}</div>
                <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-wider">Avg True Profit Per Unit</p>
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-sm">
                  <span className="text-slate-500">Total Units Sold:</span>
                  <span className="font-bold text-slate-700">{totalUnitsSold}</span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-center">
                <h3 className="text-sm font-medium text-slate-500 flex items-center"><ShieldCheck size={16} className="mr-1.5"/> The Tax Shield</h3>
                <div className="text-3xl font-bold mt-2 text-blue-600">{formatCurrency(taxShield)}</div>
                <p className="text-xs text-slate-400 mt-2 leading-tight">Total cash value of legal deductions (Expenses + Mileage)</p>
              </div>

              <div className={`rounded-xl border p-6 shadow-sm flex flex-col items-center justify-center text-center transition-colors ${drawsGolf > 0 || isGolfUnlocked ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">My Golf Fund</h3>
                <div className={`text-4xl font-extrabold ${drawsGolf > 0 || isGolfUnlocked ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {formatCurrency(drawsGolf)}
                  <span className="block text-xs text-slate-500 font-normal mt-1 tracking-normal normal-case">Total Accounted For / Withdrawn</span>
                </div>
                <div className="w-full mt-4 border-t border-slate-200/50 pt-3">
                {!isGolfUnlocked ? (
                  <p className="text-sm text-slate-500">Generate <span className="font-medium text-slate-600">{formatCurrency(Math.max(0, initialGoal - safeCash))}</span> more safe profit to unlock</p>
                ) : (
                  <div className="flex justify-between items-center w-full text-sm">
                    <span className="text-slate-600">Available to Withdraw:</span>
                    <span className="font-medium text-emerald-700">{formatCurrency(availableGolfFund)}</span>
                  </div>
                )}
                </div>
              </div>

              <div className="col-span-1 md:col-span-2 lg:col-span-3">
                <ProgressCard drawsRecoup={drawsRecoup} initialGoal={initialGoal} remainingToRecoup={remainingToRecoup} formatCurrency={formatCurrency} onUpdateGoal={(newGoal) => handleUpdateSettings({ ...appSettings, initialInvestment: newGoal })} />
              </div>

            </div>
          </div>
        )}

        {activeTab === 'analytics' && <Analytics revenues={revenues} expenses={expenses} formatCurrency={formatCurrency} />}
        {activeTab === 'warehouse' && <Warehouse restocks={restocks} currentStock={currentStock} buildableUnits={buildableUnits} runoutDays={runoutDays} dailySalesVelocity={dailySalesVelocity} onAdd={(data) => handleAdd('restocks', data)} onDelete={(id) => handleDelete('restocks', id)} />}
        {activeTab === 'revenue' && <RevenueLog revenues={revenues} costPerTrainer={costPerTrainer} onAdd={(data) => handleAdd('revenues', data)} onUpdate={(id, data) => handleUpdateRecord('revenues', id, data)} onDelete={(id) => handleDelete('revenues', id)} formatCurrency={formatCurrency} />}
        {activeTab === 'expenses' && <ExpenseTracker uploadReceipt={uploadReceipt} expenses={expenses} onAdd={(data) => handleAdd('expenses', data)} onUpdate={(id, data) => handleUpdateRecord('expenses', id, data)} onDelete={(id) => handleDelete('expenses', id)} formatCurrency={formatCurrency} />}
        {activeTab === 'equity' && <OwnerEquity equities={equities} initialGoal={initialGoal} onAdd={(data) => handleAdd('equities', data)} onUpdate={(id, data) => handleUpdateRecord('equities', id, data)} onDelete={(id) => handleDelete('equities', id)} formatCurrency={formatCurrency} />}
        {activeTab === 'mileage' && <MileageLog mileages={mileages} onAdd={(data) => handleAdd('mileages', data)} onUpdate={(id, data) => handleUpdateRecord('mileages', id, data)} onDelete={(id) => handleDelete('mileages', id)} formatCurrency={formatCurrency} />}
        {activeTab === 'cogs' && <Manufacturing cogs={cogs} onUpdate={handleUpdateCogs} costPerTrainer={costPerTrainer} blackPetgCostPerGram={blackPetgCostPerGram} whitePetgCostPerGram={whitePetgCostPerGram} formatCurrency={formatCurrency} />}
        {activeTab === 'tax' && <TaxSummary revenues={revenues} expenses={expenses} mileages={mileages} formatCurrency={formatCurrency} />}
      </main>
    </div>
  );
}

// --- SUB-COMPONENTS & MODALS ---
const inlineInputStyle = "w-full border border-slate-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500 bg-white";
const modalInputStyle = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors";

function QuickRevenueModal({ onClose, onAdd }) {
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], orderNum: '', desc: '', qty: 1, gross: '', ebay: '', ad: '', shipping: '', state: '' });
  const handleSubmit = (e) => { e.preventDefault(); if(formData.gross) onAdd(formData); };
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center"><DollarSign size={20} className="mr-2 text-blue-600"/> Quick Log Sale</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-slate-500 mb-1">Date</label><input type="date" className={modalInputStyle} value={formData.date} onChange={e=>setFormData({...formData, date:e.target.value})} required/></div>
            <div><label className="block text-xs font-semibold text-slate-500 mb-1">Buyer State (e.g. AZ)</label><input type="text" maxLength="2" className={modalInputStyle} placeholder="Optional" value={formData.state} onChange={e=>setFormData({...formData, state:e.target.value.toUpperCase()})}/></div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3"><label className="block text-xs font-semibold text-slate-500 mb-1">Item Description</label><input type="text" className={modalInputStyle} value={formData.desc} onChange={e=>setFormData({...formData, desc:e.target.value})} required/></div>
            <div className="col-span-1"><label className="block text-xs font-semibold text-slate-500 mb-1">Qty</label><input type="number" min="1" className={modalInputStyle} value={formData.qty} onChange={e=>setFormData({...formData, qty:e.target.value})} required/></div>
          </div>
          <div><label className="block text-xs font-semibold text-slate-500 mb-1">Gross Sale ($)</label><input type="number" step="0.01" className={modalInputStyle} value={formData.gross} onChange={e=>setFormData({...formData, gross:e.target.value})} required/></div>
          <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div><label className="block text-xs font-semibold text-slate-500 mb-1">eBay Fee</label><input type="number" step="0.01" className={modalInputStyle} value={formData.ebay} onChange={e=>setFormData({...formData, ebay:e.target.value})}/></div>
            <div><label className="block text-xs font-semibold text-slate-500 mb-1">Ad Fee</label><input type="number" step="0.01" className={modalInputStyle} value={formData.ad} onChange={e=>setFormData({...formData, ad:e.target.value})}/></div>
            <div><label className="block text-xs font-semibold text-slate-500 mb-1">Label Cost</label><input type="number" step="0.01" className={modalInputStyle} value={formData.shipping} onChange={e=>setFormData({...formData, shipping:e.target.value})}/></div>
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl mt-2 transition-colors">Save Sale</button>
        </form>
      </div>
    </div>
  );
}

function QuickExpenseModal({ onClose, onAdd, uploadReceipt }) {
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], desc: '', category: 'Supplies', amount: '' });
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const categories = ['Supplies', 'Advertising', 'Travel', 'Equipment', 'Office'];
  
  const handleSubmit = async (e) => { 
    e.preventDefault(); 
    if(!formData.amount) return; 
    setIsUploading(true);
    let receiptUrl = '';
    if (file) { receiptUrl = await uploadReceipt(file) || ''; }
    onAdd({ ...formData, receiptUrl });
    setIsUploading(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center"><Receipt size={20} className="mr-2 text-orange-500"/> Quick Log Expense</h2>
          <button onClick={onClose} disabled={isUploading} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div><label className="block text-xs font-semibold text-slate-500 mb-1">Date</label><input type="date" className={modalInputStyle} value={formData.date} onChange={e=>setFormData({...formData, date:e.target.value})} required/></div>
          <div><label className="block text-xs font-semibold text-slate-500 mb-1">Description</label><input type="text" className={modalInputStyle} value={formData.desc} onChange={e=>setFormData({...formData, desc:e.target.value})} required/></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-slate-500 mb-1">Category</label><select className={modalInputStyle} value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})}>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="block text-xs font-semibold text-slate-500 mb-1">Amount ($)</label><input type="number" step="0.01" className={modalInputStyle} value={formData.amount} onChange={e=>setFormData({...formData, amount:e.target.value})} required/></div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Attach Receipt (Optional)</label>
            <input type="file" accept="image/*,application/pdf" onChange={e=>setFile(e.target.files[0])} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 transition-colors" />
          </div>
          <button type="submit" disabled={isUploading} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-xl mt-2 transition-colors flex justify-center items-center">
            {isUploading ? <><Loader2 size={18} className="animate-spin mr-2"/> Uploading Vault...</> : "Save Expense"}
          </button>
        </form>
      </div>
    </div>
  );
}

function QuickEquityModal({ onClose, onAdd }) {
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], desc: '', category: 'Amex Transfer (Op Cash)', amount: '' });
  const categories = ['Recoup Investment', 'Golf Fund', 'Amex Transfer (Op Cash)', 'Other Draw'];
  const handleSubmit = (e) => { e.preventDefault(); if(formData.amount) onAdd(formData); };
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center"><ArrowRightLeft size={20} className="mr-2 text-indigo-600"/> Quick Transfer</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div><label className="block text-xs font-semibold text-slate-500 mb-1">Date</label><input type="date" className={modalInputStyle} value={formData.date} onChange={e=>setFormData({...formData, date:e.target.value})} required/></div>
          <div><label className="block text-xs font-semibold text-slate-500 mb-1">Description</label><input type="text" className={modalInputStyle} value={formData.desc} onChange={e=>setFormData({...formData, desc:e.target.value})} required/></div>
          <div><label className="block text-xs font-semibold text-slate-500 mb-1">Category</label><select className={modalInputStyle} value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})}>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="block text-xs font-semibold text-slate-500 mb-1">Amount ($)</label><input type="number" step="0.01" className={modalInputStyle} value={formData.amount} onChange={e=>setFormData({...formData, amount:e.target.value})} required/></div>
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl mt-2 transition-colors">Log Transfer</button>
        </form>
      </div>
    </div>
  );
}

// --- US TILE MAP DATA ---
const tileMapData = [
  { code: 'AK', c: 0, r: 0 }, { code: 'ME', c: 11, r: 0 },
  { code: 'WA', c: 1, r: 1 }, { code: 'ID', c: 2, r: 1 }, { code: 'MT', c: 3, r: 1 }, { code: 'ND', c: 4, r: 1 }, { code: 'MN', c: 5, r: 1 }, { code: 'WI', c: 6, r: 1 }, { code: 'MI', c: 7, r: 1 }, { code: 'NY', c: 9, r: 1 }, { code: 'VT', c: 10, r: 1 }, { code: 'NH', c: 11, r: 1 },
  { code: 'OR', c: 1, r: 2 }, { code: 'NV', c: 2, r: 2 }, { code: 'WY', c: 3, r: 2 }, { code: 'SD', c: 4, r: 2 }, { code: 'IA', c: 5, r: 2 }, { code: 'IL', c: 6, r: 2 }, { code: 'IN', c: 7, r: 2 }, { code: 'OH', c: 8, r: 2 }, { code: 'PA', c: 9, r: 2 }, { code: 'NJ', c: 10, r: 2 }, { code: 'MA', c: 11, r: 2 },
  { code: 'CA', c: 1, r: 3 }, { code: 'UT', c: 2, r: 3 }, { code: 'CO', c: 3, r: 3 }, { code: 'NE', c: 4, r: 3 }, { code: 'MO', c: 5, r: 3 }, { code: 'KY', c: 6, r: 3 }, { code: 'WV', c: 7, r: 3 }, { code: 'VA', c: 8, r: 3 }, { code: 'MD', c: 9, r: 3 }, { code: 'CT', c: 10, r: 3 }, { code: 'RI', c: 11, r: 3 },
  { code: 'AZ', c: 2, r: 4 }, { code: 'NM', c: 3, r: 4 }, { code: 'KS', c: 4, r: 4 }, { code: 'AR', c: 5, r: 4 }, { code: 'TN', c: 6, r: 4 }, { code: 'NC', c: 7, r: 4 }, { code: 'SC', c: 8, r: 4 }, { code: 'DE', c: 9, r: 4 }, { code: 'DC', c: 10, r: 4 },
  { code: 'OK', c: 4, r: 5 }, { code: 'LA', c: 5, r: 5 }, { code: 'MS', c: 6, r: 5 }, { code: 'AL', c: 7, r: 5 }, { code: 'GA', c: 8, r: 5 },
  { code: 'HI', c: 0, r: 6 }, { code: 'TX', c: 4, r: 6 }, { code: 'FL', c: 8, r: 6 }
];

function Analytics({ revenues, expenses, formatCurrency }) {
  const monthlyData = useMemo(() => {
    const dataMap = {};
    revenues.forEach(r => {
      if (!r.date) return;
      const month = r.date.substring(0, 7);
      if (!dataMap[month]) dataMap[month] = { month, rev: 0, exp: 0 };
      dataMap[month].rev += Number(r.gross || 0);
    });
    expenses.forEach(e => {
      if (!e.date) return;
      const month = e.date.substring(0, 7);
      if (!dataMap[month]) dataMap[month] = { month, rev: 0, exp: 0 };
      dataMap[month].exp += Number(e.amount || 0);
    });
    return Object.values(dataMap).sort((a, b) => a.month.localeCompare(b.month));
  }, [revenues, expenses]);

  const maxBarValue = Math.max(10, ...monthlyData.map(d => Math.max(d.rev, d.exp)));

  const categoryData = useMemo(() => {
    const totals = {}; let grandTotal = 0;
    expenses.forEach(e => {
      const amt = Number(e.amount || 0);
      totals[e.category] = (totals[e.category] || 0) + amt;
      grandTotal += amt;
    });
    const colors = { 'Supplies': '#3b82f6', 'Advertising': '#f59e0b', 'Travel': '#10b981', 'Equipment': '#8b5cf6', 'Office': '#ef4444' };
    let currentOffset = 0;
    return Object.keys(totals).map(cat => {
      const pct = grandTotal > 0 ? (totals[cat] / grandTotal) * 100 : 0;
      const offset = currentOffset; currentOffset += pct;
      return { category: cat, amount: totals[cat], pct, offset, color: colors[cat] || '#94a3b8' };
    }).sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const { stateData, maxStateRevenue } = useMemo(() => {
    const stateRevenues = {};
    let maxRev = 0;
    revenues.forEach(r => {
      if (r.state && r.state.length === 2) {
        const gross = Number(r.gross || 0);
        stateRevenues[r.state] = (stateRevenues[r.state] || 0) + gross;
        if (stateRevenues[r.state] > maxRev) maxRev = stateRevenues[r.state];
      }
    });
    return { stateData: stateRevenues, maxStateRevenue: maxRev };
  }, [revenues]);

  const topStates = useMemo(() => {
    return Object.keys(stateData)
      .map(code => ({ code, rev: stateData[code] }))
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 5);
  }, [stateData]);

  const grid = useMemo(() => {
    const arr = Array(7).fill(null).map(() => Array(12).fill(null));
    tileMapData.forEach(t => arr[t.r][t.c] = t.code);
    return arr;
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-slate-700 flex items-center"><MapIcon size={18} className="mr-2 text-slate-400"/> Customer Geospatial Tile Map</h3>
          <div className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1 rounded-full">Hover tiles to view volume</div>
        </div>
        
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-center">
            <div className="grid gap-1 sm:gap-1.5 w-full max-w-2xl" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
              {grid.flat().map((cell, i) => {
                if (!cell) return <div key={i} className="aspect-square" />;
                const rev = stateData[cell] || 0;
                const intensity = maxStateRevenue > 0 ? rev / maxStateRevenue : 0;
                const bgColor = rev > 0 ? `rgba(37, 99, 235, ${Math.max(0.15, intensity)})` : '#ffffff';
                const textColor = intensity > 0.4 ? '#ffffff' : '#475569';
                const borderColor = rev > 0 ? 'border-transparent' : 'border-slate-200';
                
                return (
                  <div 
                    key={i}
                    className={`aspect-square border ${borderColor} rounded md:rounded-md flex items-center justify-center text-[10px] sm:text-xs font-bold cursor-pointer hover:ring-2 hover:ring-blue-400 hover:scale-110 hover:z-10 transition-all shadow-sm relative group`}
                    style={{ backgroundColor: bgColor, color: textColor }}
                  >
                    {cell}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-slate-900 text-white p-2 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                      <div className="font-bold text-xs">{cell}</div>
                      <div className="text-emerald-400 font-bold">{formatCurrency(rev)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="w-full lg:w-64 flex flex-col space-y-4">
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2">Top Markets</h4>
            {topStates.length === 0 ? (
              <div className="text-sm text-slate-400">No states logged yet. Use Quick Action to log a sale!</div>
            ) : (
              topStates.map((state, idx) => (
                <div key={state.code} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-slate-400 font-bold text-sm">#{idx + 1}</span>
                    <span className="font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-sm">{state.code}</span>
                  </div>
                  <span className="font-bold text-emerald-600 text-sm">{formatCurrency(state.rev)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-slate-700 flex items-center"><BarChart3 size={18} className="mr-2 text-slate-400"/> Cash Flow by Month</h3>
            <div className="flex items-center space-x-4 text-xs">
              <div className="flex items-center"><span className="w-3 h-3 rounded-sm bg-blue-500 mr-1.5"></span> Revenue</div>
              <div className="flex items-center"><span className="w-3 h-3 rounded-sm bg-orange-400 mr-1.5"></span> Expenses</div>
            </div>
          </div>
          <div className="flex-1 min-h-[250px] flex items-end space-x-2 sm:space-x-6 pb-6 border-b border-slate-100 overflow-x-auto hide-scrollbar pt-6">
            {monthlyData.length === 0 ? <div className="w-full text-center text-slate-400 text-sm pb-10">No data to display yet.</div> : (
              monthlyData.map((data) => {
                const [year, month] = data.month.split('-');
                const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'short' });
                const revHeight = Math.max(2, (data.rev / maxBarValue) * 100);
                const expHeight = Math.max(2, (data.exp / maxBarValue) * 100);
                return (
                  <div key={data.month} className="flex flex-col items-center flex-1 min-w-[50px] group">
                    <div className="flex items-end justify-center space-x-1 w-full h-48 relative">
                      <div className="w-1/2 bg-blue-500 rounded-t-sm transition-all duration-500 relative" style={{ height: `${revHeight}%` }}>
                        <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">Rev: {formatCurrency(data.rev)}</div>
                      </div>
                      <div className="w-1/2 bg-orange-400 rounded-t-sm transition-all duration-500 relative" style={{ height: `${expHeight}%` }}>
                        <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">Exp: {formatCurrency(data.exp)}</div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs font-medium text-slate-500">{monthName} '{year.slice(2)}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col">
          <h3 className="font-semibold text-slate-700 flex items-center mb-6"><PieChart size={18} className="mr-2 text-slate-400"/> Operating Expenses Breakdown</h3>
          {categoryData.length === 0 ? <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">No expenses logged yet.</div> : (
            <div className="flex flex-col sm:flex-row items-center justify-center flex-1 gap-8">
              <div className="relative w-48 h-48">
                <svg viewBox="0 0 32 32" className="w-full h-full transform -rotate-90 rounded-full">
                  {categoryData.map((slice) => <circle key={slice.category} r="12" cx="16" cy="16" fill="transparent" stroke={slice.color} strokeWidth="8" strokeDasharray={`${slice.pct > 0 ? slice.pct : 0} 100`} strokeDashoffset={`-${slice.offset}`} className="transition-all duration-1000 ease-out" />)}
                  <circle r="8" cx="16" cy="16" fill="white" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs text-slate-400 uppercase tracking-widest font-bold">Total</span>
                  <span className="text-lg font-bold text-slate-700">{formatCurrency(categoryData.reduce((s, c) => s + c.amount, 0))}</span>
                </div>
              </div>
              <div className="flex flex-col space-y-3 w-full sm:w-auto">
                {categoryData.map(slice => (
                  <div key={slice.category} className="flex items-center justify-between space-x-4">
                    <div className="flex items-center"><span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: slice.color }}></span><span className="text-sm text-slate-600">{slice.category}</span></div>
                    <div className="flex items-center space-x-2"><span className="text-sm font-medium text-slate-800">{formatCurrency(slice.amount)}</span><span className="text-xs text-slate-400 w-8 text-right">{Math.round(slice.pct)}%</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Warehouse({ restocks, currentStock, buildableUnits, runoutDays, dailySalesVelocity, onAdd, onDelete }) {
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], material: 'Black PETG (grams)', qty: '' });
  const materials = ['Black PETG (grams)', 'White PETG (grams)', 'Concrete (lbs)', 'Boxes (qty)', 'Bubble Wrap (qty)', 'Screws (sets)', 'Inserts (sets)', 'Washers (sets)'];
  const { items: sortedRestocks, requestSort, sortConfig } = useSortableData(restocks);

  const addRow = (e) => { e.preventDefault(); if (!formData.qty) return; onAdd(formData); setFormData({ ...formData, qty: '' }); };

  const StockCard = ({ title, amount, unit, isWarning, daysRemaining, velocity }) => (
    <div className={`rounded-xl border p-4 shadow-sm flex flex-col justify-center transition-colors ${isWarning ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
        {title} {isWarning && <AlertTriangle size={14} className="text-red-500" />}
      </h3>
      <div className={`text-2xl font-bold mt-2 ${isWarning ? 'text-red-600' : 'text-slate-800'}`}>{Number(amount).toLocaleString()} <span className="text-sm font-normal text-slate-500">{unit}</span></div>
      {velocity > 0 && (
        <div className={`text-xs mt-1.5 font-medium ${daysRemaining <= 7 ? 'text-red-500' : 'text-slate-400'}`}>
          {daysRemaining > 0 && daysRemaining !== Infinity ? `Runs out in ~${daysRemaining} days` : (daysRemaining === 0 ? 'Out of stock' : 'Adequate supply')}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className={`bg-slate-800 rounded-xl border border-slate-700 p-8 shadow-md text-white flex flex-col sm:flex-row sm:items-center justify-between relative overflow-hidden ${buildableUnits < 10 ? 'bg-red-900 border-red-700' : ''}`}>
        <div className="absolute top-0 right-0 p-8 opacity-10"><Package size={160} /></div>
        <div className="z-10">
          <h2 className="text-lg font-medium text-slate-300">Current Production Capacity</h2>
          <p className="text-sm text-slate-400 mt-1">Based on lowest raw material in stock</p>
        </div>
        <div className="z-10 mt-4 sm:mt-0 text-left sm:text-right">
          <div className="text-6xl font-extrabold">{buildableUnits}</div>
          <div className="text-sm font-bold uppercase tracking-widest text-emerald-400 mt-1">Trainers Buildable</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StockCard title="Black PETG" amount={currentStock.blackPetg} unit="grams" isWarning={runoutDays.blackPetg <= 7} daysRemaining={runoutDays.blackPetg} velocity={dailySalesVelocity} />
        <StockCard title="White PETG" amount={currentStock.whitePetg} unit="grams" isWarning={runoutDays.whitePetg <= 7} daysRemaining={runoutDays.whitePetg} velocity={dailySalesVelocity} />
        <StockCard title="Concrete" amount={currentStock.concrete} unit="lbs" isWarning={runoutDays.concrete <= 7} daysRemaining={runoutDays.concrete} velocity={dailySalesVelocity} />
        <StockCard title="Boxes" amount={currentStock.boxes} unit="qty" isWarning={runoutDays.boxes <= 7} daysRemaining={runoutDays.boxes} velocity={dailySalesVelocity} />
        <StockCard title="Bubble Wrap" amount={currentStock.wrap} unit="qty" isWarning={runoutDays.wrap <= 7} daysRemaining={runoutDays.wrap} velocity={dailySalesVelocity} />
        <StockCard title="Screws" amount={currentStock.screws} unit="sets" isWarning={runoutDays.screws <= 7} daysRemaining={runoutDays.screws} velocity={dailySalesVelocity} />
        <StockCard title="Inserts" amount={currentStock.inserts} unit="sets" isWarning={runoutDays.inserts <= 7} daysRemaining={runoutDays.inserts} velocity={dailySalesVelocity} />
        <StockCard title="Washers" amount={currentStock.washers} unit="sets" isWarning={runoutDays.washers <= 7} daysRemaining={runoutDays.washers} velocity={dailySalesVelocity} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-slate-800">Log Material Restock</h2>
        <form onSubmit={addRow} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <input type="date" className="input-field" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
          <select className="input-field sm:col-span-2" value={formData.material} onChange={e => setFormData({...formData, material: e.target.value})}>{materials.map(m => <option key={m} value={m}>{m}</option>)}</select>
          <input type="number" placeholder="Quantity Added" className="input-field" value={formData.qty} onChange={e => setFormData({...formData, qty: e.target.value})} required />
          <button type="submit" className="sm:col-span-4 bg-slate-800 hover:bg-slate-900 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center transition-colors"><Plus size={18} className="mr-2" /> Add to Warehouse</button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center"><h3 className="font-semibold text-slate-700">Restock History</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white border-b border-slate-200 text-slate-500">
              <tr>
                <SortableHeader label="Date" sortKey="date" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Material" sortKey="material" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Quantity Added" sortKey="qty" currentSort={sortConfig} requestSort={requestSort} alignRight />
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedRestocks.length === 0 ? <tr><td colSpan="4" className="p-4 text-center text-slate-400">No restocks logged yet. Try adding your starting inventory above!</td></tr> : sortedRestocks.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">{r.date}</td><td className="p-4 font-medium text-slate-700">{r.material}</td><td className="p-4 text-right text-emerald-600 font-bold">+{Number(r.qty).toLocaleString()}</td>
                    <td className="p-4 text-right"><button onClick={() => onDelete(r.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProgressCard({ drawsRecoup, initialGoal, remainingToRecoup, formatCurrency, onUpdateGoal }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempGoal, setTempGoal] = useState(initialGoal);
  const handleSave = () => { onUpdateGoal(Number(tempGoal)); setIsEditing(false); };
  const percentComplete = initialGoal > 0 ? Math.min(100, (drawsRecoup / initialGoal) * 100) : 100;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col items-center text-center relative group">
      <div className="absolute top-4 right-4">
        {!isEditing && <button onClick={() => setIsEditing(true)} className="text-slate-300 hover:text-blue-500 transition-colors p-1" title="Edit Initial Goal"><Edit2 size={16} /></button>}
      </div>
      <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">Remaining to Recoup</h3>
      <div className="text-3xl font-bold text-slate-800 mb-1">{formatCurrency(remainingToRecoup)}</div>
      <div className="w-full bg-slate-200 rounded-full h-2.5 mt-4"><div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${percentComplete}%` }}></div></div>
      {isEditing ? (
        <div className="flex items-center space-x-2 mt-3">
          <span className="text-sm text-slate-500">Goal: $</span>
          <input type="number" className="border border-slate-300 rounded px-2 py-1 w-24 text-sm outline-none focus:border-blue-500" value={tempGoal} onChange={(e) => setTempGoal(e.target.value)} />
          <button onClick={handleSave} className="bg-blue-100 text-blue-600 p-1.5 rounded hover:bg-blue-200"><Check size={14} /></button>
        </div>
      ) : <p className="text-xs text-slate-500 mt-3">Progress to {formatCurrency(initialGoal)} initial investment</p>}
    </div>
  );
}

function DashboardCard({ title, amount, subtitle, color, isNegative, highlight }) {
  const colorMap = { blue: 'text-blue-600', red: 'text-red-600', emerald: 'text-emerald-600', orange: 'text-orange-600', indigo: 'text-indigo-600' };
  return (
    <div className={`bg-white rounded-xl border p-6 shadow-sm ${highlight ? 'ring-2 ring-emerald-500/20 shadow-md' : 'border-slate-200'}`}>
      <h3 className="text-sm font-medium text-slate-500">{title}</h3>
      <div className={`text-3xl font-bold mt-2 ${colorMap[color]}`}>{isNegative && amount > 0 ? '-' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)}</div>
      <p className="text-xs text-slate-400 mt-2">{subtitle}</p>
    </div>
  );
}

function RevenueLog({ revenues, costPerTrainer, onAdd, onUpdate, onDelete, formatCurrency }) {
  const [formData, setFormData] = useState({ date: '', orderNum: '', desc: '', qty: 1, gross: '', ebay: '', ad: '', shipping: '', state: '' });
  const [importPreview, setImportPreview] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const fileInputRef = useRef(null);

  const enrichedRevenues = useMemo(() => revenues.map(r => {
    const net = Number(r.gross) - Number(r.ebay || 0) - Number(r.ad || 0) - Number(r.shipping || 0);
    const qty = Number(r.qty || 1);
    const trueProfit = net - (costPerTrainer * qty);
    const margin = Number(r.gross) > 0 ? (trueProfit / Number(r.gross)) * 100 : 0;
    return { ...r, qty, net, trueProfit, margin };
  }), [revenues, costPerTrainer]);

  const { items: sortedRevenues, requestSort, sortConfig } = useSortableData(enrichedRevenues);

  const addRow = (e) => { e.preventDefault(); if (!formData.gross) return; onAdd(formData); setFormData({ date: '', orderNum: '', desc: '', qty: 1, gross: '', ebay: '', ad: '', shipping: '', state: '' }); };
  
  const startEdit = (item) => { setEditingId(item.id); setEditForm({ ...item }); };
  const saveEdit = () => { onUpdate(editingId, editForm); setEditingId(null); };

  const handleExport = () => {
    const headers = ['Date', 'Order #', 'State', 'Description', 'Qty', 'Gross', 'eBay Fee', 'Ad Fee', 'Shipping', 'Net Payout', 'True Profit', 'Margin %'];
    const data = sortedRevenues.map(r => [r.date, r.orderNum, r.state, r.desc, r.qty, r.gross, r.ebay || 0, r.ad || 0, r.shipping || 0, r.net, r.trueProfit, r.margin.toFixed(1)]);
    exportToCsv('Apex_Revenues.csv', [headers, ...data]);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const parsed = parseCSV(text);
      let headerIdx = 0;
      while(headerIdx < parsed.length && (!parsed[headerIdx] || !parsed[headerIdx].includes('Order Number'))) headerIdx++;
      if (headerIdx >= parsed.length) { alert("Could not find standard eBay headers in this CSV."); return; }

      const headers = parsed[headerIdx];
      const dateIdx = headers.indexOf('Sale Date'); const orderIdx = headers.indexOf('Order Number');
      const titleIdx = headers.indexOf('Item Title'); const soldForIdx = headers.indexOf('Sold For');
      const shipHandIdx = headers.indexOf('Shipping And Handling'); const qtyIdx = headers.indexOf('Quantity');
      const stateIdx = headers.indexOf('Ship To State');
      
      const newRows = [];
      const months = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
      
      for (let i = headerIdx + 1; i < parsed.length; i++) {
        const row = parsed[i];
        if (row.length < headers.length || !row[orderIdx]) continue;
        const rawDate = row[dateIdx] || '';
        const dateParts = rawDate.split('-');
        let formattedDate = rawDate;
        if (dateParts.length === 3) formattedDate = `20${dateParts[2]}-${months[dateParts[0]] || '01'}-${dateParts[1].padStart(2, '0')}`;
        const cleanNum = (str) => Number((str || '').replace(/[^0-9.-]+/g,""));
        const gross = cleanNum(row[soldForIdx]) + cleanNum(row[shipHandIdx]);
        const qty = qtyIdx > -1 ? (cleanNum(row[qtyIdx]) || 1) : 1;
        const state = stateIdx > -1 ? (row[stateIdx] || '').toUpperCase().trim() : '';

        newRows.push({ id: Date.now() + i, date: formattedDate, orderNum: row[orderIdx], desc: row[titleIdx], state, qty, gross: gross.toFixed(2), ebay: '', ad: '', shipping: '' });
      }
      setImportPreview(newRows);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmImport = () => { importPreview.forEach(r => { onAdd({ date: r.date, orderNum: r.orderNum, state: r.state, desc: r.desc, qty: r.qty, gross: r.gross, ebay: r.ebay, ad: r.ad, shipping: r.shipping }); }); setImportPreview(null); };

  return (
    <div className="space-y-6 animate-in fade-in">
      {importPreview && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div><h2 className="text-xl font-bold text-slate-800">Review & Add Fees</h2></div>
              <button onClick={() => setImportPreview(null)} className="text-slate-400 hover:text-red-500"><X size={24}/></button>
            </div>
            <div className="overflow-y-auto p-6 bg-slate-100 flex-1">
              <table className="w-full text-left text-sm whitespace-nowrap bg-white rounded shadow-sm">
                <thead className="bg-slate-800 text-slate-100 sticky top-0 z-10">
                  <tr><th className="p-3">Date</th><th className="p-3">Order #</th><th className="p-3 w-1/4">Item</th><th className="p-3 text-center">Qty</th><th className="p-3 text-right">Gross Sale</th><th className="p-3">eBay Fee $</th><th className="p-3">Ad Fee $</th><th className="p-3">Shipping Label $</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {importPreview.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="p-3">{r.date}</td><td className="p-3 font-mono text-xs text-slate-500">{r.orderNum}</td><td className="p-3 truncate max-w-xs" title={r.desc}>{r.desc}</td><td className="p-3 text-center font-bold text-slate-700">{r.qty}</td><td className="p-3 text-right font-medium">{formatCurrency(r.gross)}</td>
                      <td className="p-2"><input type="number" step="0.01" className="w-24 border border-slate-300 rounded p-1.5 outline-none focus:border-blue-500" value={r.ebay} onChange={e => setImportPreview(prev => prev.map(pr => pr.id === r.id ? { ...pr, ebay: e.target.value } : pr))}/></td>
                      <td className="p-2"><input type="number" step="0.01" className="w-24 border border-slate-300 rounded p-1.5 outline-none focus:border-blue-500" value={r.ad} onChange={e => setImportPreview(prev => prev.map(pr => pr.id === r.id ? { ...pr, ad: e.target.value } : pr))}/></td>
                      <td className="p-2"><input type="number" step="0.01" className="w-24 border border-slate-300 rounded p-1.5 outline-none focus:border-blue-500" value={r.shipping} onChange={e => setImportPreview(prev => prev.map(pr => pr.id === r.id ? { ...pr, shipping: e.target.value } : pr))}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-200 bg-white flex justify-end space-x-3">
              <button onClick={() => setImportPreview(null)} className="px-4 py-2 rounded text-slate-600 hover:bg-slate-100 font-medium transition-colors">Cancel</button>
              <button onClick={confirmImport} className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center transition-colors"><Check size={18} className="mr-2"/> Save {importPreview.length} Orders</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-slate-800">Add Single Sale</h2>
        <form onSubmit={addRow} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-8 gap-4">
          <input type="date" className="input-field col-span-1" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
          <input type="text" placeholder="Order #" className="input-field col-span-1" value={formData.orderNum} onChange={e => setFormData({...formData, orderNum: e.target.value})} />
          <input type="text" maxLength="2" placeholder="State (AZ)" className="input-field col-span-1" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value.toUpperCase()})} />
          <input type="text" placeholder="Description" className="input-field col-span-1 sm:col-span-1" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} required />
          <input type="number" step="0.01" placeholder="Gross ($)" className="input-field" value={formData.gross} onChange={e => setFormData({...formData, gross: e.target.value})} required />
          <input type="number" step="0.01" placeholder="eBay Fee ($)" className="input-field" value={formData.ebay} onChange={e => setFormData({...formData, ebay: e.target.value})} />
          <input type="number" step="0.01" placeholder="Ad Fee ($)" className="input-field" value={formData.ad} onChange={e => setFormData({...formData, ad: e.target.value})} />
          <input type="number" step="0.01" placeholder="Shipping ($)" className="input-field" value={formData.shipping} onChange={e => setFormData({...formData, shipping: e.target.value})} />
          <button type="submit" className="md:col-span-8 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center transition-colors"><Plus size={18} className="mr-2" /> Add Sale</button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <h3 className="font-semibold text-slate-700">Sales History (COGS per unit: {formatCurrency(costPerTrainer)})</h3>
          <div className="flex space-x-4">
            <input type="file" accept=".csv" id="csv-upload" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            <button onClick={() => fileInputRef.current.click()} className="text-sm font-medium text-slate-600 hover:text-slate-800 flex items-center transition-colors border border-slate-300 px-3 py-1.5 rounded-md bg-white shadow-sm"><Upload size={16} className="mr-1.5" /> Import eBay CSV</button>
            <button onClick={handleExport} className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center transition-colors border border-blue-200 px-3 py-1.5 rounded-md bg-blue-50 shadow-sm"><Download size={16} className="mr-1.5" /> Export CSV</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white border-b border-slate-200 text-slate-500">
              <tr>
                <SortableHeader label="Date" sortKey="date" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Order #" sortKey="orderNum" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="State" sortKey="state" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Description" sortKey="desc" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Qty" sortKey="qty" currentSort={sortConfig} requestSort={requestSort} alignRight />
                <SortableHeader label="Gross" sortKey="gross" currentSort={sortConfig} requestSort={requestSort} alignRight />
                <SortableHeader label="Fees & Ship" sortKey="ebay" currentSort={sortConfig} requestSort={requestSort} alignRight textColor="text-red-500" />
                <SortableHeader label="Net Payout" sortKey="net" currentSort={sortConfig} requestSort={requestSort} alignRight textColor="text-blue-600" />
                <SortableHeader label="True Profit" sortKey="trueProfit" currentSort={sortConfig} requestSort={requestSort} alignRight textColor="text-emerald-600" />
                <SortableHeader label="Margin" sortKey="margin" currentSort={sortConfig} requestSort={requestSort} alignRight textColor="text-emerald-600" />
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedRevenues.length === 0 ? <tr><td colSpan="11" className="p-4 text-center text-slate-400">No records found.</td></tr> : sortedRevenues.map(r => {
                const totalFees = Number(r.ebay || 0) + Number(r.ad || 0) + Number(r.shipping || 0);
                return editingId === r.id ? (
                  <tr key={r.id} className="bg-blue-50/50">
                    <td className="p-2"><input type="date" className={inlineInputStyle} value={editForm.date} onChange={ev => setEditForm({...editForm, date: ev.target.value})} /></td>
                    <td className="p-2"><input type="text" className={`${inlineInputStyle} w-20`} value={editForm.orderNum} onChange={ev => setEditForm({...editForm, orderNum: ev.target.value})} /></td>
                    <td className="p-2"><input type="text" maxLength="2" className={`${inlineInputStyle} w-12`} value={editForm.state} onChange={ev => setEditForm({...editForm, state: ev.target.value.toUpperCase()})} /></td>
                    <td className="p-2"><input type="text" className={inlineInputStyle} value={editForm.desc} onChange={ev => setEditForm({...editForm, desc: ev.target.value})} /></td>
                    <td className="p-2"><input type="number" min="1" className={`${inlineInputStyle} w-16 text-center`} value={editForm.qty} onChange={ev => setEditForm({...editForm, qty: ev.target.value})} /></td>
                    <td className="p-2"><input type="number" step="0.01" className={inlineInputStyle} value={editForm.gross} onChange={ev => setEditForm({...editForm, gross: ev.target.value})} /></td>
                    <td className="p-2 flex space-x-1">
                      <input type="number" step="0.01" className={`${inlineInputStyle} w-16`} placeholder="eBay" title="eBay Fee" value={editForm.ebay} onChange={ev => setEditForm({...editForm, ebay: ev.target.value})} />
                      <input type="number" step="0.01" className={`${inlineInputStyle} w-16`} placeholder="Ad" title="Ad Fee" value={editForm.ad} onChange={ev => setEditForm({...editForm, ad: ev.target.value})} />
                      <input type="number" step="0.01" className={`${inlineInputStyle} w-16`} placeholder="Ship" title="Shipping" value={editForm.shipping} onChange={ev => setEditForm({...editForm, shipping: ev.target.value})} />
                    </td>
                    <td className="p-4 text-right text-slate-400">-</td>
                    <td className="p-4 text-right text-slate-400">-</td>
                    <td className="p-4 text-right text-slate-400">-</td>
                    <td className="p-2 text-right space-x-3">
                      <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-700"><Check size={18}/></button>
                      <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">{r.date}</td>
                    <td className="p-4 text-slate-500 font-mono text-xs">{r.orderNum || '-'}</td>
                    <td className="p-4 font-bold text-slate-600">{r.state || '-'}</td>
                    <td className="p-4 truncate max-w-[200px]" title={r.desc}>{r.desc}</td>
                    <td className="p-4 text-center font-bold text-slate-700">{r.qty}</td>
                    <td className="p-4 text-right font-medium">{formatCurrency(r.gross)}</td>
                    <td className="p-4 text-right text-slate-500" title={`eBay: ${formatCurrency(r.ebay || 0)} | Ad: ${formatCurrency(r.ad || 0)} | Ship: ${formatCurrency(r.shipping || 0)}`}>{formatCurrency(totalFees)}</td>
                    <td className="p-4 text-right font-medium text-blue-600">{formatCurrency(r.net)}</td>
                    <td className="p-4 text-right font-bold text-emerald-600">{formatCurrency(r.trueProfit)}</td>
                    <td className="p-4 text-right font-bold text-emerald-600">{r.margin.toFixed(1)}%</td>
                    <td className="p-4 text-right space-x-3">
                      <button onClick={() => startEdit(r)} className="text-slate-400 hover:text-blue-600"><Edit2 size={16} /></button>
                      <button onClick={() => onDelete(r.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ExpenseTracker({ expenses, onAdd, onUpdate, onDelete, formatCurrency, uploadReceipt }) {
  const [formData, setFormData] = useState({ date: '', desc: '', category: 'Supplies', amount: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const categories = ['Supplies', 'Advertising', 'Travel', 'Equipment', 'Office'];
  const { items: sortedExpenses, requestSort, sortConfig } = useSortableData(expenses);

  const addRow = async (e) => { 
    e.preventDefault(); 
    if (!formData.amount) return; 
    setIsUploading(true);
    let receiptUrl = '';
    if (file) { receiptUrl = await uploadReceipt(file) || ''; }
    onAdd({ ...formData, receiptUrl }); 
    setFormData({ date: '', desc: '', category: 'Supplies', amount: '' }); 
    setFile(null);
    setIsUploading(false);
  };
  
  const startEdit = (item) => { setEditingId(item.id); setEditForm({ ...item, category: item.category || 'Supplies' }); };
  const saveEdit = () => { onUpdate(editingId, editForm); setEditingId(null); };

  const handleExport = () => {
    const headers = ['Date', 'Description', 'Category', 'Amount', 'Receipt Link'];
    const data = sortedExpenses.map(e => [e.date, e.desc, e.category, e.amount, e.receiptUrl || '']);
    exportToCsv('Apex_Expenses.csv', [headers, ...data]);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-slate-800">Log Expense to Vault</h2>
        <form onSubmit={addRow} className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          <input type="date" className="input-field col-span-1" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
          <input type="text" placeholder="Description" className="input-field col-span-1" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} required />
          <select className="input-field col-span-1" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
          <input type="number" step="0.01" placeholder="Amount ($)" className="input-field col-span-1" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required />
          <input type="file" accept="image/*,application/pdf" onChange={e => setFile(e.target.files[0])} className="col-span-1 text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          <button type="submit" disabled={isUploading} className="sm:col-span-5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center transition-colors">
             {isUploading ? <><Loader2 size={18} className="animate-spin mr-2"/> Uploading to Vault...</> : <><Plus size={18} className="mr-2" /> Add Expense & Save Receipt</>}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-700">Audit-Proof Expense History</h3>
          <button onClick={handleExport} className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center transition-colors border border-blue-200 px-3 py-1.5 rounded-md bg-blue-50 shadow-sm"><Download size={16} className="mr-1.5" /> Export CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white border-b border-slate-200 text-slate-500">
              <tr>
                <SortableHeader label="Date" sortKey="date" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Description" sortKey="desc" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Category" sortKey="category" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Amount" sortKey="amount" currentSort={sortConfig} requestSort={requestSort} alignRight />
                <th className="p-4 font-medium text-center">Receipt</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedExpenses.length === 0 ? <tr><td colSpan="6" className="p-4 text-center text-slate-400">No records found.</td></tr> : sortedExpenses.map(e => (
                editingId === e.id ? (
                  <tr key={e.id} className="bg-blue-50/50">
                    <td className="p-2"><input type="date" className={inlineInputStyle} value={editForm.date} onChange={ev => setEditForm({...editForm, date: ev.target.value})} /></td>
                    <td className="p-2"><input type="text" className={inlineInputStyle} value={editForm.desc} onChange={ev => setEditForm({...editForm, desc: ev.target.value})} /></td>
                    <td className="p-2">
                      <select className={inlineInputStyle} value={editForm.category} onChange={ev => setEditForm({...editForm, category: ev.target.value})}>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="p-2"><input type="number" step="0.01" className={inlineInputStyle} value={editForm.amount} onChange={ev => setEditForm({...editForm, amount: ev.target.value})} /></td>
                    <td className="p-2 text-center text-slate-400">-</td>
                    <td className="p-2 text-right space-x-3">
                      <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-700"><Check size={18}/></button>
                      <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
                    </td>
                  </tr>
                ) : (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">{e.date}</td><td className="p-4">{e.desc}</td><td className="p-4"><span className="px-2 py-1 bg-slate-100 rounded text-xs">{e.category}</span></td>
                    <td className="p-4 text-right font-medium">{formatCurrency(e.amount)}</td>
                    <td className="p-4 text-center">
                      {e.receiptUrl ? (
                        <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors" title="View Receipt">
                          <ImageIcon size={16} />
                        </a>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="p-4 text-right space-x-3">
                      <button onClick={() => startEdit(e)} className="text-slate-400 hover:text-blue-600"><Edit2 size={16}/></button>
                      <button onClick={() => onDelete(e.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function OwnerEquity({ equities, initialGoal, onAdd, onUpdate, onDelete, formatCurrency }) {
  const [formData, setFormData] = useState({ date: '', desc: '', category: 'Recoup Investment', amount: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const categories = ['Recoup Investment', 'Golf Fund', 'Amex Transfer (Op Cash)', 'Other Draw'];
  const { items: sortedEquities, requestSort, sortConfig } = useSortableData(equities);

  const addRow = (e) => { e.preventDefault(); onAdd(formData); setFormData({ date: '', desc: '', category: 'Recoup Investment', amount: '' }); };
  const startEdit = (item) => { setEditingId(item.id); setEditForm({ ...item, category: item.category || 'Recoup Investment' }); };
  const saveEdit = () => { onUpdate(editingId, editForm); setEditingId(null); };

  const handleExport = () => {
    const headers = ['Date', 'Description', 'Category', 'Amount'];
    const data = sortedEquities.map(e => [e.date, e.desc, e.category || 'Recoup Investment', e.amount]);
    exportToCsv('Apex_Payouts_Transfers.csv', [headers, ...data]);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-slate-800">Record Payout or Transfer</h2>
        <form onSubmit={addRow} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <input type="date" className="input-field" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
          <input type="text" placeholder="Description (e.g. Owner Draw)" className="input-field" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} required />
          <select className="input-field" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" step="0.01" placeholder="Amount ($)" className="input-field" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required />
          <button type="submit" className="sm:col-span-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center transition-colors"><Plus size={18} className="mr-2" /> Log Transaction</button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-700">Transaction History</h3>
          <button onClick={handleExport} className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center transition-colors border border-blue-200 px-3 py-1.5 rounded-md bg-blue-50 shadow-sm"><Download size={16} className="mr-1.5" /> Export CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white border-b border-slate-200 text-slate-500">
              <tr>
                <SortableHeader label="Date" sortKey="date" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Description" sortKey="desc" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Category" sortKey="category" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Amount" sortKey="amount" currentSort={sortConfig} requestSort={requestSort} alignRight />
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedEquities.length === 0 ? <tr><td colSpan="5" className="p-4 text-center text-slate-400">No records found.</td></tr> : sortedEquities.map(e => (
                editingId === e.id ? (
                  <tr key={e.id} className="bg-blue-50/50">
                    <td className="p-2"><input type="date" className={inlineInputStyle} value={editForm.date} onChange={ev => setEditForm({...editForm, date: ev.target.value})} /></td>
                    <td className="p-2"><input type="text" className={inlineInputStyle} value={editForm.desc} onChange={ev => setEditForm({...editForm, desc: ev.target.value})} /></td>
                    <td className="p-2">
                      <select className={inlineInputStyle} value={editForm.category} onChange={ev => setEditForm({...editForm, category: ev.target.value})}>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="p-2"><input type="number" step="0.01" className={inlineInputStyle} value={editForm.amount} onChange={ev => setEditForm({...editForm, amount: ev.target.value})} /></td>
                    <td className="p-2 text-right space-x-3">
                      <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-700"><Check size={18}/></button>
                      <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
                    </td>
                  </tr>
                ) : (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">{e.date}</td>
                    <td className="p-4">{e.desc}</td>
                    <td className="p-4"><span className="px-2 py-1 bg-slate-100 rounded text-xs">{e.category || 'Recoup Investment'}</span></td>
                    <td className="p-4 text-right font-medium">{formatCurrency(e.amount)}</td>
                    <td className="p-4 text-right space-x-3">
                      <button onClick={() => startEdit(e)} className="text-slate-400 hover:text-blue-600"><Edit2 size={16}/></button>
                      <button onClick={() => onDelete(e.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MileageLog({ mileages, onAdd, onUpdate, onDelete, formatCurrency }) {
  const [formData, setFormData] = useState({ date: '', desc: '', miles: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const RATE_2026 = 0.725;
  
  const enrichedMileages = useMemo(() => mileages.map(m => ({ ...m, deduction: m.miles * RATE_2026 })), [mileages]);
  const { items: sortedMileages, requestSort, sortConfig } = useSortableData(enrichedMileages);

  const addRow = (e) => { e.preventDefault(); onAdd(formData); setFormData({ date: '', desc: '', miles: '' }); };
  const startEdit = (item) => { setEditingId(item.id); setEditForm({ ...item }); };
  const saveEdit = () => { onUpdate(editingId, editForm); setEditingId(null); };

  const handleExport = () => {
    const headers = ['Date', 'Trip Description', 'Miles', 'Deduction Value'];
    const data = sortedMileages.map(m => [m.date, m.desc, m.miles, m.deduction]);
    exportToCsv('Apex_Mileage_Log.csv', [headers, ...data]);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-2 text-slate-800">Track Business Miles</h2>
        <form onSubmit={addRow} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input type="date" className="input-field" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
          <input type="text" placeholder="Trip Description" className="input-field" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} required />
          <input type="number" step="0.1" placeholder="Total Miles" className="input-field" value={formData.miles} onChange={e => setFormData({...formData, miles: e.target.value})} required />
          <button type="submit" className="sm:col-span-3 bg-slate-800 hover:bg-slate-900 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center transition-colors"><Plus size={18} className="mr-2" /> Log Miles</button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-700">Trip History</h3>
          <button onClick={handleExport} className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center transition-colors border border-blue-200 px-3 py-1.5 rounded-md bg-blue-50 shadow-sm"><Download size={16} className="mr-1.5" /> Export CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white border-b border-slate-200 text-slate-500">
              <tr>
                <SortableHeader label="Date" sortKey="date" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Trip Description" sortKey="desc" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Miles" sortKey="miles" currentSort={sortConfig} requestSort={requestSort} alignRight />
                <SortableHeader label="Deduction Value" sortKey="deduction" currentSort={sortConfig} requestSort={requestSort} alignRight textColor="text-blue-600" />
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedMileages.length === 0 ? <tr><td colSpan="5" className="p-4 text-center text-slate-400">No records found.</td></tr> : sortedMileages.map(m => (
                editingId === m.id ? (
                  <tr key={m.id} className="bg-blue-50/50">
                    <td className="p-2"><input type="date" className={inlineInputStyle} value={editForm.date} onChange={ev => setEditForm({...editForm, date: ev.target.value})} /></td>
                    <td className="p-2"><input type="text" className={inlineInputStyle} value={editForm.desc} onChange={ev => setEditForm({...editForm, desc: ev.target.value})} /></td>
                    <td className="p-2"><input type="number" step="0.1" className={inlineInputStyle} value={editForm.miles} onChange={ev => setEditForm({...editForm, miles: ev.target.value})} /></td>
                    <td className="p-4 text-right text-slate-400">-</td>
                    <td className="p-2 text-right space-x-3">
                      <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-700"><Check size={18}/></button>
                      <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
                    </td>
                  </tr>
                ) : (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">{m.date}</td><td className="p-4">{m.desc}</td><td className="p-4 text-right font-medium">{m.miles} mi</td>
                    <td className="p-4 text-right font-bold text-blue-600">{formatCurrency(m.deduction)}</td>
                    <td className="p-4 text-right space-x-3">
                      <button onClick={() => startEdit(m)} className="text-slate-400 hover:text-blue-600"><Edit2 size={16}/></button>
                      <button onClick={() => onDelete(m.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Manufacturing({ cogs, onUpdate, costPerTrainer, blackPetgCostPerGram, whitePetgCostPerGram, formatCurrency }) {
  const handleChange = (e) => { onUpdate({ ...cogs, [e.target.name]: Number(e.target.value) }); };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-slate-800">COGS Variables</h2>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <h3 className="font-medium text-slate-700">Raw Materials</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs text-slate-500 mb-1">Black PETG Spool Cost</label><div className="relative"><span className="absolute left-3 top-2.5 text-slate-400">$</span><input type="number" step="0.01" name="blackSpoolCost" value={cogs.blackSpoolCost || ''} onChange={handleChange} className="input-field pl-8" /></div></div>
              <div><label className="block text-xs text-slate-500 mb-1">Black Grams Used</label><input type="number" name="blackGramsUsed" value={cogs.blackGramsUsed || ''} onChange={handleChange} className="input-field" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div><label className="block text-xs text-slate-500 mb-1">White PETG Spool Cost</label><div className="relative"><span className="absolute left-3 top-2.5 text-slate-400">$</span><input type="number" step="0.01" name="whiteSpoolCost" value={cogs.whiteSpoolCost || ''} onChange={handleChange} className="input-field pl-8" /></div></div>
              <div><label className="block text-xs text-slate-500 mb-1">White Grams Used</label><input type="number" name="whiteGramsUsed" value={cogs.whiteGramsUsed || ''} onChange={handleChange} className="input-field" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div><label className="block text-xs text-slate-500 mb-1">Concrete Cost per lb</label><div className="relative"><span className="absolute left-3 top-2.5 text-slate-400">$</span><input type="number" step="0.01" name="concreteCost" value={cogs.concreteCost} onChange={handleChange} className="input-field pl-8" /></div></div>
              <div><label className="block text-xs text-slate-500 mb-1">lbs Used</label><input type="number" step="0.1" name="lbsUsed" value={cogs.lbsUsed} onChange={handleChange} className="input-field" /></div>
            </div>
            <hr className="border-slate-100 my-4" />
            <h3 className="font-medium text-slate-700">Hardware (Cost Per Trainer)</h3>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-xs text-slate-500 mb-1">Screws</label><div className="relative"><span className="absolute left-3 top-2.5 text-slate-400">$</span><input type="number" step="0.01" name="screwsCost" value={cogs.screwsCost} onChange={handleChange} className="input-field pl-8" /></div></div>
              <div><label className="block text-xs text-slate-500 mb-1">Inserts</label><div className="relative"><span className="absolute left-3 top-2.5 text-slate-400">$</span><input type="number" step="0.01" name="insertsCost" value={cogs.insertsCost} onChange={handleChange} className="input-field pl-8" /></div></div>
              <div><label className="block text-xs text-slate-500 mb-1">Washers</label><div className="relative"><span className="absolute left-3 top-2.5 text-slate-400">$</span><input type="number" step="0.01" name="washersCost" value={cogs.washersCost} onChange={handleChange} className="input-field pl-8" /></div></div>
            </div>
            <hr className="border-slate-100 my-4" />
            <h3 className="font-medium text-slate-700">Packaging (Cost Per Trainer)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs text-slate-500 mb-1">Box / Mailer</label><div className="relative"><span className="absolute left-3 top-2.5 text-slate-400">$</span><input type="number" step="0.01" name="boxCost" value={cogs.boxCost} onChange={handleChange} className="input-field pl-8" /></div></div>
              <div><label className="block text-xs text-slate-500 mb-1">Bubble Wrap</label><div className="relative"><span className="absolute left-3 top-2.5 text-slate-400">$</span><input type="number" step="0.01" name="bubbleWrapCost" value={cogs.bubbleWrapCost} onChange={handleChange} className="input-field pl-8" /></div></div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-md text-white flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10"><Settings size={120} className="animate-[spin_20s_linear_infinite]" /></div>
          <h2 className="text-xl font-semibold mb-6 text-slate-200 z-10">Cost Per Unit Breakdown</h2>
          <div className="space-y-4 z-10">
            <div className="flex justify-between items-center border-b border-slate-700 pb-2"><span className="text-slate-400">Black PETG Cost</span><span className="font-medium">{formatCurrency(blackPetgCostPerGram * (cogs.blackGramsUsed || 533))}</span></div>
            <div className="flex justify-between items-center border-b border-slate-700 pb-2"><span className="text-slate-400">White PETG Cost</span><span className="font-medium">{formatCurrency(whitePetgCostPerGram * (cogs.whiteGramsUsed || 11))}</span></div>
            <div className="flex justify-between items-center border-b border-slate-700 pb-2"><span className="text-slate-400">Concrete Cost</span><span className="font-medium">{formatCurrency(cogs.concreteCost * cogs.lbsUsed)}</span></div>
            <div className="flex justify-between items-center border-b border-slate-700 pb-2"><span className="text-slate-400">Hardware (Screws, Inserts, Washers)</span><span className="font-medium">{formatCurrency(Number(cogs.screwsCost || 0) + Number(cogs.insertsCost || 0) + Number(cogs.washersCost || 0))}</span></div>
            <div className="flex justify-between items-center border-b border-slate-700 pb-2"><span className="text-slate-400">Packaging (Box & Wrap)</span><span className="font-medium">{formatCurrency(Number(cogs.boxCost || 0) + Number(cogs.bubbleWrapCost || 0))}</span></div>
            <div className="pt-4 flex justify-between items-center"><span className="text-lg font-bold text-slate-200">Total True Cost:</span><span className="text-3xl font-extrabold text-emerald-400">{formatCurrency(costPerTrainer)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaxSummary({ revenues, expenses, mileages, formatCurrency }) {
  const grossSales = revenues.reduce((sum, r) => sum + Number(r.gross || 0), 0);
  const ebayAdFees = revenues.reduce((sum, r) => sum + Number(r.ebay || 0) + Number(r.ad || 0), 0);
  const shippingFees = revenues.reduce((sum, r) => sum + Number(r.shipping || 0), 0);
  const expAdvertising = expenses.filter(e => e.category === 'Advertising').reduce((sum, e) => sum + Number(e.amount), 0);
  const expOffice = expenses.filter(e => e.category === 'Office').reduce((sum, e) => sum + Number(e.amount), 0);
  const expSupplies = expenses.filter(e => e.category === 'Supplies').reduce((sum, e) => sum + Number(e.amount), 0);
  const expTravel = expenses.filter(e => e.category === 'Travel').reduce((sum, e) => sum + Number(e.amount), 0);
  const expEquipment = expenses.filter(e => e.category === 'Equipment').reduce((sum, e) => sum + Number(e.amount), 0);
  const totalMiles = mileages.reduce((sum, m) => sum + Number(m.miles || 0), 0);
  const mileageDeduction = totalMiles * 0.725;
  const totalExpenses = ebayAdFees + shippingFees + expAdvertising + expOffice + expSupplies + expTravel + expEquipment + mileageDeduction;
  const netProfit = grossSales - totalExpenses;

  const TaxLine = ({ line, description, amount, isTotal }) => (
    <div className={`flex justify-between items-center py-3 border-b border-slate-100 ${isTotal ? 'bg-slate-50 font-semibold text-slate-800 p-3 rounded' : 'text-slate-600'}`}>
      <div className="flex items-center"><span className="w-16 text-xs font-mono text-slate-400">Line {line}</span><span>{description}</span></div><span>{formatCurrency(amount)}</span>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in print-area">
      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
        
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Apex Performance Concepts LLC</h2>
            <p className="text-sm font-medium text-slate-50 mt-1">Schedule C (Form 1040) Tax Summary</p>
          </div>
          <div className="text-right flex flex-col items-end">
            <button 
              onClick={() => window.print()} 
              className="no-print mb-3 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium py-2 px-4 rounded-lg flex items-center transition-colors"
            >
              <Printer size={16} className="mr-2"/> Save PDF Report
            </button>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tax Year</p>
            <p className="text-xl font-bold text-indigo-600">2026</p>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2 bg-slate-100 p-2 rounded">Part I: Income</h3>
          <TaxLine line="1" description="Gross receipts or sales" amount={grossSales} />
          <TaxLine line="7" description="Gross income" amount={grossSales} isTotal />
        </div>

        <div className="mb-8">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2 bg-slate-100 p-2 rounded">Part II: Expenses</h3>
          <TaxLine line="8" description="Advertising" amount={expAdvertising} />
          <TaxLine line="9" description="Car/truck expenses" amount={mileageDeduction} />
          <TaxLine line="10" description="Commissions and fees" amount={ebayAdFees} />
          <TaxLine line="18" description="Office expense" amount={expOffice} />
          <TaxLine line="22" description="Supplies" amount={expSupplies} />
          <TaxLine line="24a" description="Travel" amount={expTravel} />
          <TaxLine line="27a" description="Other: Shipping Labels" amount={shippingFees} />
          <TaxLine line="27a" description="Other: Equipment" amount={expEquipment} />
          <div className="mt-2"><TaxLine line="28" description="Total expenses" amount={totalExpenses} isTotal /></div>
        </div>

        <div className="mb-8">
          <div className={`p-4 rounded-lg flex justify-between items-center border ${netProfit >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <div className="flex items-center"><span className="w-16 text-xs font-mono font-bold opacity-70">Line 31</span><span className="font-bold text-lg">Net profit (or loss)</span></div>
            <span className="text-2xl font-extrabold">{formatCurrency(netProfit)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const style = document.createElement('style');
style.textContent = `
  .input-field { width: 100%; padding: 0.625rem 0.875rem; border-radius: 0.5rem; border: 1px solid #e2e8f0; background-color: #f8fafc; font-size: 0.875rem; transition: all 0.2s; outline: none; }
  .input-field:focus { border-color: #3b82f6; background-color: #ffffff; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
  .hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  @media print {
    .no-print { display: none !important; }
    body { background-color: white !important; -webkit-print-color-adjust: exact; }
    .print-bg-white { background-color: white !important; }
    .print-no-padding { padding: 0 !important; margin: 0 !important; }
    @page { margin: 0.5in; }
  }
`;
document.head.appendChild(style);