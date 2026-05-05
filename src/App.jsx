import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, DollarSign, Receipt, Wallet, Car, Settings, Plus, Trash2, ClipboardList, Edit2, Check, Download, Upload, X, ArrowUpDown, ChevronUp, ChevronDown, PieChart, BarChart3, Printer, Zap, ArrowRightLeft, ShieldCheck, Target, Package, AlertTriangle, Image as ImageIcon, Map as MapIcon, Loader2, Inbox, PackageOpen, TrendingUp, Sparkles, ShoppingCart, 
  Clock, Play, CheckCircle2, ArrowRight
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

// --- UX PHYSICS & MICRO-INTERACTIONS ---

const AnimatedNumber = ({ value, formatCurrency, isInt = false }) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    let startTime;
    const duration = 1200; 
    const startValue = displayValue;
    const endValue = Number(value) || 0;
    
    if (startValue === endValue) return;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress); 
      const current = startValue + (endValue - startValue) * easeOut;
      
      setDisplayValue(current);
      
      if (progress < 1) requestAnimationFrame(animate);
      else setDisplayValue(endValue);
    };
    
    requestAnimationFrame(animate);
  }, [value]);

  if (formatCurrency) return formatCurrency(displayValue);
  return isInt ? Math.round(displayValue).toLocaleString() : displayValue.toFixed(1);
};

const MagneticButton = ({ children, onClick, className }) => {
  const buttonRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    if (!buttonRef.current) return;
    const { clientX, clientY } = e;
    const { width, height, left, top } = buttonRef.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const x = (clientX - centerX) * 0.2; 
    const y = (clientY - centerY) * 0.2;
    setPosition({ x, y });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ 
        transform: `translate(${position.x}px, ${position.y}px)`, 
        transition: position.x === 0 ? 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none' 
      }}
      className={className}
    >
      {children}
    </button>
  );
};

// --- SKELETON LOADER & EMPTY STATES ---
const DashboardSkeleton = () => (
  <div className="space-y-8 animate-pulse">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="h-8 w-48 bg-zinc-200/80 rounded-lg"></div>
      <div className="flex space-x-3">
        <div className="h-10 w-28 bg-zinc-200/80 rounded-full"></div>
        <div className="h-10 w-28 bg-zinc-200/80 rounded-full"></div>
        <div className="h-10 w-28 bg-zinc-200/80 rounded-full"></div>
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-40 bg-zinc-200/60 rounded-3xl"></div>
      ))}
    </div>
    <div className="h-48 bg-zinc-200/60 rounded-3xl w-full"></div>
  </div>
);

const EmptyState = ({ icon: Icon, title, message, colSpan }) => (
  <tr>
    <td colSpan={colSpan || 12} className="p-0">
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-zinc-50/50 rounded-3xl border border-dashed border-zinc-200/80 m-4 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white p-5 rounded-full shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-zinc-100 mb-5 text-zinc-300">
          <Icon size={32} strokeWidth={1.5} />
        </div>
        <h3 className="text-sm font-bold text-zinc-800 tracking-tight mb-2">{title}</h3>
        <p className="text-xs font-medium text-zinc-500 max-w-[260px] mx-auto leading-relaxed">{message}</p>
      </div>
    </td>
  </tr>
);

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
    <th className={`px-6 py-4 font-semibold text-[11px] uppercase tracking-widest cursor-pointer hover:bg-zinc-50 transition-colors group select-none ${textColor || 'text-zinc-400'}`} onClick={() => requestSort(sortKey)}>
      <div className={`flex items-center space-x-1 ${alignRight ? 'justify-end' : ''}`}>
        <span>{label}</span>
        <span className={`${isActive ? 'text-zinc-900' : 'text-zinc-300 opacity-0 group-hover:opacity-100'}`}>
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
  const [isAppReady, setIsAppReady] = useState(false);

  // --- STATE MANAGEMENT ---
  const [revenues, setRevenues] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [equities, setEquities] = useState([]);
  const [mileages, setMileages] = useState([]);
  const [restocks, setRestocks] = useState([]);
  const [machines, setMachines] = useState([]);
  
  const [appSettings, setAppSettings] = useState({ 
    initialInvestment: 1219.00,
    finishedBuffer: 0,
    targetBuffer: 6
  });
  
  const [cogs, setCogs] = useState({
    blackSpoolCost: 16.99, blackGramsUsed: 533, 
    whiteSpoolCost: 16.99, whiteGramsUsed: 11,
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
    
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      if(u) {
        setTimeout(() => setIsAppReady(true), 600);
      }
    });
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
    const unsubMachines = onSnapshot(getColRef('machines'), (snap) => setMachines(snap.docs.map(d => ({ id: d.id, ...d.data() }))), console.error);
    
    const unsubCogs = onSnapshot(getDocRef('settings', 'cogs'), (docSnap) => { 
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCogs(prev => ({ 
          ...prev, ...data,
          blackSpoolCost: data.blackSpoolCost ?? data.spoolCost ?? 16.99,
          blackGramsUsed: data.blackGramsUsed ?? (data.gramsUsed === 250 ? 533 : data.gramsUsed) ?? 533,
          whiteSpoolCost: data.whiteSpoolCost ?? 16.99,
          whiteGramsUsed: data.whiteGramsUsed ?? 11,
        }));
      } 
    }, console.error);
    
    const unsubSettings = onSnapshot(getDocRef('settings', 'app'), (docSnap) => { 
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAppSettings(prev => ({
          ...prev,
          ...data
        })); 
      } 
    }, console.error);

    return () => { unsubRevs(); unsubExps(); unsubEqs(); unsubMiles(); unsubRestocks(); unsubMachines(); unsubCogs(); unsubSettings(); };
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
  const blackPetgCostPerGram = (cogs.blackSpoolCost || 16.99) / 1000;
  const whitePetgCostPerGram = (cogs.whiteSpoolCost || 16.99) / 1000;
  
  const costPerTrainer = 
    (blackPetgCostPerGram * (cogs.blackGramsUsed || 533)) + 
    (whitePetgCostPerGram * (cogs.whiteGramsUsed || 11)) + 
    ((cogs.concreteCost || 0.15) * (cogs.lbsUsed || 5)) + 
    Number(cogs.boxCost || 0) + 
    Number(cogs.bubbleWrapCost || 0) + 
    Number(cogs.screwsCost || 0) + 
    Number(cogs.insertsCost || 0) + 
    Number(cogs.washersCost || 0);

  const totalUnitsSold = useMemo(() => revenues.reduce((sum, r) => sum + Number(r.qty || 1), 0), [revenues]);
  const totalGrossRevenue = useMemo(() => revenues.reduce((sum, r) => sum + Number(r.gross || 0), 0), [revenues]);
  const totalPlatformFees = useMemo(() => revenues.reduce((sum, r) => sum + Number(r.ebay || 0) + Number(r.ad || 0) + Number(r.shipping || 0) + Number(r.salesTax || 0), 0), [revenues]);
  
  const totalOperatingExpenses = useMemo(() => expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0), [expenses]);
  const totalMiles = useMemo(() => mileages.reduce((sum, m) => sum + Number(m.miles || 0), 0), [mileages]);
  const taxShield = totalOperatingExpenses + (totalMiles * 0.725);
  const netProfit = totalGrossRevenue - totalPlatformFees - totalOperatingExpenses;
  const taxReserve = netProfit > 0 ? netProfit * 0.25 : 0;
  
  const totalTrueProfit = useMemo(() => {
    return revenues.reduce((sum, r) => {
      const net = Number(r.gross) - Number(r.ebay || 0) - Number(r.ad || 0) - Number(r.shipping || 0) - Number(r.salesTax || 0);
      return sum + (net - (costPerTrainer * Number(r.qty || 1)));
    }, 0);
  }, [revenues, costPerTrainer]);
  const avgProfitPerUnit = totalUnitsSold > 0 ? totalTrueProfit / totalUnitsSold : 0;

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
  const INVENTORY_START_DATE = '2026-04-29';
  const inventoryUnitsSold = useMemo(() => revenues.filter(r => r.date >= INVENTORY_START_DATE).reduce((sum, r) => sum + Number(r.qty || 1), 0), [revenues]);
  
  // Total raw materials consumed is Sales PLUS whatever you've pre-built for the shelf
  const totalManufacturedUnits = inventoryUnitsSold + Number(appSettings.finishedBuffer || 0);

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
    blackPetg: ((restockTotals['Black PETG (grams)'] || 0) + (restockTotals['PETG (grams)'] || 0)) - (totalManufacturedUnits * (cogs.blackGramsUsed || 533)),
    whitePetg: (restockTotals['White PETG (grams)'] || 0) - (totalManufacturedUnits * (cogs.whiteGramsUsed || 11)),
    concrete: (restockTotals['Concrete (lbs)'] || 0) - (totalManufacturedUnits * (cogs.lbsUsed || 5)),
    boxes: (restockTotals['Boxes (qty)'] || 0) - totalManufacturedUnits,
    wrap: (restockTotals['Bubble Wrap (qty)'] || 0) - totalManufacturedUnits,
    screws: (restockTotals['Screws (sets)'] || 0) - totalManufacturedUnits,
    inserts: (restockTotals['Inserts (sets)'] || 0) - totalManufacturedUnits,
    washers: (restockTotals['Washers (sets)'] || 0) - totalManufacturedUnits,
  }), [restockTotals, totalManufacturedUnits, cogs]);

  const buildableUnits = useMemo(() => Math.floor(Math.min(
    cogs.blackGramsUsed > 0 ? Math.max(0, currentStock.blackPetg / cogs.blackGramsUsed) : Infinity,
    cogs.whiteGramsUsed > 0 ? Math.max(0, currentStock.whitePetg / cogs.whiteGramsUsed) : Infinity,
    cogs.lbsUsed > 0 ? Math.max(0, currentStock.concrete / cogs.lbsUsed) : Infinity,
    Math.max(0, currentStock.boxes), Math.max(0, currentStock.wrap), Math.max(0, currentStock.screws), Math.max(0, currentStock.inserts), Math.max(0, currentStock.washers)
  )), [currentStock, cogs]);

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

  // --- FLEET MAINTENANCE ENGINE ---
  const lifetimeHoursPerMachine = Math.floor(totalUnitsSold / Math.max(1, machines.length)) * 3.5;

  const maintenanceAlerts = useMemo(() => {
    const alerts = [];
    machines.forEach(m => {
      const hoursSinceMaintenance = Math.max(0, lifetimeHoursPerMachine - (m.maintenanceOffset || 0));
      if (hoursSinceMaintenance >= 300) {
        alerts.push({ name: m.name, hoursOver: (hoursSinceMaintenance - 300).toFixed(1) });
      }
    });
    return alerts;
  }, [machines, lifetimeHoursPerMachine]);

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  
  const TabButton = ({ id, icon: Icon, label }) => (
    <button 
      onClick={() => setActiveTab(id)} 
      className={`relative flex items-center space-x-2 px-5 py-2.5 text-sm font-semibold transition-all duration-300 whitespace-nowrap rounded-full z-10 flex-shrink-0 ${activeTab === id ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/50'}`}
    >
      {activeTab === id && <div className="absolute inset-0 bg-white rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.06)] border border-zinc-200/50 -z-10 animate-in zoom-in-95 duration-200"></div>}
      <Icon size={16} strokeWidth={activeTab === id ? 2.5 : 2} className={activeTab === id ? 'text-blue-600' : ''} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-zinc-900 font-sans antialiased print-bg-white selection:bg-zinc-200 relative overflow-hidden">
      
      {/* Ambient Blurred Backgrounds */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none no-print">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vh] rounded-full bg-blue-400/5 blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[40vw] h-[60vh] rounded-full bg-emerald-400/5 blur-[100px]"></div>
      </div>

      {quickAction === 'revenue' && <QuickRevenueModal onClose={() => setQuickAction(null)} onAdd={(d) => { handleAdd('revenues', d); setQuickAction(null); }} />}
      {quickAction === 'expense' && <QuickExpenseModal uploadReceipt={uploadReceipt} onClose={() => setQuickAction(null)} onAdd={(d) => { handleAdd('expenses', d); setQuickAction(null); }} />}
      {quickAction === 'equity' && <QuickEquityModal onClose={() => setQuickAction(null)} onAdd={(d) => { handleAdd('equities', d); setQuickAction(null); }} />}

      <header className="bg-white/70 backdrop-blur-xl border-b border-zinc-200/60 sticky top-0 z-30 no-print transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
          <div className="flex justify-between items-end mb-5">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">APEX Performance</h1>
              <p className="text-[11px] font-bold tracking-widest uppercase text-zinc-400 mt-1">Enterprise Ledger</p>
            </div>
          </div>
          
          <div className="overflow-x-auto hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 -mb-2">
            <div className="flex gap-1 bg-zinc-100/50 p-1.5 rounded-full border border-zinc-200/50 w-max mb-1">
              <TabButton id="dashboard" icon={LayoutDashboard} label="Command Center" />
              <TabButton id="analytics" icon={MapIcon} label="Analytics" />
              <TabButton id="production" icon={Zap} label="Production" />
              <TabButton id="revenue" icon={DollarSign} label="Revenue" />
              <TabButton id="warehouse" icon={Package} label="Warehouse" />
              <TabButton id="fleet" icon={Printer} label="Fleet ROI" />
              <TabButton id="expenses" icon={Receipt} label="Expenses" />
              <TabButton id="equity" icon={Wallet} label="Equity" />
              <TabButton id="mileage" icon={Car} label="Mileage" />
              <TabButton id="cogs" icon={Settings} label="Manufacturing" />
              <TabButton id="tax" icon={ClipboardList} label="Tax Prep" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 print-no-padding relative z-10">
        
        {/* Loading Skeleton */}
        {!isAppReady ? <DashboardSkeleton /> : (
          <>
            {activeTab === 'dashboard' && (
              <div className="space-y-8 animate-in fade-in duration-500 slide-in-from-bottom-4">
                
                {lowStockAlerts.length > 0 && (
                  <div className="bg-white/80 backdrop-blur-md border border-amber-200/60 p-5 rounded-3xl shadow-[0_8px_30px_rgb(245,158,11,0.1)] flex items-start">
                    <div className="bg-amber-100 p-2 rounded-full mr-4"><AlertTriangle className="text-amber-600 flex-shrink-0" size={20} /></div>
                    <div>
                      <h3 className="text-amber-900 font-bold text-sm tracking-wide">SUPPLY CHAIN ALERT</h3>
                      <p className="text-amber-700/80 text-sm mt-1 font-medium">Based on recent sales velocity ({dailySalesVelocity.toFixed(1)} units/day), you will run out of:</p>
                      <ul className="text-amber-800 text-sm mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 font-medium">
                        {lowStockAlerts.map((alert, i) => (
                          <li key={i} className="bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100/50">{alert.name} <span className="opacity-60 text-xs ml-1">in {alert.days}d</span></li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {maintenanceAlerts.length > 0 && (
                  <div className="bg-white/80 backdrop-blur-md border border-rose-200/60 p-5 rounded-3xl shadow-[0_8px_30px_rgb(225,29,72,0.1)] flex items-start mt-4">
                    <div className="bg-rose-100 p-2 rounded-full mr-4"><Settings className="text-rose-600 flex-shrink-0 animate-[spin_4s_linear_infinite]" size={20} /></div>
                    <div>
                      <h3 className="text-rose-900 font-bold text-sm tracking-wide">FLEET MAINTENANCE REQUIRED</h3>
                      <p className="text-rose-700/80 text-sm mt-1 font-medium">The following hardware has exceeded the 300-hour print threshold and requires carbon rod cleaning & Z-axis greasing:</p>
                      <ul className="text-rose-800 text-sm mt-2 flex flex-wrap gap-2 font-medium">
                        {maintenanceAlerts.map((alert, i) => (
                          <li key={i} className="bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100/50">{alert.name} <span className="opacity-60 text-xs ml-1 font-bold">({alert.hoursOver}h over)</span></li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Overview</h2>
                  <div className="flex space-x-3">
                    <MagneticButton onClick={() => setQuickAction('revenue')} className="bg-zinc-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold flex items-center shadow-[0_4px_14px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)]"><Plus size={16} className="mr-1.5"/> Log Sale</MagneticButton>
                    <MagneticButton onClick={() => setQuickAction('expense')} className="bg-white border border-zinc-200 text-zinc-800 px-5 py-2.5 rounded-full text-sm font-semibold flex items-center shadow-sm"><Receipt size={16} className="mr-1.5 text-zinc-400"/> Expense</MagneticButton>
                    <MagneticButton onClick={() => setQuickAction('equity')} className="bg-white border border-zinc-200 text-zinc-800 px-5 py-2.5 rounded-full text-sm font-semibold flex items-center shadow-sm"><ArrowRightLeft size={16} className="mr-1.5 text-zinc-400"/> Transfer</MagneticButton>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <DashboardCard title="Total Revenue" amount={totalGrossRevenue} subtitle="Gross lifetime sales" color="zinc" formatCurrency={formatCurrency} />
                  <DashboardCard title="Platform Fees" amount={totalPlatformFees} subtitle="eBay, Ads, Shipping, & Tax" color="zinc" isNegative formatCurrency={formatCurrency} />
                  <DashboardCard title="Operating Expenses" amount={totalOperatingExpenses} subtitle="Printers, tools, gear" color="zinc" isNegative formatCurrency={formatCurrency} />
                  
                  <div className="col-span-1 md:col-span-2 lg:col-span-3 h-px bg-zinc-200/60 my-2"></div>
                  
                  <DashboardCard title="Net Profit" amount={netProfit} subtitle="True enterprise earnings" color={netProfit >= 0 ? "emerald" : "zinc"} highlight formatCurrency={formatCurrency} />
                  <DashboardCard title="Tax Reserve (25%)" amount={taxReserve} subtitle="Set aside for IRS & Iowa" color="zinc" formatCurrency={formatCurrency} />
                  <DashboardCard title="Amex Checking" amount={estimatedCashBalance} subtitle="Cash balance (since Apr 29)" color="blue" formatCurrency={formatCurrency} />
                  
                  <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-zinc-100 p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)] flex flex-col justify-center transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] group">
                    <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest flex items-center"><Target size={14} className="mr-2"/> Mfg. Efficiency</h3>
                    <div className="text-3xl sm:text-4xl font-bold tracking-tighter mt-3 bg-clip-text text-transparent bg-gradient-to-br from-emerald-500 to-emerald-700">
                      <AnimatedNumber value={avgProfitPerUnit} formatCurrency={formatCurrency} />
                    </div>
                    <p className="text-sm font-medium text-zinc-400 mt-2">Avg true profit per unit</p>
                    <div className="mt-4 pt-4 border-t border-zinc-100 flex justify-between items-center">
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Total Units</span>
                      <span className="font-bold text-zinc-900 bg-zinc-100 px-3 py-1 rounded-full text-xs"><AnimatedNumber value={totalUnitsSold} isInt={true} /></span>
                    </div>
                  </div>

                  <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-zinc-100 p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)] flex flex-col justify-center transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] group">
                    <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest flex items-center"><ShieldCheck size={14} className="mr-2"/> The Tax Shield</h3>
                    <div className="text-3xl sm:text-4xl font-bold tracking-tighter mt-3 bg-clip-text text-transparent bg-gradient-to-br from-blue-500 to-indigo-600">
                      <AnimatedNumber value={taxShield} formatCurrency={formatCurrency} />
                    </div>
                    <p className="text-sm font-medium text-zinc-400 mt-2 leading-tight">Total cash value of legal deductions (Expenses + Mileage)</p>
                  </div>

                  <div className={`rounded-3xl border p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)] flex flex-col justify-center transition-all ${drawsGolf > 0 || isGolfUnlocked ? 'bg-gradient-to-br from-[#f0fdf4] to-white border-emerald-100' : 'bg-white/80 backdrop-blur-md border-zinc-100'}`}>
                    <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center justify-center">Golf Fund</h3>
                    <div className="text-center">
                      <div className={`text-3xl sm:text-4xl font-bold tracking-tighter mt-1 ${drawsGolf > 0 || isGolfUnlocked ? 'bg-clip-text text-transparent bg-gradient-to-br from-emerald-500 to-emerald-700' : 'text-zinc-400'}`}>
                        <AnimatedNumber value={drawsGolf} formatCurrency={formatCurrency} />
                      </div>
                      <span className="block text-xs font-medium text-zinc-400 mt-2">Total Accounted For / Withdrawn</span>
                    </div>
                    <div className={`w-full mt-5 border-t pt-4 ${isGolfUnlocked ? 'border-emerald-200/60' : 'border-zinc-100'}`}>
                    {!isGolfUnlocked ? (
                      <p className="text-xs font-medium text-zinc-500 text-center">Generate <span className="font-bold text-zinc-800">{formatCurrency(Math.max(0, initialGoal - safeCash))}</span> more safe profit to unlock</p>
                    ) : (
                      <div className="flex justify-between items-center w-full">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-800/60">Available:</span>
                        <span className="font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full text-xs shadow-sm">{formatCurrency(availableGolfFund)}</span>
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

            {activeTab === 'analytics' && <Analytics revenues={revenues} expenses={expenses} formatCurrency={formatCurrency} totalTrueProfit={totalTrueProfit} totalUnitsSold={totalUnitsSold} />}
            {activeTab === 'production' && <ProductionBoard revenues={revenues} appSettings={appSettings} handleUpdateSettings={handleUpdateSettings} handleUpdateRecord={handleUpdateRecord} buildableUnits={buildableUnits} />}
            {activeTab === 'warehouse' && <Warehouse restocks={restocks} currentStock={currentStock} buildableUnits={buildableUnits} runoutDays={runoutDays} dailySalesVelocity={dailySalesVelocity} onAdd={(data) => handleAdd('restocks', data)} onDelete={(id) => handleDelete('restocks', id)} formatCurrency={formatCurrency} cogs={cogs} />}
            {activeTab === 'fleet' && <FleetCommand machines={machines} totalTrueProfit={totalTrueProfit} totalUnitsSold={totalUnitsSold} onAdd={(data) => handleAdd('machines', data)} onDelete={(id) => handleDelete('machines', id)} onUpdate={handleUpdateRecord} formatCurrency={formatCurrency} />}
            {activeTab === 'revenue' && <RevenueLog revenues={revenues} costPerTrainer={costPerTrainer} onAdd={(data) => handleAdd('revenues', data)} onUpdate={(id, data) => handleUpdateRecord('revenues', id, data)} onDelete={(id) => handleDelete('revenues', id)} formatCurrency={formatCurrency} />}
            {activeTab === 'expenses' && <ExpenseTracker uploadReceipt={uploadReceipt} expenses={expenses} onAdd={(data) => handleAdd('expenses', data)} onUpdate={(id, data) => handleUpdateRecord('expenses', id, data)} onDelete={(id) => handleDelete('expenses', id)} formatCurrency={formatCurrency} />}
            {activeTab === 'equity' && <OwnerEquity equities={equities} initialGoal={initialGoal} onAdd={(data) => handleAdd('equities', data)} onUpdate={(id, data) => handleUpdateRecord('equities', id, data)} onDelete={(id) => handleDelete('equities', id)} formatCurrency={formatCurrency} />}
            {activeTab === 'mileage' && <MileageLog mileages={mileages} onAdd={(data) => handleAdd('mileages', data)} onUpdate={(id, data) => handleUpdateRecord('mileages', id, data)} onDelete={(id) => handleDelete('mileages', id)} formatCurrency={formatCurrency} />}
            {activeTab === 'cogs' && <Manufacturing cogs={cogs} onUpdate={handleUpdateCogs} costPerTrainer={costPerTrainer} blackPetgCostPerGram={blackPetgCostPerGram} whitePetgCostPerGram={whitePetgCostPerGram} formatCurrency={formatCurrency} />}
            {activeTab === 'tax' && <TaxSummary revenues={revenues} expenses={expenses} mileages={mileages} formatCurrency={formatCurrency} />}
          </>
        )}
      </main>
    </div>
  );
}

// --- UI COMPONENTS ---

const modalInputStyle = "w-full border border-zinc-200 bg-zinc-50/50 rounded-2xl px-4 py-3 text-sm font-medium transition-all focus:bg-white focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none";
const inlineInputStyle = "w-full border border-zinc-200 rounded-lg px-3 py-1.5 text-sm font-medium transition-all focus:border-zinc-900 outline-none";

function QuickRevenueModal({ onClose, onAdd }) {
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], orderNum: '', desc: '', qty: 1, gross: '', salesTax: '', ebay: '', ad: '', shipping: '', state: '' });
  const [showFees, setShowFees] = useState(false);

  const handleSubmit = (e) => { e.preventDefault(); if(formData.gross) onAdd(formData); };
  return (
    <div className="fixed inset-0 bg-zinc-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-spring-in border border-zinc-200/50">
        <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-white/50 backdrop-blur-md">
          <h2 className="text-lg font-bold tracking-tight text-zinc-900 flex items-center">Log New Sale</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900 transition-colors bg-zinc-100 hover:bg-zinc-200 p-2.5 rounded-full"><X size={18}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-white">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Date</label><input type="date" className={modalInputStyle} value={formData.date} onChange={e=>setFormData({...formData, date:e.target.value})} required/></div>
            <div><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">State (e.g. AZ)</label><input type="text" maxLength="2" className={modalInputStyle} placeholder="Optional" value={formData.state} onChange={e=>setFormData({...formData, state:e.target.value.toUpperCase()})}/></div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3"><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Description</label><input type="text" className={modalInputStyle} value={formData.desc} onChange={e=>setFormData({...formData, desc:e.target.value})} required/></div>
            <div className="col-span-1"><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Qty</label><input type="number" min="1" className={modalInputStyle} value={formData.qty} onChange={e=>setFormData({...formData, qty:e.target.value})} required/></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Total Paid (Gross $)</label><input type="number" step="0.01" className={modalInputStyle} value={formData.gross} onChange={e=>setFormData({...formData, gross:e.target.value})} required/></div>
            <div><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Sales Tax ($)</label><input type="number" step="0.01" className={modalInputStyle} value={formData.salesTax} onChange={e=>setFormData({...formData, salesTax:e.target.value})}/></div>
          </div>
          
          {!showFees ? (
            <button type="button" onClick={() => setShowFees(true)} className="w-full py-3.5 border border-dashed border-zinc-200 rounded-2xl text-[11px] font-bold uppercase tracking-widest text-zinc-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 transition-all flex justify-center items-center">
              <Plus size={14} className="mr-1.5" /> Add Fees & Shipping
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-3 p-5 bg-zinc-50 rounded-2xl border border-zinc-100/80 animate-in fade-in zoom-in-95 duration-200">
              <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">eBay Fee</label><input type="number" step="0.01" className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-zinc-900" value={formData.ebay} onChange={e=>setFormData({...formData, ebay:e.target.value})}/></div>
              <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Ad Fee</label><input type="number" step="0.01" className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-zinc-900" value={formData.ad} onChange={e=>setFormData({...formData, ad:e.target.value})}/></div>
              <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Label Cost</label><input type="number" step="0.01" className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-zinc-900" value={formData.shipping} onChange={e=>setFormData({...formData, shipping:e.target.value})}/></div>
            </div>
          )}

          <button type="submit" className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-3.5 px-4 rounded-2xl mt-4 transition-all shadow-[0_4px_14px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] hover:-translate-y-0.5">Save Record</button>
        </form>
      </div>
    </div>
  );
}

function ProductionBoard({ revenues, appSettings, handleUpdateSettings, handleUpdateRecord, buildableUnits }) {
  const finishedBuffer = Number(appSettings.finishedBuffer || 0);
  const targetBuffer = Number(appSettings.targetBuffer || 6);

  // Auto-clean old records so they don't clog the board if you just uploaded a giant historical CSV
  const activeOrders = useMemo(() => {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const cutoff = fiveDaysAgo.toISOString().split('T')[0];

    return revenues.filter(r => {
      // If it explicitly has a status and isn't shipped or archived, keep it
      if (r.fulfillmentStatus === 'shipped' || r.fulfillmentStatus === 'archived') return false;
      if (r.fulfillmentStatus) return true;
      // If it doesn't have a status but is brand new, put it on the board
      if (!r.fulfillmentStatus && r.date >= cutoff && Number(r.qty) > 0) return true;
      return false;
    }).sort((a, b) => new Date(a.date) - new Date(b.date)); // Oldest first
  }, [revenues]);

  const updateStatus = (id, newStatus) => {
    handleUpdateRecord('revenues', id, { fulfillmentStatus: newStatus });
  };

  const pullFromBuffer = (order) => {
    if (finishedBuffer >= Number(order.qty || 1)) {
      handleUpdateSettings({ ...appSettings, finishedBuffer: finishedBuffer - Number(order.qty || 1) });
      updateStatus(order.id, 'shipped');
    } else {
      alert("Not enough fully assembled units in the safety buffer!");
    }
  };

  const adjustBuffer = (amount) => {
    const newTotal = Math.max(0, finishedBuffer + amount);
    if (amount > 0 && buildableUnits < amount) {
      alert("Not enough raw materials in the Warehouse to print this!");
      return;
    }
    handleUpdateSettings({ ...appSettings, finishedBuffer: newTotal });
  };

  const getUrgency = (dateStr, totalPrintHours) => {
    const orderDate = new Date(dateStr);
    const diffHours = Math.floor((new Date() - orderDate) / (1000 * 60 * 60));
    const hoursLeft = 72 - diffHours;
    const slack = hoursLeft - totalPrintHours;
    
    if (hoursLeft < 0) return { text: `${Math.abs(hoursLeft)}h OVERDUE`, color: 'text-rose-700 bg-rose-100 border-rose-300 shadow-[0_0_10px_rgba(225,29,72,0.4)] animate-pulse' };
    if (slack < 0) return { text: `${hoursLeft}h LEFT (LATE RISK)`, color: 'text-rose-700 bg-rose-100 border-rose-300' };
    if (hoursLeft <= 24) return { text: `${hoursLeft}h LEFT`, color: 'text-amber-700 bg-amber-100 border-amber-300' };
    return { text: `${hoursLeft}h left`, color: 'text-blue-700 bg-blue-100 border-blue-200' };
  };

  const OrderCard = ({ order, status }) => {
    const qty = Number(order.qty || 1);
    const baseHours = qty * 12.6;
    const coverHours = qty * 4.4;
    const totalHours = baseHours + coverHours;
    
    const urgency = getUrgency(order.date, totalHours);
    const isOverdue = urgency.text.includes('OVERDUE') || urgency.text.includes('LATE RISK');

    return (
      <div className={`bg-white rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all group relative ${isOverdue ? 'border-rose-200' : 'border-zinc-200'}`}>
        <button onClick={() => updateStatus(order.id, 'archived')} className="absolute top-3 right-3 text-zinc-300 hover:text-rose-500 bg-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-sm border border-zinc-100 hover:border-rose-200 z-10" title="Remove from Queue">
          <X size={14} />
        </button>
        
        <div className="flex justify-between items-start mb-2 pr-8">
          <div>
            <div className="font-bold text-sm text-zinc-900 line-clamp-1">{order.desc}</div>
            <div className="text-[10px] font-mono text-zinc-500 mt-0.5">{order.orderNum || 'Manual Sale'} • Qty: {qty}</div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 mt-2.5">
          <div className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded border ${urgency.color} whitespace-nowrap`}>
            {urgency.text}
          </div>
          <div className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded border border-zinc-200 bg-zinc-50 text-zinc-600 whitespace-nowrap flex items-center">
            <Clock size={10} className="mr-1" /> {totalHours.toFixed(1)}h Print
          </div>
        </div>

        <div className="mt-3 bg-zinc-50/80 rounded-lg p-2.5 text-[10px] text-zinc-500 border border-zinc-100 flex flex-col gap-1.5">
          <div className="flex justify-between items-center"><span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>Bases ({qty})</span> <span className="font-semibold text-zinc-700">{baseHours.toFixed(1)}h</span></div>
          <div className="flex justify-between items-center"><span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-zinc-300 mr-1.5"></span>Covers ({qty})</span> <span className="font-semibold text-zinc-700">{coverHours.toFixed(1)}h</span></div>
        </div>
        
        <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-zinc-100">
          {(!status || status === 'new') && (
            <>
              {finishedBuffer >= qty && (
                <button onClick={() => pullFromBuffer(order)} className="w-full bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold py-2 rounded-lg transition-colors flex justify-center items-center">
                  <PackageOpen size={14} className="mr-1.5" /> Pull from Buffer
                </button>
              )}
              <button onClick={() => updateStatus(order.id, 'printing')} className="w-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold py-2 rounded-lg transition-colors flex justify-center items-center shadow-sm">
                <Play size={14} className="mr-1.5" /> Start Printing
              </button>
            </>
          )}
          {status === 'printing' && (
            <div className="flex gap-2">
              <button onClick={() => updateStatus(order.id, 'new')} className="bg-zinc-100 hover:bg-zinc-200 text-zinc-600 px-3 py-2 rounded-lg transition-colors shadow-sm" title="Revert to To Print">
                <ArrowRightLeft size={14} />
              </button>
              <button onClick={() => updateStatus(order.id, 'ready')} className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-bold py-2 rounded-lg transition-colors flex justify-center items-center shadow-sm">
                <CheckCircle2 size={14} className="mr-1.5" /> Finish & Assemble
              </button>
            </div>
          )}
          {status === 'ready' && (
            <div className="flex gap-2">
              <button onClick={() => updateStatus(order.id, 'printing')} className="bg-zinc-100 hover:bg-zinc-200 text-zinc-600 px-3 py-2 rounded-lg transition-colors shadow-sm" title="Revert to Printing">
                <ArrowRightLeft size={14} />
              </button>
              <button onClick={() => updateStatus(order.id, 'shipped')} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg transition-colors flex justify-center items-center shadow-sm">
                <ArrowRight size={14} className="mr-1.5" /> Mark Shipped
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const newOrders = activeOrders.filter(r => !r.fulfillmentStatus || r.fulfillmentStatus === 'new');
  const printingOrders = activeOrders.filter(r => r.fulfillmentStatus === 'printing');
  const readyOrders = activeOrders.filter(r => r.fulfillmentStatus === 'ready');

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* THE SAFETY BUFFER */}
      <div className={`rounded-3xl border p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between shadow-lg transition-all duration-500 ${activeOrders.length > 0 ? 'bg-zinc-900 text-white border-zinc-800' : (finishedBuffer >= targetBuffer ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200')}`}>
        <div className="flex items-center mb-4 sm:mb-0">
          <div className={`p-4 rounded-full mr-5 ${activeOrders.length > 0 ? 'bg-zinc-800 text-zinc-300' : (finishedBuffer >= targetBuffer ? 'bg-emerald-200 text-emerald-700' : 'bg-blue-200 text-blue-700')}`}>
            <ShieldCheck size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">The Safety Buffer</h2>
            <p className={`text-sm font-medium mt-1 ${activeOrders.length > 0 ? 'text-zinc-400' : 'text-zinc-600'}`}>
              {activeOrders.length > 0 
                ? `${activeOrders.length} active orders pending. Fulfill these before printing for stock.` 
                : (finishedBuffer >= targetBuffer 
                  ? `Buffer is full. Your 72-hour window is completely secured.` 
                  : `Printers are idle. Print ${targetBuffer - finishedBuffer} more units to secure your weekend.`)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-6 bg-white/10 p-3 rounded-2xl backdrop-blur-sm border border-black/5">
          <div className="flex flex-col items-center">
            <span className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${activeOrders.length > 0 ? 'text-zinc-400' : 'text-zinc-500'}`}>Target</span>
            <div className="flex items-center space-x-2">
              <button onClick={() => handleUpdateSettings({...appSettings, targetBuffer: Math.max(0, targetBuffer - 1)})} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${activeOrders.length > 0 ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-white hover:bg-zinc-100 text-zinc-900 shadow-sm'}`}>-</button>
              <span className={`text-2xl font-bold w-8 text-center ${activeOrders.length > 0 ? 'text-white' : 'text-zinc-900'}`}>{targetBuffer}</span>
              <button onClick={() => handleUpdateSettings({...appSettings, targetBuffer: targetBuffer + 1})} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${activeOrders.length > 0 ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-white hover:bg-zinc-100 text-zinc-900 shadow-sm'}`}>+</button>
            </div>
          </div>
          <div className={`w-px h-12 ${activeOrders.length > 0 ? 'bg-zinc-700' : 'bg-zinc-200'}`}></div>
          <div className="flex flex-col items-center">
            <span className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${activeOrders.length > 0 ? 'text-zinc-400' : 'text-zinc-500'}`}>On Shelf</span>
            <div className="flex items-center space-x-2">
              <button onClick={() => adjustBuffer(-1)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${activeOrders.length > 0 ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-white hover:bg-zinc-100 text-zinc-900 shadow-sm'}`}>-</button>
              <span className={`text-2xl font-bold w-8 text-center ${activeOrders.length > 0 ? 'text-white' : 'text-zinc-900'}`}>{finishedBuffer}</span>
              <button onClick={() => adjustBuffer(1)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${activeOrders.length > 0 ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-white hover:bg-zinc-100 text-zinc-900 shadow-sm'}`}>+</button>
            </div>
          </div>
        </div>
      </div>

      {/* FULFILLMENT KANBAN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Column 1: To Print */}
        <div className="bg-zinc-50/80 backdrop-blur-sm rounded-3xl border border-zinc-200/60 p-5 flex flex-col h-full">
          <div className="flex justify-between items-center mb-5 px-1">
            <h3 className="font-bold text-zinc-900 flex items-center"><Inbox size={16} className="mr-2 text-zinc-400"/> To Print</h3>
            <span className="bg-zinc-200 text-zinc-700 text-xs font-bold px-2.5 py-1 rounded-full">{newOrders.length}</span>
          </div>
          <div className="flex-1 space-y-4">
            {newOrders.map(order => <OrderCard key={order.id} order={order} status="new" />)}
            {newOrders.length === 0 && <div className="text-center py-10 text-zinc-400 text-sm font-medium border-2 border-dashed border-zinc-200 rounded-2xl">No pending orders.</div>}
          </div>
        </div>

        {/* Column 2: Printing */}
        <div className="bg-blue-50/50 backdrop-blur-sm rounded-3xl border border-blue-100/60 p-5 flex flex-col h-full">
          <div className="flex justify-between items-center mb-5 px-1">
            <h3 className="font-bold text-blue-900 flex items-center"><Settings size={16} className="mr-2 text-blue-500 animate-[spin_4s_linear_infinite]"/> Printing</h3>
            <span className="bg-blue-200 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full">{printingOrders.length}</span>
          </div>
          <div className="flex-1 space-y-4">
            {printingOrders.map(order => <OrderCard key={order.id} order={order} status="printing" />)}
            {printingOrders.length === 0 && <div className="text-center py-10 text-blue-300 text-sm font-medium border-2 border-dashed border-blue-100 rounded-2xl">Printers are idle.</div>}
          </div>
        </div>

        {/* Column 3: Ready to Ship */}
        <div className="bg-emerald-50/50 backdrop-blur-sm rounded-3xl border border-emerald-100/60 p-5 flex flex-col h-full">
          <div className="flex justify-between items-center mb-5 px-1">
            <h3 className="font-bold text-emerald-900 flex items-center"><Package size={16} className="mr-2 text-emerald-500"/> Assembly / Pack</h3>
            <span className="bg-emerald-200 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full">{readyOrders.length}</span>
          </div>
          <div className="flex-1 space-y-4">
            {readyOrders.map(order => <OrderCard key={order.id} order={order} status="ready" />)}
            {readyOrders.length === 0 && <div className="text-center py-10 text-emerald-300 text-sm font-medium border-2 border-dashed border-emerald-100 rounded-2xl">Nothing waiting to pack.</div>}
          </div>
        </div>

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
    <div className="fixed inset-0 bg-zinc-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-spring-in border border-zinc-200/50">
        <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
          <h2 className="text-lg font-bold tracking-tight text-zinc-900">Log Expense</h2>
          <button onClick={onClose} disabled={isUploading} className="text-zinc-400 hover:text-zinc-900 transition-colors bg-zinc-100 hover:bg-zinc-200 p-2.5 rounded-full"><X size={18}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-white">
          <div><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Date</label><input type="date" className={modalInputStyle} value={formData.date} onChange={e=>setFormData({...formData, date:e.target.value})} required/></div>
          <div><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Description</label><input type="text" className={modalInputStyle} value={formData.desc} onChange={e=>setFormData({...formData, desc:e.target.value})} required/></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Category</label><select className={modalInputStyle} value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})}>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Amount ($)</label><input type="number" step="0.01" className={modalInputStyle} value={formData.amount} onChange={e=>setFormData({...formData, amount:e.target.value})} required/></div>
          </div>
          <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-2xl">
            <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Attach Receipt</label>
            <input type="file" accept="image/*,application/pdf" onChange={e=>setFile(e.target.files[0])} className="w-full text-sm font-medium text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-wider file:bg-zinc-200 file:text-zinc-700 hover:file:bg-zinc-300 transition-colors cursor-pointer" />
          </div>
          <button type="submit" disabled={isUploading} className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-400 text-white font-semibold py-3.5 px-4 rounded-2xl mt-4 transition-all shadow-[0_4px_14px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 flex justify-center items-center">
            {isUploading ? <><Loader2 size={18} className="animate-spin mr-2"/> Uploading Receipt...</> : "Save Expense"}
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
    <div className="fixed inset-0 bg-zinc-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-spring-in border border-zinc-200/50">
        <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
          <h2 className="text-lg font-bold tracking-tight text-zinc-900">Transfer Funds</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900 transition-colors bg-zinc-100 hover:bg-zinc-200 p-2.5 rounded-full"><X size={18}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-white">
          <div><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Date</label><input type="date" className={modalInputStyle} value={formData.date} onChange={e=>setFormData({...formData, date:e.target.value})} required/></div>
          <div><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Description</label><input type="text" className={modalInputStyle} value={formData.desc} onChange={e=>setFormData({...formData, desc:e.target.value})} required/></div>
          <div><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Category</label><select className={modalInputStyle} value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})}>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Amount ($)</label><input type="number" step="0.01" className={modalInputStyle} value={formData.amount} onChange={e=>setFormData({...formData, amount:e.target.value})} required/></div>
          <button type="submit" className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-3.5 px-4 rounded-2xl mt-4 transition-all shadow-[0_4px_14px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] hover:-translate-y-0.5">Log Transfer</button>
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

function Analytics({ revenues, expenses, formatCurrency, totalTrueProfit, totalUnitsSold }) {
  const [demandTimeframe, setDemandTimeframe] = useState('lifetime');

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

  const { dayOfWeekData, maxDayUnits, bestDay } = useMemo(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    const revs = [0, 0, 0, 0, 0, 0, 0];

    let filteredRevenues = revenues;
    if (demandTimeframe !== 'lifetime') {
      const daysToSubtract = demandTimeframe === '30' ? 30 : 14;
      const cutoffDate = new Date(new Date().setDate(new Date().getDate() - daysToSubtract)).toISOString().split('T')[0];
      filteredRevenues = revenues.filter(r => r.date >= cutoffDate);
    }

    filteredRevenues.forEach(r => {
      if (!r.date) return;
      const [y, m, d] = r.date.split('-');
      const dateObj = new Date(y, m - 1, d);
      const dayIdx = dateObj.getDay();
      counts[dayIdx] += Number(r.qty || 1);
      revs[dayIdx] += Number(r.gross || 0);
    });

    const parsedData = days.map((day, idx) => ({
      day,
      short: day.substring(0, 3),
      units: counts[idx],
      rev: revs[idx],
      isWeekend: idx === 0 || idx === 6
    }));

    const maxUnits = Math.max(1, ...parsedData.map(d => d.units));
    const best = parsedData.reduce((max, d) => d.units > max.units ? d : max, parsedData[0]);

    return { dayOfWeekData: parsedData, maxDayUnits: maxUnits, bestDay: best };
  }, [revenues, demandTimeframe]);

  const forecastData = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(new Date().setDate(now.getDate() - 30)).toISOString().split('T')[0];
    const sixtyDaysAgo = new Date(new Date().setDate(now.getDate() - 60)).toISOString().split('T')[0];

    const last30Revs = revenues.filter(r => r.date >= thirtyDaysAgo);
    const prev30Revs = revenues.filter(r => r.date >= sixtyDaysAgo && r.date < thirtyDaysAgo);

    const current30Rev = last30Revs.reduce((sum, r) => sum + Number(r.gross || 0), 0);
    const current30Units = last30Revs.reduce((sum, r) => sum + Number(r.qty || 1), 0);
    const prev30Rev = prev30Revs.reduce((sum, r) => sum + Number(r.gross || 0), 0);

    const dailyRevVelocity = current30Rev / 30;
    const dailyUnitVelocity = current30Units / 30;

    const projectedNext30Rev = dailyRevVelocity * 30;
    const projectedNext30Units = Math.round(dailyUnitVelocity * 30);
    const momGrowth = prev30Rev === 0 ? (current30Rev > 0 ? 100 : 0) : ((current30Rev - prev30Rev) / prev30Rev) * 100;
    
    return { current30Rev, prev30Rev, projectedNext30Rev, projectedNext30Units, momGrowth };
  }, [revenues]);

  const cacData = useMemo(() => {
    const expAdSpend = expenses.filter(e => e.category === 'Advertising').reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const revAdSpend = revenues.reduce((sum, r) => sum + Number(r.ad || 0), 0);
    const totalAdSpend = expAdSpend + revAdSpend;
    
    const cac = totalUnitsSold > 0 ? totalAdSpend / totalUnitsSold : 0;
    const avgProfit = totalUnitsSold > 0 ? totalTrueProfit / totalUnitsSold : 0;
    const ratio = cac > 0 ? avgProfit / cac : 0;
    
    const isHealthy = cac < avgProfit && ratio > 2;

    return { cac, avgProfit, ratio, totalAdSpend, isHealthy };
  }, [revenues, expenses, totalUnitsSold, totalTrueProfit]);

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-zinc-100 p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-shadow">
        <div className="flex items-center justify-between mb-8">
          <h3 className="font-bold text-zinc-900 tracking-tight text-lg flex items-center">Customer Geospatial Tile Map</h3>
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-50 border border-zinc-100 px-3 py-1.5 rounded-full">Hover to inspect</div>
        </div>
        
        <div className="flex flex-col lg:flex-row gap-10">
          <div className="flex-1 bg-[#fbfbfd] rounded-2xl p-6 border border-zinc-100 flex items-center justify-center">
            <div className="grid gap-1 sm:gap-2 w-full max-w-2xl" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
              {grid.flat().map((cell, i) => {
                if (!cell) return <div key={i} className="aspect-square" />;
                const rev = stateData[cell] || 0;
                const intensity = maxStateRevenue > 0 ? rev / maxStateRevenue : 0;
                const bgColor = rev > 0 ? `rgba(9, 9, 11, ${Math.max(0.08, intensity)})` : '#ffffff'; 
                const textColor = intensity > 0.4 ? '#ffffff' : '#71717a';
                const borderColor = rev > 0 ? 'border-transparent' : 'border-zinc-200';
                
                return (
                  <div 
                    key={i}
                    className={`aspect-square border ${borderColor} rounded-md flex items-center justify-center text-[10px] sm:text-[11px] font-bold cursor-pointer hover:ring-2 hover:ring-blue-500 hover:scale-[1.15] hover:z-10 transition-all shadow-sm relative group`}
                    style={{ backgroundColor: bgColor, color: textColor }}
                  >
                    {cell}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-zinc-900/95 backdrop-blur-sm text-white px-4 py-2.5 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none border border-zinc-700">
                      <div className="font-bold text-[11px] uppercase tracking-widest text-zinc-400 mb-0.5">{cell}</div>
                      <div className="text-white font-semibold">{formatCurrency(rev)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="w-full lg:w-64 flex flex-col space-y-4">
            <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-3">Top Markets</h4>
            {topStates.length === 0 ? (
              <div className="text-sm font-medium text-zinc-400 mt-2">No states logged yet.</div>
            ) : (
              topStates.map((state, idx) => (
                <div key={state.code} className="flex items-center justify-between group">
                  <div className="flex items-center space-x-3">
                    <span className="text-zinc-300 font-bold text-xs w-4">{idx + 1}</span>
                    <span className="font-bold text-zinc-700 text-sm">{state.code}</span>
                  </div>
                  <span className="font-semibold text-zinc-900 text-sm group-hover:text-blue-600 transition-colors">{formatCurrency(state.rev)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* CAC VS LTV RADAR */}
        <div className="lg:col-span-1 bg-white/80 backdrop-blur-md rounded-3xl border border-zinc-100 p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-shadow flex flex-col relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-[0.03] text-zinc-900 transition-transform duration-700 group-hover:scale-110 group-hover:rotate-12"><Target size={150} /></div>
          <h3 className="font-bold text-zinc-900 tracking-tight text-lg mb-8 z-10">Acquisition vs LTV</h3>
          
          <div className="flex-1 flex flex-col justify-center items-center z-10 relative">
            {/* Minimal SVG Donut Chart for Ratio */}
            <svg viewBox="0 0 36 36" className="w-40 h-40 transform -rotate-90 drop-shadow-sm">
              <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f4f4f5" strokeWidth="4" />
              <circle cx="18" cy="18" r="15.915" fill="transparent" 
                stroke={cacData.isHealthy ? '#10b981' : '#f43f5e'} 
                strokeWidth="4" 
                strokeDasharray={`${Math.min(100, (cacData.ratio / 4) * 100)} 100`} 
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out" 
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold mb-0.5">ROAS Ratio</span>
              <span className={`text-2xl font-bold tracking-tight ${cacData.isHealthy ? 'text-emerald-600' : 'text-rose-600'}`}>{cacData.ratio.toFixed(1)}x</span>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-zinc-100 space-y-3 z-10">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-zinc-500">Customer Acq Cost (CAC)</span>
              <span className="font-bold text-zinc-900">{formatCurrency(cacData.cac)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-zinc-500">Avg Net Profit (LTV)</span>
              <span className="font-bold text-zinc-900">{formatCurrency(cacData.avgProfit)}</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white/80 backdrop-blur-md rounded-3xl border border-zinc-100 p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-shadow flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-zinc-900 tracking-tight text-lg">Cash Flow</h3>
            <div className="flex items-center space-x-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">
              <div className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-zinc-900 mr-2"></span> Rev</div>
              <div className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-zinc-300 mr-2"></span> Exp</div>
            </div>
          </div>
          <div className="flex-1 min-h-[250px] flex items-end space-x-2 sm:space-x-6 pb-6 border-b border-zinc-100 overflow-x-auto hide-scrollbar pt-10">
            {monthlyData.length === 0 ? <div className="w-full text-center text-zinc-400 text-sm font-medium pb-10">No data to display yet.</div> : (
              monthlyData.map((data) => {
                const [year, month] = data.month.split('-');
                const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'short' });
                const revHeight = Math.max(2, (data.rev / maxBarValue) * 100);
                const expHeight = Math.max(2, (data.exp / maxBarValue) * 100);
                return (
                  <div key={data.month} className="flex flex-col items-center flex-1 min-w-[50px] group relative">
                    
                    <div className="absolute bottom-[40%] left-1/2 transform -translate-x-1/2 bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 text-white px-5 py-4 rounded-2xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-4 group-hover:translate-y-0 whitespace-nowrap z-50 pointer-events-none flex flex-col gap-2">
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 border-b border-zinc-800 pb-2">{monthName} '{year.slice(2)}</div>
                      <div className="flex justify-between items-center gap-6 text-sm">
                        <span className="flex items-center font-medium text-zinc-300"><span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>Revenue</span> 
                        <span className="font-semibold">{formatCurrency(data.rev)}</span>
                      </div>
                      <div className="flex justify-between items-center gap-6 text-sm">
                        <span className="flex items-center font-medium text-zinc-300"><span className="w-2 h-2 rounded-full bg-zinc-400 mr-2"></span>Expenses</span> 
                        <span className="font-semibold">{formatCurrency(data.exp)}</span>
                      </div>
                      <div className="flex justify-between items-center gap-6 text-sm pt-2 mt-1 border-t border-zinc-800">
                        <span className="font-bold text-zinc-300">Net Profit</span> 
                        <span className={data.rev - data.exp >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{formatCurrency(data.rev - data.exp)}</span>
                      </div>
                    </div>

                    <div className="flex items-end justify-center space-x-1 w-full h-48 relative">
                      <div className="w-1/2 bg-zinc-900 rounded-t-sm transition-all duration-500 hover:bg-blue-600" style={{ height: `${revHeight}%` }}></div>
                      <div className="w-1/2 bg-zinc-300 rounded-t-sm transition-all duration-500 hover:bg-zinc-400" style={{ height: `${expHeight}%` }}></div>
                    </div>
                    <div className="mt-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400 group-hover:text-zinc-900 transition-colors">{monthName}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* DAY OF WEEK DEMAND ANALYSIS */}
        <div className="lg:col-span-2 bg-white/80 backdrop-blur-md rounded-3xl border border-zinc-100 p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-shadow">
          <div className="flex flex-col lg:flex-row gap-10 items-center h-full">
            
            <div className="flex-1 w-full space-y-5 flex flex-col justify-center h-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                <h3 className="font-bold text-zinc-900 tracking-tight text-lg">Demand Pattern Analysis</h3>
                <div className="flex bg-zinc-100/80 p-1 rounded-xl w-max">
                  <button onClick={() => setDemandTimeframe('14')} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${demandTimeframe === '14' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}>14D</button>
                  <button onClick={() => setDemandTimeframe('30')} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${demandTimeframe === '30' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}>30D</button>
                  <button onClick={() => setDemandTimeframe('lifetime')} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${demandTimeframe === 'lifetime' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}>All</button>
                </div>
              </div>
              
              <p className="text-sm font-medium text-zinc-500 leading-relaxed max-w-sm">
                Based on your <strong className="text-zinc-700">{demandTimeframe === 'lifetime' ? 'lifetime' : `last ${demandTimeframe} days`}</strong> ledger data, your peak sales velocity occurs on <strong className="text-zinc-900">{bestDay?.day || 'N/A'}s</strong>, accounting for <strong className="text-blue-600">{formatCurrency(bestDay?.rev || 0)}</strong> in total gross revenue.
              </p>
              {bestDay?.units > 0 && (
                <div className="p-4 bg-blue-50/50 border border-blue-100/50 rounded-2xl">
                  <div className="inline-flex items-center text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-2">
                    <Zap size={12} className="mr-1.5" /> Actionable Insight
                  </div>
                  <p className="text-xs font-medium text-zinc-600">
                    Consider boosting your eBay promoted listing budget heavily on <strong>{bestDay?.day} mornings</strong> to capitalize on high buyer intent.
                  </p>
                </div>
              )}
            </div>

            <div className="flex-1 w-full flex items-end justify-between space-x-2 h-[240px] pt-6 border-b border-zinc-100">
              {dayOfWeekData.map((d) => {
                const height = Math.max(5, (d.units / maxDayUnits) * 100);
                const isBest = d.day === bestDay?.day && d.units > 0;
                return (
                  <div key={d.day} className="flex flex-col items-center flex-1 group h-full">
                    <div className="w-full relative flex justify-center h-full items-end pb-3">
                      <div className="absolute bottom-full mb-3 bg-zinc-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-2 group-hover:translate-y-0 whitespace-nowrap z-10 pointer-events-none shadow-lg">
                        {d.units} units
                      </div>
                      <div 
                        className={`w-full max-w-[48px] rounded-t-lg transition-all duration-500 ${isBest ? 'bg-blue-500' : 'bg-zinc-200 group-hover:bg-zinc-300'}`}
                        style={{ height: `${height}%` }}
                      ></div>
                    </div>
                    <div className={`text-[10px] font-bold uppercase tracking-widest mt-2 transition-colors ${isBest ? 'text-blue-600' : 'text-zinc-400 group-hover:text-zinc-700'}`}>{d.short}</div>
                  </div>
                )
              })}
            </div>

          </div>
        </div>

        {/* APEX AI FORECAST CARD */}
        <div className="lg:col-span-1 bg-zinc-950 backdrop-blur-md rounded-3xl border border-zinc-800 p-8 shadow-2xl flex flex-col relative overflow-hidden group hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)] transition-all">
          <div className="absolute top-0 right-0 p-6 opacity-[0.03] text-white transition-transform duration-700 group-hover:scale-110 group-hover:rotate-12"><Sparkles size={150} /></div>
          
          <h3 className="font-bold text-white tracking-tight text-lg flex items-center mb-6 z-10">
            <Sparkles size={16} className="text-indigo-400 mr-2" /> Apex AI Forecast
          </h3>
          
          <div className="z-10 flex-1 flex flex-col justify-center py-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Projected Next 30 Days</p>
            <div className="text-4xl sm:text-5xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-indigo-400 to-purple-400 mb-2">
              <AnimatedNumber value={forecastData.projectedNext30Rev} formatCurrency={formatCurrency} />
            </div>
            <p className="text-sm font-medium text-zinc-400 flex items-center">
              ~<AnimatedNumber value={forecastData.projectedNext30Units} isInt={true} /> units <span className="text-zinc-600 ml-1">at current velocity</span>
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-zinc-800/80 z-10">
            <div className="flex justify-between items-end mb-3">
              <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 flex items-center"><TrendingUp size={12} className="mr-1.5"/> MoM Growth</span>
              <span className={`text-sm font-bold tracking-tight ${forecastData.momGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {forecastData.momGrowth >= 0 ? '+' : ''}{forecastData.momGrowth.toFixed(1)}%
              </span>
            </div>
            
            <div className="w-full bg-zinc-800/50 rounded-full h-1.5 overflow-hidden shadow-inner">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ease-out ${forecastData.momGrowth >= 0 ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'bg-rose-400'}`} 
                style={{ width: `${Math.min(100, Math.max(0, 50 + forecastData.momGrowth / 2))}%` }} 
              ></div>
            </div>
            
            <div className="flex justify-between mt-3 text-xs font-medium text-zinc-500">
              <span>Last 30: {formatCurrency(forecastData.prev30Rev)}</span>
              <span>Current: {formatCurrency(forecastData.current30Rev)}</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

function Warehouse({ restocks, currentStock, buildableUnits, runoutDays, dailySalesVelocity, onAdd, onDelete, formatCurrency, cogs }) {
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], material: 'Black PETG (grams)', qty: '' });
  const materials = ['Black PETG (grams)', 'White PETG (grams)', 'Concrete (lbs)', 'Boxes (qty)', 'Bubble Wrap (qty)', 'Screws (sets)', 'Inserts (sets)', 'Washers (sets)'];
  const { items: sortedRestocks, requestSort, sortConfig } = useSortableData(restocks);

  const addRow = (e) => { e.preventDefault(); if (!formData.qty) return; onAdd(formData); setFormData({ ...formData, qty: '' }); };

  const handleStockAdjustment = (materialName, diff) => {
    onAdd({
      date: new Date().toISOString().split('T')[0],
      material: materialName,
      qty: diff,
      type: 'Audit' // Special flag so we know this wasn't a standard purchase
    });
  };

  const StockCard = ({ title, materialName, amount, unit, isWarning, daysRemaining, velocity, onAdjust }) => {
    const cleanAmount = Number.isInteger(amount) ? amount : Number(Number(amount).toFixed(2));
    const [isEditing, setIsEditing] = useState(false);
    const [editVal, setEditVal] = useState(cleanAmount);

    useEffect(() => {
      if (!isEditing) setEditVal(Number.isInteger(amount) ? amount : Number(Number(amount).toFixed(2)));
    }, [amount, isEditing]);

    const handleSave = () => {
      const diff = Number(editVal) - cleanAmount;
      if (diff !== 0) {
        onAdjust(materialName, diff);
      }
      setIsEditing(false);
    };

    return (
      <div className={`rounded-3xl border p-6 flex flex-col justify-center transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] group ${isWarning ? 'bg-amber-50/50 border-amber-200/60' : 'bg-white/80 backdrop-blur-md border-zinc-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)]'}`}>
        <div className="flex justify-between items-start">
          <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest flex items-center">
            {title} {isWarning && <AlertTriangle size={14} className="text-amber-500 ml-1" />}
          </h3>
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="text-zinc-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Audit/Adjust Inventory">
              <Edit2 size={14} />
            </button>
          )}
        </div>
        
        {isEditing ? (
          <div className="mt-3 flex items-center space-x-2 animate-in fade-in zoom-in-95">
            <input type="number" step="any" className="w-20 sm:w-24 border border-zinc-300 rounded-lg px-2 py-1.5 text-lg font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white" value={editVal} onChange={e => setEditVal(e.target.value)} autoFocus />
            <button onClick={handleSave} className="bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"><Check size={16} /></button>
            <button onClick={() => setIsEditing(false)} className="bg-zinc-100 text-zinc-500 p-2 rounded-lg hover:bg-zinc-200 transition-colors"><X size={16} /></button>
          </div>
        ) : (
          <div className={`text-3xl font-bold tracking-tighter mt-3 ${isWarning ? 'text-amber-700' : 'text-zinc-900'}`}>
            {cleanAmount.toLocaleString()} <span className="text-sm font-medium tracking-normal text-zinc-400 ml-1">{unit}</span>
          </div>
        )}

        {velocity > 0 && !isEditing && (
          <div className={`text-[11px] mt-3 font-bold uppercase tracking-wider ${daysRemaining <= 7 ? 'text-amber-600' : 'text-zinc-400'}`}>
            {daysRemaining > 0 && daysRemaining !== Infinity ? `~${daysRemaining} days remaining` : (daysRemaining === 0 ? 'Out of stock' : 'Adequate supply')}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className={`rounded-[2.5rem] p-10 flex flex-col sm:flex-row sm:items-center justify-between relative overflow-hidden transition-all duration-500 shadow-xl ${buildableUnits < 10 ? 'bg-amber-100 text-amber-900' : 'bg-white/90 backdrop-blur-md border border-zinc-200 text-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.06)]'}`}>
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-zinc-900"><Package size={200} /></div>
        <div className="z-10">
          <h2 className="text-2xl font-bold tracking-tight">Production Capacity</h2>
          <p className={`text-sm font-medium mt-2 ${buildableUnits < 10 ? 'text-amber-700' : 'text-zinc-500'}`}>Limited by lowest raw material</p>
        </div>
        <div className="z-10 mt-6 sm:mt-0 text-left sm:text-right">
          <div className={`text-7xl font-bold tracking-tighter ${buildableUnits < 10 ? '' : 'text-zinc-900'}`}><AnimatedNumber value={buildableUnits} isInt={true} /></div>
          <div className={`text-[11px] font-bold uppercase tracking-widest mt-2 ${buildableUnits < 10 ? 'text-amber-700' : 'text-zinc-400'}`}>Buildable Units</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        <StockCard title="Black PETG" materialName="Black PETG (grams)" amount={currentStock.blackPetg} unit="g" isWarning={runoutDays.blackPetg <= 7} daysRemaining={runoutDays.blackPetg} velocity={dailySalesVelocity} onAdjust={handleStockAdjustment} />
        <StockCard title="White PETG" materialName="White PETG (grams)" amount={currentStock.whitePetg} unit="g" isWarning={runoutDays.whitePetg <= 7} daysRemaining={runoutDays.whitePetg} velocity={dailySalesVelocity} onAdjust={handleStockAdjustment} />
        <StockCard title="Concrete" materialName="Concrete (lbs)" amount={currentStock.concrete} unit="lbs" isWarning={runoutDays.concrete <= 7} daysRemaining={runoutDays.concrete} velocity={dailySalesVelocity} onAdjust={handleStockAdjustment} />
        <StockCard title="Boxes" materialName="Boxes (qty)" amount={currentStock.boxes} unit="qty" isWarning={runoutDays.boxes <= 7} daysRemaining={runoutDays.boxes} velocity={dailySalesVelocity} onAdjust={handleStockAdjustment} />
        <StockCard title="Bubble Wrap" materialName="Bubble Wrap (qty)" amount={currentStock.wrap} unit="qty" isWarning={runoutDays.wrap <= 7} daysRemaining={runoutDays.wrap} velocity={dailySalesVelocity} onAdjust={handleStockAdjustment} />
        <StockCard title="Screws" materialName="Screws (sets)" amount={currentStock.screws} unit="sets" isWarning={runoutDays.screws <= 7} daysRemaining={runoutDays.screws} velocity={dailySalesVelocity} onAdjust={handleStockAdjustment} />
        <StockCard title="Inserts" materialName="Inserts (sets)" amount={currentStock.inserts} unit="sets" isWarning={runoutDays.inserts <= 7} daysRemaining={runoutDays.inserts} velocity={dailySalesVelocity} onAdjust={handleStockAdjustment} />
        <StockCard title="Washers" materialName="Washers (sets)" amount={currentStock.washers} unit="sets" isWarning={runoutDays.washers <= 7} daysRemaining={runoutDays.washers} velocity={dailySalesVelocity} onAdjust={handleStockAdjustment} />
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-zinc-100 p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)]">
        <h2 className="text-lg font-bold tracking-tight text-zinc-900 mb-6">Log Material Restock</h2>
        <form onSubmit={addRow} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <input type="date" className={inlineInputStyle} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
          <select className={`${inlineInputStyle} sm:col-span-2`} value={formData.material} onChange={e => setFormData({...formData, material: e.target.value})}>{materials.map(m => <option key={m} value={m}>{m}</option>)}</select>
          <input type="number" placeholder="Quantity Added" className={inlineInputStyle} value={formData.qty} onChange={e => setFormData({...formData, qty: e.target.value})} required />
          <button type="submit" className="sm:col-span-4 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center transition-all hover:-translate-y-0.5 shadow-md"><Plus size={18} className="mr-2" /> Add to Warehouse</button>
        </form>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-zinc-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)] overflow-hidden">
        <div className="p-6 border-b border-zinc-100"><h3 className="font-bold tracking-tight text-zinc-900">Restock History</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-zinc-100 bg-zinc-50/50">
              <tr>
                <SortableHeader label="Date" sortKey="date" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Material" sortKey="material" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Qty Added" sortKey="qty" currentSort={sortConfig} requestSort={requestSort} alignRight />
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {sortedRestocks.length === 0 ? (
                <EmptyState icon={PackageOpen} title="Warehouse Empty" message="Log your first material restock to activate production capacity tracking." colSpan="4" />
              ) : sortedRestocks.map(r => (
                  <tr key={r.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-zinc-500">{r.date}</td>
                    <td className="px-6 py-4 font-semibold text-zinc-900">
                      {r.type === 'Audit' && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded mr-2 font-bold text-[9px] shadow-sm tracking-wider">AUDIT</span>}
                      {r.material}
                    </td>
                    <td className={`px-6 py-4 text-right font-bold tracking-tight ${Number(r.qty) > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {Number(r.qty) > 0 ? '+' : ''}{Number(r.qty).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right"><button onClick={() => onDelete(r.id)} className="text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button></td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FleetCommand({ machines, totalTrueProfit, totalUnitsSold, onAdd, onDelete, onUpdate, formatCurrency }) {
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], name: '', cost: '' });
  
  const addRow = (e) => { 
    e.preventDefault(); 
    if (!formData.name || !formData.cost) return; 
    onAdd({ ...formData, cost: Number(formData.cost), maintenanceOffset: 0 }); 
    setFormData({ ...formData, name: '', cost: '' }); 
  };

  const activeMachinesCount = Math.max(1, machines.length);
  const profitPerMachine = totalTrueProfit / activeMachinesCount;
  const unitsPerMachine = Math.floor(totalUnitsSold / activeMachinesCount);
  const lifetimeHoursPerMachine = unitsPerMachine * 3.5; 
  
  const totalFleetValue = machines.reduce((sum, m) => sum + Number(m.cost || 0), 0);

  const handleResetMaintenance = (machine) => {
    if(onUpdate) onUpdate('machines', machine.id, { ...machine, maintenanceOffset: lifetimeHoursPerMachine });
  };

  return (
    <div className="space-y-8 animate-in fade-in pt-8 border-t border-zinc-200/60 mt-8">
      <div className="bg-zinc-950 rounded-[2.5rem] p-10 shadow-2xl shadow-zinc-900/20 text-white flex flex-col sm:flex-row sm:items-center justify-between relative overflow-hidden">
        <div className="absolute top-[-50%] right-[-10%] p-8 opacity-[0.03]"><Printer size={400} /></div>
        <div className="z-10">
          <h2 className="text-2xl font-bold tracking-tight">Fleet Command</h2>
          <p className="text-sm font-medium mt-2 text-zinc-400 max-w-md">Distributing total net profit and print hours automatically across active hardware.</p>
        </div>
        <div className="z-10 mt-6 sm:mt-0 text-left sm:text-right">
          <div className="text-5xl font-semibold tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white to-zinc-400">{formatCurrency(totalFleetValue)}</div>
          <div className="text-[11px] font-bold uppercase tracking-widest mt-2 text-zinc-500">Total Fleet Value</div>
        </div>
      </div>

      {machines.length === 0 ? (
        <table className="w-full"><tbody className="w-full"><EmptyState icon={Printer} title="No Printers Registered" message="Add your 3D printers below to start automatically tracking their ROI and maintenance schedules." colSpan="1" /></tbody></table>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {machines.map((m) => {
            const roiRatio = m.cost > 0 ? (profitPerMachine / m.cost) : 0;
            const percentPaid = Math.min(100, roiRatio * 100);
            const isPaidOff = roiRatio >= 1;
            
            const hoursSinceMaintenance = Math.max(0, lifetimeHoursPerMachine - (m.maintenanceOffset || 0));
            const maintenanceThreshold = 300; 
            const maintPercent = Math.min(100, (hoursSinceMaintenance / maintenanceThreshold) * 100);
            const needsMaintenance = hoursSinceMaintenance >= maintenanceThreshold;
            
            return (
              <div key={m.id} className={`backdrop-blur-md rounded-3xl border p-8 transition-all flex flex-col group relative overflow-hidden ${needsMaintenance ? 'bg-red-50/50 border-red-200/60 shadow-[0_8px_30px_rgb(225,29,72,0.1)]' : 'bg-white/80 border-zinc-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]'}`}>
                <button onClick={() => onDelete(m.id)} className="absolute top-6 right-6 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all z-20"><Trash2 size={16}/></button>
                
                <div className="flex items-center justify-between mb-2 pr-6">
                  <h3 className={`font-bold tracking-tight text-lg ${needsMaintenance ? 'text-red-900' : 'text-zinc-900'}`}>{m.name}</h3>
                  {isPaidOff && !needsMaintenance && <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md">Paid Off</span>}
                  {needsMaintenance && <span className="bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md animate-pulse">Service Req</span>}
                </div>
                <div className={`text-xs font-medium mb-6 border-b pb-4 ${needsMaintenance ? 'text-red-700/70 border-red-200/60' : 'text-zinc-400 border-zinc-100'}`}>Acquired: {m.date} for {formatCurrency(m.cost)}</div>
                
                <div className="mb-6">
                  <div className={`flex justify-between text-[10px] font-bold uppercase tracking-widest mb-2 ${needsMaintenance ? 'text-red-800/60' : 'text-zinc-500'}`}>
                    <span>Assigned Profit</span>
                    <span className={isPaidOff ? 'text-emerald-500' : (needsMaintenance ? 'text-red-700' : 'text-zinc-700')}>{formatCurrency(profitPerMachine)}</span>
                  </div>
                  <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ease-out ${isPaidOff ? 'bg-emerald-400' : 'bg-zinc-900'}`} style={{ width: `${percentPaid}%` }}></div>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className={`text-xs font-semibold ${needsMaintenance ? 'text-red-700/60' : 'text-zinc-400'}`}>{percentPaid.toFixed(0)}% ROI</span>
                    {isPaidOff && <span className="text-xs font-bold text-emerald-600 tracking-tight">Paid for {roiRatio.toFixed(1)}x over</span>}
                  </div>
                </div>

                <div className={`mt-auto rounded-xl p-4 flex flex-col border ${needsMaintenance ? 'bg-red-50 border-red-200/60' : 'bg-zinc-50 border-zinc-100/80'}`}>
                  <div className="flex justify-between items-center mb-3">
                    <div className={`flex items-center ${needsMaintenance ? 'text-red-800' : 'text-zinc-500'}`}>
                      <Settings size={14} className={`mr-2 ${needsMaintenance ? 'animate-[spin_4s_linear_infinite]' : ''}`} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Maint. Odometer</span>
                    </div>
                    <span className={`text-sm font-bold tracking-tight ${needsMaintenance ? 'text-red-700' : 'text-zinc-800'}`}>{hoursSinceMaintenance.toFixed(1)} / 300h</span>
                  </div>
                  
                  <div className="w-full bg-zinc-200/80 rounded-full h-1.5 overflow-hidden mb-3">
                    <div className={`h-full rounded-full transition-all duration-500 ${needsMaintenance ? 'bg-red-500' : (maintPercent > 80 ? 'bg-amber-400' : 'bg-blue-500')}`} style={{ width: `${Math.min(100, maintPercent)}%` }}></div>
                  </div>

                  {needsMaintenance && (
                    <button onClick={() => handleResetMaintenance(m)} className="w-full mt-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold uppercase tracking-widest py-2.5 rounded-lg transition-colors shadow-sm">
                      Log Service & Reset
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-zinc-50/50 rounded-3xl border border-dashed border-zinc-200 p-8 flex flex-col justify-center transition-all hover:bg-zinc-50 hover:border-solid max-w-md mt-6">
        <h3 className="font-bold text-zinc-700 tracking-tight mb-4 flex items-center"><Plus size={16} className="mr-2"/> Register Asset</h3>
        <form onSubmit={addRow} className="space-y-3">
          <input type="date" className={inlineInputStyle} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
          <input type="text" placeholder="Asset Name (e.g. Bambu P1S)" className={inlineInputStyle} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          <input type="number" step="0.01" placeholder="Purchase Cost ($)" className={inlineInputStyle} value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} required />
          <button type="submit" className="w-full bg-zinc-800 hover:bg-zinc-900 text-white font-semibold py-2 px-4 rounded-lg transition-all mt-2 text-sm shadow-sm">Save Hardware</button>
        </form>
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
    <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-zinc-100 p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)] flex flex-col justify-center relative group hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all">
      <div className="absolute top-6 right-6">
        {!isEditing && <button onClick={() => setIsEditing(true)} className="text-zinc-300 hover:text-zinc-900 transition-colors p-1 opacity-0 group-hover:opacity-100" title="Edit Initial Goal"><Edit2 size={16} /></button>}
      </div>
      <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Remaining to Recoup</h3>
      <div className="text-3xl sm:text-4xl font-bold tracking-tighter text-zinc-900 mb-2">
        <AnimatedNumber value={remainingToRecoup} formatCurrency={formatCurrency} />
      </div>
      <div className="w-full bg-zinc-100 rounded-full h-1.5 mt-5 overflow-hidden"><div className="bg-zinc-900 h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${percentComplete}%` }}></div></div>
      {isEditing ? (
        <div className="flex items-center space-x-3 mt-5 bg-zinc-50 p-2 rounded-xl border border-zinc-200">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest ml-2">Goal $</span>
          <input type="number" className="border-none bg-transparent w-24 text-sm font-semibold outline-none text-zinc-900" value={tempGoal} onChange={(e) => setTempGoal(e.target.value)} />
          <button onClick={handleSave} className="bg-zinc-900 text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"><Check size={14} /></button>
        </div>
      ) : <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mt-4">{percentComplete.toFixed(0)}% to {formatCurrency(initialGoal)} goal</p>}
    </div>
  );
}

function DashboardCard({ title, amount, subtitle, color, isNegative, highlight, formatCurrency }) {
  const colorMap = { blue: 'text-blue-600', red: 'text-zinc-900', emerald: 'text-emerald-600', zinc: 'text-zinc-900', indigo: 'text-zinc-900' };
  return (
    <div className={`bg-white/80 backdrop-blur-md rounded-3xl p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] ${highlight ? 'ring-1 ring-zinc-200/60' : 'border border-zinc-100'}`}>
      <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">{title}</h3>
      <div className={`text-3xl sm:text-4xl font-bold tracking-tighter mt-3 ${colorMap[color] || 'text-zinc-900'}`}>
        {isNegative && amount > 0 ? '-' : ''}
        <AnimatedNumber value={amount} formatCurrency={formatCurrency} />
      </div>
      <p className="text-sm font-medium text-zinc-400 mt-2">{subtitle}</p>
    </div>
  );
}

function RevenueLog({ revenues, costPerTrainer, onAdd, onUpdate, onDelete, formatCurrency }) {
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], orderNum: '', desc: '', qty: 1, gross: '', salesTax: '', ebay: '', ad: '', shipping: '', state: '' });
  const [importPreview, setImportPreview] = useState(null);
  const [importStats, setImportStats] = useState({ total: 0, unchanged: 0, updated: 0, new: 0 });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showFees, setShowFees] = useState(false);
  const fileInputRef = useRef(null);

  const enrichedRevenues = useMemo(() => revenues.map(r => {
    const net = Number(r.gross) - Number(r.ebay || 0) - Number(r.ad || 0) - Number(r.shipping || 0) - Number(r.salesTax || 0);
    const qty = Number(r.qty || 1);
    const trueProfit = net - (costPerTrainer * qty);
    const margin = Number(r.gross) > 0 ? (trueProfit / Number(r.gross)) * 100 : 0;
    return { ...r, qty, net, trueProfit, margin };
  }), [revenues, costPerTrainer]);

  const { items: sortedRevenues, requestSort, sortConfig } = useSortableData(enrichedRevenues);

  const addRow = (e) => { 
    e.preventDefault(); 
    if (!formData.gross) return; 
    onAdd(formData); 
    setFormData({ date: new Date().toISOString().split('T')[0], orderNum: '', desc: '', qty: 1, gross: '', salesTax: '', ebay: '', ad: '', shipping: '', state: '' }); 
    setShowFees(false);
  };
  const startEdit = (item) => { setEditingId(item.id); setEditForm({ ...item }); };
  const saveEdit = () => { onUpdate(editingId, editForm); setEditingId(null); };
  const handleExport = () => {
    const headers = ['Date', 'Order #', 'State', 'Description', 'Qty', 'Total Paid (Gross)', 'Sales Tax', 'eBay Fee', 'Ad Fee', 'Shipping', 'Net Payout', 'True Profit', 'Margin %'];
    const data = sortedRevenues.map(r => [r.date, r.orderNum, r.state, r.desc, r.qty, r.gross, r.salesTax || 0, r.ebay || 0, r.ad || 0, r.shipping || 0, r.net, r.trueProfit, r.margin.toFixed(1)]);
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
      
      while(headerIdx < parsed.length && (!parsed[headerIdx] || !parsed[headerIdx].some(h => h && (h.includes('Order Number') || h.includes('Order number'))))) {
        headerIdx++;
      }
      
      if (headerIdx >= parsed.length) { 
        alert("Could not find 'Order Number' header in this CSV."); 
        return; 
      }
      
      const headers = parsed[headerIdx];
      const findHeader = (str) => headers.findIndex(h => h && h.toLowerCase().includes(str.toLowerCase()));
      
      const dateIdx = findHeader('Transaction creation date') > -1 ? findHeader('Transaction creation date') : findHeader('Sale Date'); 
      const orderIdx = findHeader('Order number');
      const typeIdx = findHeader('Type'); 
      const titleIdx = findHeader('Item title'); 
      const qtyIdx = findHeader('Quantity');
      const stateIdx = findHeader('Ship to province/region/state') > -1 ? findHeader('Ship to province/region/state') : findHeader('Ship to State');
      const taxIdx = headers.findIndex(h => h && (h.toLowerCase().includes('sales tax') || h.toLowerCase().includes('ebay collected tax')));
      
      let grossIdx = findHeader('Gross transaction amount');
      if (grossIdx === -1) grossIdx = findHeader('Total Paid');
      if (grossIdx === -1) grossIdx = findHeader('Total Price');
      const soldForIdx = findHeader('Sold For');
      const shipHandIdx = findHeader('Shipping And Handling');
      const netIdx = findHeader('Net amount');
      const descColIdx = findHeader('Description');

      const feeIndices = new Set();
      headers.forEach((h, idx) => {
        const headerStr = (h || '').toLowerCase();
        if (headerStr.includes('fee') || headerStr.includes('final value')) {
          feeIndices.add(idx);
        }
      });
      
      const specificFeeCols = ['Final Value Fee - variable', 'Final Value Fee - fixed', 'Regulatory operating fee', 'International fee'];
      specificFeeCols.forEach(feeName => {
         const idx = findHeader(feeName);
         if (idx > -1) feeIndices.add(idx);
      });

      const months = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
      
      const ordersMap = new Map();

      for (let i = headerIdx + 1; i < parsed.length; i++) {
        const row = parsed[i];
        if (row.length < headers.length) continue;
        
        let orderNum = row[orderIdx] ? row[orderIdx].trim() : '';
        if (!orderNum || orderNum.startsWith('--')) {
           const refIdx = findHeader('Reference ID');
           let refId = refIdx > -1 ? row[refIdx] : '';
           if (refId && refId !== '--') orderNum = refId;
           else orderNum = 'Misc-' + i;
        }

        const type = typeIdx > -1 ? (row[typeIdx] || '').toLowerCase() : 'order';
        if (type === 'payout' || type === 'transfer') continue; 
        
        if (!ordersMap.has(orderNum)) {
          ordersMap.set(orderNum, {
            orderNum: orderNum.startsWith('Misc-') ? '' : orderNum, 
            date: '', desc: '', state: '', qty: 0, gross: 0, salesTax: 0, ebay: 0, ad: 0, shipping: 0
          });
        }
        
        const rec = ordersMap.get(orderNum);
        
        const cleanNum = (val) => {
          if (!val) return 0;
          if (typeof val === 'number') return val;
          let str = val.toString().trim();
          if (str === '--' || str === '-' || str === '') return 0;
          const isNegative = str.startsWith('-') || (str.startsWith('(') && str.endsWith(')'));
          const cleaned = str.replace(/[^0-9.]/g, '');
          const num = parseFloat(cleaned);
          if (isNaN(num)) return 0;
          return isNegative ? -num : num;
        };
        
        let rawGross = grossIdx > -1 ? cleanNum(row[grossIdx]) : (soldForIdx > -1 ? cleanNum(row[soldForIdx]) + (shipHandIdx > -1 ? cleanNum(row[shipHandIdx]) : 0) : 0);
        let rawTax = taxIdx > -1 ? cleanNum(row[taxIdx]) : 0;
        let rawNet = netIdx > -1 ? cleanNum(row[netIdx]) : 0;
        let rowQty = qtyIdx > -1 ? cleanNum(row[qtyIdx]) : 0;
        
        let sumFees = 0;
        feeIndices.forEach(idx => sumFees += Math.abs(cleanNum(row[idx])));

        const desc = descColIdx > -1 ? (row[descColIdx] || '').trim() : '';
        const title = titleIdx > -1 ? (row[titleIdx] || '').trim() : '';
        
        const cleanTitle = title === '--' ? '' : title;
        const cleanDesc = desc === '--' ? '' : desc;

        let isFinancialGross = headers[grossIdx] && headers[grossIdx].toLowerCase() === 'gross transaction amount';
        let adjustedGross = isFinancialGross ? rawGross + rawTax : rawGross;

        if (type.includes('order') || type === 'sale' || !rec.date) {
          if (row[dateIdx] && !rec.date && row[dateIdx] !== '--') {
            const rawDate = row[dateIdx];
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
               rec.date = d.toLocaleDateString('en-CA');
            } else {
               const parts = rawDate.split('-');
               if (parts.length === 3) rec.date = `20${parts[2]}-${months[parts[0]] || '01'}-${parts[1].padStart(2, '0')}`;
               else rec.date = rawDate;
            }
          }
          if (cleanTitle && (!rec.desc || rec.desc === 'eBay Sale' || rec.desc.startsWith('Shipping') || rec.desc.startsWith('Ad') || rec.desc === '--')) {
              rec.desc = cleanTitle;
          }
          if (stateIdx > -1 && row[stateIdx] && row[stateIdx] !== '--' && !rec.state) {
              rec.state = row[stateIdx].toUpperCase().trim();
          }
          if (rowQty > 0 && (type.includes('order') || type === 'sale')) rec.qty += rowQty;
        }

        if (type.includes('shipping label')) {
          rec.shipping += Math.abs(rawNet || rawGross);
          if(!rec.desc || rec.desc === '--') rec.desc = 'Shipping Label';
        } else if (type.includes('other fee') || type.includes('ad fee') || cleanDesc.toLowerCase().includes('promoted')) {
          rec.ad += Math.abs(rawNet || sumFees || rawGross);
          if(!rec.desc || rec.desc === '--') rec.desc = 'Ad Fee / Other';
        } else if (type.includes('refund')) {
          rec.gross += adjustedGross; 
          rec.salesTax -= Math.abs(rawTax);
          rec.ebay -= Math.abs(sumFees); 
        } else {
          rec.gross += adjustedGross;
          rec.salesTax += Math.abs(rawTax); 
          rec.ebay += Math.abs(sumFees); 
          if (!rec.desc || rec.desc === 'Shipping Label' || rec.desc === 'Ad Fee / Other' || rec.desc === '--') {
             rec.desc = cleanTitle || cleanDesc || 'eBay Sale';
          }
        }
      }

      const newRows = [];
      let unchangedCount = 0;
      let updatedCount = 0;

      let index = 0;
      for (const [orderNum, rec] of ordersMap.entries()) {
        const existingRecord = revenues.find(r => r.orderNum === orderNum);
        
        if (existingRecord) {
          let needsUpdate = false;
          let updates = {};
          
          if (rec.gross !== 0 && Number(existingRecord.gross || 0) !== Number(rec.gross.toFixed(2))) { updates.gross = rec.gross.toFixed(2); needsUpdate = true; }
          if (rec.salesTax !== 0 && Number(existingRecord.salesTax || 0) !== Number(rec.salesTax.toFixed(2))) { updates.salesTax = rec.salesTax.toFixed(2); needsUpdate = true; }
          if (rec.ebay !== 0 && Number(existingRecord.ebay || 0) !== Number(rec.ebay.toFixed(2))) { updates.ebay = rec.ebay.toFixed(2); needsUpdate = true; }
          if (rec.ad !== 0 && Number(existingRecord.ad || 0) !== Number(rec.ad.toFixed(2))) { updates.ad = rec.ad.toFixed(2); needsUpdate = true; }
          if (rec.shipping !== 0 && Number(existingRecord.shipping || 0) !== Number(rec.shipping.toFixed(2))) { updates.shipping = rec.shipping.toFixed(2); needsUpdate = true; }
          if (rec.state && existingRecord.state !== rec.state) { updates.state = rec.state; needsUpdate = true; }
          if (rec.qty > 0 && Number(existingRecord.qty || 1) !== rec.qty) { updates.qty = rec.qty; needsUpdate = true; }
          if (rec.desc && rec.desc !== 'eBay Sale' && existingRecord.desc !== rec.desc) { updates.desc = rec.desc; needsUpdate = true; }

          if (needsUpdate) {
            newRows.push({ ...existingRecord, ...updates, isUpdate: true });
            updatedCount++;
          } else {
            unchangedCount++;
          }
          continue;
        }

        newRows.push({ 
          id: Date.now() + index++, 
          date: rec.date, 
          orderNum: rec.orderNum, 
          desc: rec.desc || 'eBay Sale', 
          state: rec.state,
          qty: rec.qty || 1,
          gross: rec.gross.toFixed(2), 
          salesTax: rec.salesTax.toFixed(2), 
          ebay: rec.ebay > 0 ? rec.ebay.toFixed(2) : '', 
          ad: rec.ad > 0 ? rec.ad.toFixed(2) : '', 
          shipping: rec.shipping > 0 ? rec.shipping.toFixed(2) : '',
          isUpdate: false
        });
      }
      
      setImportStats({ total: ordersMap.size, unchanged: unchangedCount, updated: updatedCount, new: newRows.filter(r => !r.isUpdate).length });
      setImportPreview(newRows);
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const confirmImport = () => { 
    importPreview.forEach(r => { 
      const payload = { ...r };
      delete payload.isUpdate;
      delete payload.net;
      delete payload.trueProfit;
      delete payload.margin;

      if (r.isUpdate) {
        onUpdate(r.id, payload);
      } else {
        onAdd(payload); 
      }
    }); 
    setImportPreview(null); 
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      {importPreview && (
        <div className="fixed inset-0 bg-zinc-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-spring-in border border-zinc-200/50">
            <div className="p-8 border-b border-zinc-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-zinc-900">Review Import & Overwrites</h2>
                <p className="text-sm text-zinc-500 mt-1">
                  Found <strong className="text-emerald-600">{importStats.new} new</strong> sales and <strong className="text-amber-500">{importStats.updated} updates</strong> to existing records. Skipped {importStats.unchanged} fully matched orders.
                </p>
              </div>
              <button onClick={() => setImportPreview(null)} className="text-zinc-400 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 p-2 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto p-8 bg-[#fbfbfd] flex-1">
              <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-zinc-50 border-b border-zinc-100">
                    <tr><th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Date</th><th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Order</th><th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400 w-1/4">Item</th><th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400 text-center">Qty</th><th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400 text-right">Total Paid</th><th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400 text-right">Tax</th><th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">eBay Fee $</th><th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Ad Fee $</th><th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Ship $</th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {importPreview.length === 0 ? (
                      <tr><td colSpan="9" className="p-8 text-center text-zinc-500 font-medium">No updates or new records needed. Ledger is perfectly in sync!</td></tr>
                    ) : (
                      importPreview.map(r => (
                        <tr key={r.id} className="hover:bg-zinc-50/50">
                          <td className="px-6 py-3 font-medium text-zinc-500">{r.date}</td>
                          <td className="px-6 py-3 font-mono text-[11px] text-zinc-500 flex items-center">
                            {r.isUpdate ? (
                              <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded mr-2 font-bold text-[9px] shadow-sm">OVERWRITE</span>
                            ) : (
                              <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded mr-2 font-bold text-[9px] shadow-sm">NEW</span>
                            )}
                            {r.orderNum}
                          </td>
                          <td className="px-6 py-3 truncate max-w-xs font-medium text-zinc-900" title={r.desc}>{r.desc}</td>
                          <td className="px-6 py-3 text-center font-bold text-zinc-900">{r.qty}</td>
                          <td className="px-6 py-3 text-right font-semibold">{formatCurrency(r.gross)}</td>
                          <td className="px-6 py-3 text-right font-medium text-zinc-500">{formatCurrency(r.salesTax)}</td>
                          <td className="px-3 py-2"><input type="number" step="0.01" className="w-20 bg-zinc-50 border border-zinc-200 rounded-lg p-2 outline-none focus:border-zinc-900 focus:bg-white text-sm" value={r.ebay} onChange={e => setImportPreview(prev => prev.map(pr => pr.id === r.id ? { ...pr, ebay: e.target.value } : pr))}/></td>
                          <td className="px-3 py-2"><input type="number" step="0.01" className="w-20 bg-zinc-50 border border-zinc-200 rounded-lg p-2 outline-none focus:border-zinc-900 focus:bg-white text-sm" value={r.ad} onChange={e => setImportPreview(prev => prev.map(pr => pr.id === r.id ? { ...pr, ad: e.target.value } : pr))}/></td>
                          <td className="px-3 py-2"><input type="number" step="0.01" className="w-20 bg-zinc-50 border border-zinc-200 rounded-lg p-2 outline-none focus:border-zinc-900 focus:bg-white text-sm" value={r.shipping} onChange={e => setImportPreview(prev => prev.map(pr => pr.id === r.id ? { ...pr, shipping: e.target.value } : pr))}/></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-6 border-t border-zinc-100 bg-white flex justify-end space-x-3">
              <button onClick={() => setImportPreview(null)} className="px-6 py-3 rounded-xl text-zinc-500 hover:bg-zinc-100 font-semibold transition-colors">Cancel</button>
              <button onClick={confirmImport} disabled={importPreview.length === 0} className="px-8 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white font-semibold flex items-center transition-all hover:-translate-y-0.5 shadow-md">
                <Check size={18} className="mr-2"/> Save {importPreview.length} Records
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-zinc-100 p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)]">
        <h2 className="text-lg font-bold tracking-tight text-zinc-900 mb-6">Log Manual Sale</h2>
        <form onSubmit={addRow} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-4 items-end">
          <input type="date" className={`${inlineInputStyle} col-span-1`} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required title="Date" />
          <input type="text" placeholder="Order #" className={`${inlineInputStyle} col-span-1`} value={formData.orderNum} onChange={e => setFormData({...formData, orderNum: e.target.value})} />
          <input type="text" maxLength="2" placeholder="State (AZ)" className={`${inlineInputStyle} col-span-1`} value={formData.state} onChange={e => setFormData({...formData, state: e.target.value.toUpperCase()})} />
          <input type="text" placeholder="Description" className={`${inlineInputStyle} col-span-1`} value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} required />
          <input type="number" step="0.01" placeholder="Total Paid ($)" className={`${inlineInputStyle} col-span-1`} value={formData.gross} onChange={e => setFormData({...formData, gross: e.target.value})} required />
          
          {!showFees ? (
            <div className="lg:col-span-3 flex items-center w-full">
              <button type="button" onClick={() => setShowFees(true)} className="w-full py-2 border border-dashed border-zinc-200 rounded-lg text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 transition-all flex justify-center items-center">
                <Plus size={14} className="mr-1.5" /> Add Tax, Fees, Ship
              </button>
            </div>
          ) : (
            <div className="lg:col-span-3 grid grid-cols-4 gap-2">
              <input type="number" step="0.01" placeholder="Tax" className={`${inlineInputStyle} animate-in fade-in zoom-in-95 px-2`} value={formData.salesTax} onChange={e => setFormData({...formData, salesTax: e.target.value})} />
              <input type="number" step="0.01" placeholder="eBay" className={`${inlineInputStyle} animate-in fade-in zoom-in-95 px-2`} value={formData.ebay} onChange={e => setFormData({...formData, ebay: e.target.value})} />
              <input type="number" step="0.01" placeholder="Ad" className={`${inlineInputStyle} animate-in fade-in zoom-in-95 px-2`} value={formData.ad} onChange={e => setFormData({...formData, ad: e.target.value})} />
              <input type="number" step="0.01" placeholder="Ship" className={`${inlineInputStyle} animate-in fade-in zoom-in-95 px-2`} value={formData.shipping} onChange={e => setFormData({...formData, shipping: e.target.value})} />
            </div>
          )}

          <button type="submit" className="lg:col-span-8 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center transition-all hover:-translate-y-0.5 shadow-md mt-2"><Plus size={18} className="mr-2" /> Add Record</button>
        </form>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-zinc-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)] overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h3 className="font-bold tracking-tight text-zinc-900 text-lg">Sales Ledger</h3>
            <p className="text-xs font-medium text-zinc-400 mt-1 uppercase tracking-widest">COGS Model: {formatCurrency(costPerTrainer)}</p>
          </div>
          <div className="flex space-x-3">
            <input type="file" accept=".csv" id="csv-upload" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            <button onClick={() => fileInputRef.current.click()} className="text-[11px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-900 flex items-center transition-colors bg-zinc-50 border border-zinc-200 px-4 py-2 rounded-full hover:bg-zinc-100"><Upload size={14} className="mr-2" /> Import CSV</button>
            <button onClick={handleExport} className="text-[11px] font-bold uppercase tracking-widest text-blue-600 hover:text-blue-800 flex items-center transition-colors bg-blue-50 border border-blue-100 px-4 py-2 rounded-full hover:bg-blue-100"><Download size={14} className="mr-2" /> Export</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-50/50 border-b border-zinc-100">
              <tr>
                <SortableHeader label="Date" sortKey="date" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Order" sortKey="orderNum" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="ST" sortKey="state" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Description" sortKey="desc" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Qty" sortKey="qty" currentSort={sortConfig} requestSort={requestSort} alignRight />
                <SortableHeader label="Total Paid" sortKey="gross" currentSort={sortConfig} requestSort={requestSort} alignRight />
                <SortableHeader label="Fees/Tax/Ship" sortKey="ebay" currentSort={sortConfig} requestSort={requestSort} alignRight textColor="text-zinc-400" />
                <SortableHeader label="Net" sortKey="net" currentSort={sortConfig} requestSort={requestSort} alignRight textColor="text-blue-600" />
                <SortableHeader label="True Profit" sortKey="trueProfit" currentSort={sortConfig} requestSort={requestSort} alignRight textColor="text-emerald-600" />
                <SortableHeader label="Margin" sortKey="margin" currentSort={sortConfig} requestSort={requestSort} alignRight textColor="text-emerald-600" />
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {sortedRevenues.length === 0 ? (
                <EmptyState icon={Inbox} title="No sales logged yet" message="Log your first sale manually or import an eBay CSV to unlock unit economics." colSpan="11" />
              ) : sortedRevenues.map(r => {
                const totalFees = Number(r.ebay || 0) + Number(r.ad || 0) + Number(r.shipping || 0) + Number(r.salesTax || 0);
                return editingId === r.id ? (
                  <tr key={r.id} className="bg-blue-50/30">
                    <td className="px-2 py-2"><input type="date" className={inlineInputStyle} value={editForm.date} onChange={ev => setEditForm({...editForm, date: ev.target.value})} /></td>
                    <td className="px-2 py-2"><input type="text" className={`${inlineInputStyle} w-20`} value={editForm.orderNum} onChange={ev => setEditForm({...editForm, orderNum: ev.target.value})} /></td>
                    <td className="px-2 py-2"><input type="text" maxLength="2" className={`${inlineInputStyle} w-12`} value={editForm.state} onChange={ev => setEditForm({...editForm, state: ev.target.value.toUpperCase()})} /></td>
                    <td className="px-2 py-2"><input type="text" className={inlineInputStyle} value={editForm.desc} onChange={ev => setEditForm({...editForm, desc: ev.target.value})} /></td>
                    <td className="px-2 py-2"><input type="number" min="1" className={`${inlineInputStyle} w-16 text-center`} value={editForm.qty} onChange={ev => setEditForm({...editForm, qty: ev.target.value})} /></td>
                    <td className="px-2 py-2"><input type="number" step="0.01" className={`${inlineInputStyle} w-20`} value={editForm.gross} onChange={ev => setEditForm({...editForm, gross: ev.target.value})} /></td>
                    <td className="px-2 py-2 flex space-x-1">
                      <input type="number" step="0.01" className={`${inlineInputStyle} w-14 px-1`} placeholder="Tax" title="Sales Tax" value={editForm.salesTax} onChange={ev => setEditForm({...editForm, salesTax: ev.target.value})} />
                      <input type="number" step="0.01" className={`${inlineInputStyle} w-14 px-1`} placeholder="eBay" title="eBay Fee" value={editForm.ebay} onChange={ev => setEditForm({...editForm, ebay: ev.target.value})} />
                      <input type="number" step="0.01" className={`${inlineInputStyle} w-14 px-1`} placeholder="Ad" title="Ad Fee" value={editForm.ad} onChange={ev => setEditForm({...editForm, ad: ev.target.value})} />
                      <input type="number" step="0.01" className={`${inlineInputStyle} w-14 px-1`} placeholder="Ship" title="Shipping" value={editForm.shipping} onChange={ev => setEditForm({...editForm, shipping: ev.target.value})} />
                    </td>
                    <td className="px-6 py-4 text-right text-zinc-300">-</td>
                    <td className="px-6 py-4 text-right text-zinc-300">-</td>
                    <td className="px-6 py-4 text-right text-zinc-300">-</td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-700 p-1 bg-emerald-50 rounded"><Check size={16}/></button>
                      <button onClick={() => setEditingId(null)} className="text-zinc-400 hover:text-zinc-600 p-1 bg-zinc-100 rounded"><X size={16}/></button>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-zinc-500">{r.date}</td>
                    <td className="px-6 py-4 text-zinc-400 font-mono text-[10px] tracking-wider">{r.orderNum || '-'}</td>
                    <td className="px-6 py-4 font-bold text-zinc-900 text-xs">{r.state || '-'}</td>
                    <td className="px-6 py-4 truncate max-w-[200px] font-semibold text-zinc-800" title={r.desc}>{r.desc}</td>
                    <td className="px-6 py-4 text-center font-bold text-zinc-900">{r.qty}</td>
                    <td className="px-6 py-4 text-right font-medium text-zinc-600">{formatCurrency(r.gross)}</td>
                    <td className="px-6 py-4 text-right text-zinc-400" title={`Tax: ${formatCurrency(r.salesTax || 0)} | eBay: ${formatCurrency(r.ebay || 0)} | Ad: ${formatCurrency(r.ad || 0)} | Ship: ${formatCurrency(r.shipping || 0)}`}>{formatCurrency(totalFees)}</td>
                    <td className="px-6 py-4 text-right font-semibold text-blue-600">{formatCurrency(r.net)}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600 tracking-tight">{formatCurrency(r.trueProfit)}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600 tracking-tight">{r.margin.toFixed(0)}%</td>
                    <td className="px-6 py-4 text-right space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(r)} className="text-zinc-400 hover:text-zinc-900"><Edit2 size={16} /></button>
                      <button onClick={() => onDelete(r.id)} className="text-zinc-300 hover:text-red-500"><Trash2 size={16} /></button>
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
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], desc: '', category: 'Supplies', amount: '' });
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
    setFormData({ date: new Date().toISOString().split('T')[0], desc: '', category: 'Supplies', amount: '' }); 
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
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-zinc-100 p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)]">
        <h2 className="text-lg font-bold tracking-tight text-zinc-900 mb-6">Log Expense</h2>
        <form onSubmit={addRow} className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          <input type="date" className={`${inlineInputStyle} col-span-1`} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
          <input type="text" placeholder="Description" className={`${inlineInputStyle} col-span-1`} value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} required />
          <select className={`${inlineInputStyle} col-span-1`} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
          <input type="number" step="0.01" placeholder="Amount ($)" className={`${inlineInputStyle} col-span-1`} value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required />
          <input type="file" accept="image/*,application/pdf" onChange={e => setFile(e.target.files[0])} className="col-span-1 text-[10px] uppercase font-bold tracking-wider text-zinc-500 file:mr-2 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-[10px] file:uppercase file:tracking-wider file:font-bold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 transition-colors cursor-pointer" />
          <button type="submit" disabled={isUploading} className="sm:col-span-5 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white font-semibold py-3.5 px-4 rounded-xl flex items-center justify-center transition-all hover:-translate-y-0.5 mt-2 shadow-md">
             {isUploading ? <><Loader2 size={18} className="animate-spin mr-2"/> Uploading Receipt...</> : <><Plus size={18} className="mr-2" /> Save Expense</>}
          </button>
        </form>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-zinc-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)] overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
          <h3 className="font-bold tracking-tight text-zinc-900 text-lg">Audit-Proof Ledger</h3>
          <button onClick={handleExport} className="text-[11px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-900 flex items-center transition-colors bg-zinc-50 border border-zinc-200 px-4 py-2 rounded-full hover:bg-zinc-100"><Download size={14} className="mr-2" /> Export</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-50/50 border-b border-zinc-100">
              <tr>
                <SortableHeader label="Date" sortKey="date" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Description" sortKey="desc" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Category" sortKey="category" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Amount" sortKey="amount" currentSort={sortConfig} requestSort={requestSort} alignRight />
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-zinc-400 text-center select-none">Receipt</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {sortedExpenses.length === 0 ? (
                <EmptyState icon={Receipt} title="No expenses logged" message="Log your first expense to activate tax tracking and secure digital receipts." colSpan="6" />
              ) : sortedExpenses.map(e => (
                editingId === e.id ? (
                  <tr key={e.id} className="bg-blue-50/30">
                    <td className="px-3 py-2"><input type="date" className={inlineInputStyle} value={editForm.date} onChange={ev => setEditForm({...editForm, date: ev.target.value})} /></td>
                    <td className="px-3 py-2"><input type="text" className={inlineInputStyle} value={editForm.desc} onChange={ev => setEditForm({...editForm, desc: ev.target.value})} /></td>
                    <td className="px-3 py-2">
                      <select className={inlineInputStyle} value={editForm.category} onChange={ev => setEditForm({...editForm, category: ev.target.value})}>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2"><input type="number" step="0.01" className={inlineInputStyle} value={editForm.amount} onChange={ev => setEditForm({...editForm, amount: ev.target.value})} /></td>
                    <td className="px-6 py-4 text-center text-zinc-300">-</td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-700 p-1 bg-emerald-50 rounded"><Check size={16}/></button>
                      <button onClick={() => setEditingId(null)} className="text-zinc-400 hover:text-zinc-600 p-1 bg-zinc-100 rounded"><X size={16}/></button>
                    </td>
                  </tr>
                ) : (
                  <tr key={e.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-zinc-500">{e.date}</td>
                    <td className="px-6 py-4 font-semibold text-zinc-800">{e.desc}</td>
                    <td className="px-6 py-4"><span className="px-3 py-1 bg-zinc-100 rounded-lg text-[10px] font-bold uppercase tracking-wider text-zinc-600 border border-zinc-200/60">{e.category}</span></td>
                    <td className="px-6 py-4 text-right font-semibold text-zinc-900 tracking-tight">{formatCurrency(e.amount)}</td>
                    <td className="px-6 py-4 text-center">
                      {e.receiptUrl ? (
                        <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center p-2 bg-zinc-100 text-zinc-700 rounded-xl hover:bg-zinc-200 hover:text-zinc-900 transition-colors" title="View Receipt">
                          <ImageIcon size={14} />
                        </a>
                      ) : <span className="text-zinc-300">-</span>}
                    </td>
                    <td className="px-6 py-4 text-right space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(e)} className="text-zinc-400 hover:text-zinc-900"><Edit2 size={16}/></button>
                      <button onClick={() => onDelete(e.id)} className="text-zinc-300 hover:text-red-500"><Trash2 size={16}/></button>
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
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], desc: '', category: 'Recoup Investment', amount: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const categories = ['Recoup Investment', 'Golf Fund', 'Amex Transfer (Op Cash)', 'Other Draw'];
  const { items: sortedEquities, requestSort, sortConfig } = useSortableData(equities);

  const addRow = (e) => { e.preventDefault(); onAdd(formData); setFormData({ date: new Date().toISOString().split('T')[0], desc: '', category: 'Recoup Investment', amount: '' }); };
  const startEdit = (item) => { setEditingId(item.id); setEditForm({ ...item, category: item.category || 'Recoup Investment' }); };
  const saveEdit = () => { onUpdate(editingId, editForm); setEditingId(null); };

  const handleExport = () => {
    const headers = ['Date', 'Description', 'Category', 'Amount'];
    const data = sortedEquities.map(e => [e.date, e.desc, e.category || 'Recoup Investment', e.amount]);
    exportToCsv('Apex_Payouts_Transfers.csv', [headers, ...data]);
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-zinc-100 p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)]">
        <h2 className="text-lg font-bold tracking-tight text-zinc-900 mb-6">Record Transfer</h2>
        <form onSubmit={addRow} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <input type="date" className={inlineInputStyle} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
          <input type="text" placeholder="Description (e.g. Owner Draw)" className={inlineInputStyle} value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} required />
          <select className={inlineInputStyle} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" step="0.01" placeholder="Amount ($)" className={inlineInputStyle} value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required />
          <button type="submit" className="sm:col-span-4 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center transition-all hover:-translate-y-0.5 mt-2 shadow-md"><Plus size={18} className="mr-2" /> Log Transaction</button>
        </form>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-zinc-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)] overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
          <h3 className="font-bold tracking-tight text-zinc-900 text-lg">Transaction History</h3>
          <button onClick={handleExport} className="text-[11px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-900 flex items-center transition-colors bg-zinc-50 border border-zinc-200 px-4 py-2 rounded-full hover:bg-zinc-100"><Download size={14} className="mr-2" /> Export</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-50/50 border-b border-zinc-100">
              <tr>
                <SortableHeader label="Date" sortKey="date" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Description" sortKey="desc" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Category" sortKey="category" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Amount" sortKey="amount" currentSort={sortConfig} requestSort={requestSort} alignRight />
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {sortedEquities.length === 0 ? (
                <EmptyState icon={Wallet} title="No transfers found" message="Log owner draws or operational bank transfers here." colSpan="5" />
              ) : sortedEquities.map(e => (
                editingId === e.id ? (
                  <tr key={e.id} className="bg-blue-50/30">
                    <td className="px-3 py-2"><input type="date" className={inlineInputStyle} value={editForm.date} onChange={ev => setEditForm({...editForm, date: ev.target.value})} /></td>
                    <td className="px-3 py-2"><input type="text" className={inlineInputStyle} value={editForm.desc} onChange={ev => setEditForm({...editForm, desc: ev.target.value})} /></td>
                    <td className="px-3 py-2">
                      <select className={inlineInputStyle} value={editForm.category} onChange={ev => setEditForm({...editForm, category: ev.target.value})}>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2"><input type="number" step="0.01" className={inlineInputStyle} value={editForm.amount} onChange={ev => setEditForm({...editForm, amount: ev.target.value})} /></td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-700 p-1 bg-emerald-50 rounded"><Check size={16}/></button>
                      <button onClick={() => setEditingId(null)} className="text-zinc-400 hover:text-zinc-600 p-1 bg-zinc-100 rounded"><X size={16}/></button>
                    </td>
                  </tr>
                ) : (
                  <tr key={e.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-zinc-500">{e.date}</td>
                    <td className="px-6 py-4 font-semibold text-zinc-800">{e.desc}</td>
                    <td className="px-6 py-4"><span className="px-3 py-1 bg-zinc-100 rounded-lg text-[10px] font-bold uppercase tracking-wider text-zinc-600 border border-zinc-200/60">{e.category || 'Recoup Investment'}</span></td>
                    <td className="px-6 py-4 text-right font-semibold text-zinc-900 tracking-tight">{formatCurrency(e.amount)}</td>
                    <td className="px-6 py-4 text-right space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(e)} className="text-zinc-400 hover:text-zinc-900"><Edit2 size={16}/></button>
                      <button onClick={() => onDelete(e.id)} className="text-zinc-300 hover:text-red-500"><Trash2 size={16}/></button>
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
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], desc: '', miles: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const RATE_2026 = 0.725;
  
  const enrichedMileages = useMemo(() => mileages.map(m => ({ ...m, deduction: m.miles * RATE_2026 })), [mileages]);
  const { items: sortedMileages, requestSort, sortConfig } = useSortableData(enrichedMileages);

  const addRow = (e) => { e.preventDefault(); onAdd(formData); setFormData({ date: new Date().toISOString().split('T')[0], desc: '', miles: '' }); };
  const startEdit = (item) => { setEditingId(item.id); setEditForm({ ...item }); };
  const saveEdit = () => { onUpdate(editingId, editForm); setEditingId(null); };

  const handleExport = () => {
    const headers = ['Date', 'Trip Description', 'Miles', 'Deduction Value'];
    const data = sortedMileages.map(m => [m.date, m.desc, m.miles, m.deduction]);
    exportToCsv('Apex_Mileage_Log.csv', [headers, ...data]);
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-zinc-100 p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)]">
        <h2 className="text-lg font-bold tracking-tight text-zinc-900 mb-6">Track Miles</h2>
        <form onSubmit={addRow} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input type="date" className={inlineInputStyle} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
          <input type="text" placeholder="Trip Description" className={inlineInputStyle} value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} required />
          <input type="number" step="0.1" placeholder="Total Miles" className={inlineInputStyle} value={formData.miles} onChange={e => setFormData({...formData, miles: e.target.value})} required />
          <button type="submit" className="sm:col-span-3 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center transition-all hover:-translate-y-0.5 mt-2 shadow-md"><Plus size={18} className="mr-2" /> Log Miles</button>
        </form>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-zinc-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)] overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
          <h3 className="font-bold tracking-tight text-zinc-900 text-lg">Trip Log</h3>
          <button onClick={handleExport} className="text-[11px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-900 flex items-center transition-colors bg-zinc-50 border border-zinc-200 px-4 py-2 rounded-full hover:bg-zinc-100"><Download size={14} className="mr-2" /> Export</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-50/50 border-b border-zinc-100">
              <tr>
                <SortableHeader label="Date" sortKey="date" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Description" sortKey="desc" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Miles" sortKey="miles" currentSort={sortConfig} requestSort={requestSort} alignRight />
                <SortableHeader label="Deduction Value" sortKey="deduction" currentSort={sortConfig} requestSort={requestSort} alignRight textColor="text-zinc-500" />
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {sortedMileages.length === 0 ? (
                <EmptyState icon={Car} title="No trips logged" message="Track your business mileage to maximize your end-of-year tax deductions." colSpan="5" />
              ) : sortedMileages.map(m => (
                editingId === m.id ? (
                  <tr key={m.id} className="bg-blue-50/30">
                    <td className="px-3 py-2"><input type="date" className={inlineInputStyle} value={editForm.date} onChange={ev => setEditForm({...editForm, date: ev.target.value})} /></td>
                    <td className="px-3 py-2"><input type="text" className={inlineInputStyle} value={editForm.desc} onChange={ev => setEditForm({...editForm, desc: ev.target.value})} /></td>
                    <td className="px-3 py-2"><input type="number" step="0.1" className={inlineInputStyle} value={editForm.miles} onChange={ev => setEditForm({...editForm, miles: ev.target.value})} /></td>
                    <td className="px-6 py-4 text-right text-zinc-300">-</td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-700 p-1 bg-emerald-50 rounded"><Check size={16}/></button>
                      <button onClick={() => setEditingId(null)} className="text-zinc-400 hover:text-zinc-600 p-1 bg-zinc-100 rounded"><X size={16}/></button>
                    </td>
                  </tr>
                ) : (
                  <tr key={m.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-zinc-500">{m.date}</td>
                    <td className="px-6 py-4 font-semibold text-zinc-800">{m.desc}</td>
                    <td className="px-6 py-4 text-right font-semibold text-zinc-900">{m.miles} mi</td>
                    <td className="px-6 py-4 text-right font-bold text-blue-600 tracking-tight">{formatCurrency(m.deduction)}</td>
                    <td className="px-6 py-4 text-right space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(m)} className="text-zinc-400 hover:text-zinc-900"><Edit2 size={16}/></button>
                      <button onClick={() => onDelete(m.id)} className="text-zinc-300 hover:text-red-500"><Trash2 size={16}/></button>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-zinc-900 rounded-[2.5rem] p-10 shadow-2xl shadow-zinc-900/20 text-white flex flex-col justify-center relative overflow-hidden order-1">
          <div className="absolute top-0 right-0 p-8 opacity-5"><Settings size={200} className="animate-[spin_40s_linear_infinite]" /></div>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-10 z-10">Unit Economics</h2>
          <div className="space-y-5 z-10 text-sm font-medium">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3"><span className="text-zinc-400">Black PETG</span><span className="font-bold tracking-tight">{formatCurrency(blackPetgCostPerGram * (cogs.blackGramsUsed || 533))}</span></div>
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3"><span className="text-zinc-400">White PETG</span><span className="font-bold tracking-tight">{formatCurrency(whitePetgCostPerGram * (cogs.whiteGramsUsed || 11))}</span></div>
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3"><span className="text-zinc-400">Concrete</span><span className="font-bold tracking-tight">{formatCurrency(cogs.concreteCost * cogs.lbsUsed)}</span></div>
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3"><span className="text-zinc-400">Hardware</span><span className="font-bold tracking-tight">{formatCurrency(Number(cogs.screwsCost || 0) + Number(cogs.insertsCost || 0) + Number(cogs.washersCost || 0))}</span></div>
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3"><span className="text-zinc-400">Packaging</span><span className="font-bold tracking-tight">{formatCurrency(Number(cogs.boxCost || 0) + Number(cogs.bubbleWrapCost || 0))}</span></div>
            <div className="pt-6 flex justify-between items-end"><span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Total COGS</span><span className="text-5xl font-semibold tracking-tighter text-emerald-400">{formatCurrency(costPerTrainer)}</span></div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-zinc-100 p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)] order-2">
          <h2 className="text-lg font-bold tracking-tight text-zinc-900 mb-8">Supply Variables</h2>
          <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-2 hide-scrollbar">
            <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Raw Materials</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Black Spool $</label><input type="number" step="0.01" name="blackSpoolCost" value={cogs.blackSpoolCost || ''} onChange={handleChange} className={inlineInputStyle} /></div>
              <div><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Black Grams</label><input type="number" name="blackGramsUsed" value={cogs.blackGramsUsed || ''} onChange={handleChange} className={inlineInputStyle} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">White Spool $</label><input type="number" step="0.01" name="whiteSpoolCost" value={cogs.whiteSpoolCost || ''} onChange={handleChange} className={inlineInputStyle} /></div>
              <div><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">White Grams</label><input type="number" name="whiteGramsUsed" value={cogs.whiteGramsUsed || ''} onChange={handleChange} className={inlineInputStyle} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Concrete $/lb</label><input type="number" step="0.01" name="concreteCost" value={cogs.concreteCost} onChange={handleChange} className={inlineInputStyle} /></div>
              <div><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">lbs Used</label><input type="number" step="0.1" name="lbsUsed" value={cogs.lbsUsed} onChange={handleChange} className={inlineInputStyle} /></div>
            </div>
            <hr className="border-zinc-100 my-6" />
            <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Hardware</h3>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Screws</label><input type="number" step="0.01" name="screwsCost" value={cogs.screwsCost} onChange={handleChange} className={inlineInputStyle} /></div>
              <div><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Inserts</label><input type="number" step="0.01" name="insertsCost" value={cogs.insertsCost} onChange={handleChange} className={inlineInputStyle} /></div>
              <div><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Washers</label><input type="number" step="0.01" name="washersCost" value={cogs.washersCost} onChange={handleChange} className={inlineInputStyle} /></div>
            </div>
            <hr className="border-zinc-100 my-6" />
            <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Packaging</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Box</label><input type="number" step="0.01" name="boxCost" value={cogs.boxCost} onChange={handleChange} className={inlineInputStyle} /></div>
              <div><label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Wrap</label><input type="number" step="0.01" name="bubbleWrapCost" value={cogs.bubbleWrapCost} onChange={handleChange} className={inlineInputStyle} /></div>
            </div>
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
    <div className={`flex justify-between items-center py-3 border-b border-zinc-100 ${isTotal ? 'bg-zinc-50 font-bold text-zinc-900 p-4 rounded-xl mt-2' : 'text-zinc-600 text-sm font-medium'}`}>
      <div className="flex items-center"><span className="w-16 text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Line {line}</span><span>{description}</span></div><span className="tracking-tight">{formatCurrency(amount)}</span>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in print-area max-w-4xl mx-auto">
      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-zinc-100 p-10 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)]">
        
        <div className="flex items-center justify-between mb-10 pb-6 border-b border-zinc-100">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Schedule C Preparer</h2>
            <p className="text-sm font-medium text-zinc-400 mt-1">Apex Performance Concepts LLC</p>
          </div>
          <div className="text-right flex flex-col items-end">
            <button onClick={() => window.print()} className="no-print mb-4 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold uppercase tracking-wider py-2.5 px-5 rounded-full flex items-center transition-all hover:-translate-y-0.5 shadow-md"><Printer size={14} className="mr-2"/> Print PDF</button>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Tax Year</p>
            <p className="text-xl font-bold tracking-tight text-zinc-900">2026</p>
          </div>
        </div>

        <div className="mb-10">
          <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3 pl-1">Part I: Income</h3>
          <TaxLine line="1" description="Gross receipts or sales" amount={grossSales} />
          <TaxLine line="7" description="Gross income" amount={grossSales} isTotal />
        </div>

        <div className="mb-10">
          <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3 pl-1">Part II: Expenses</h3>
          <TaxLine line="8" description="Advertising" amount={expAdvertising} />
          <TaxLine line="9" description="Car/truck expenses (Mileage)" amount={mileageDeduction} />
          <TaxLine line="10" description="Commissions and fees" amount={ebayAdFees} />
          <TaxLine line="18" description="Office expense" amount={expOffice} />
          <TaxLine line="22" description="Supplies" amount={expSupplies} />
          <TaxLine line="24a" description="Travel" amount={expTravel} />
          <TaxLine line="27a" description="Other: Shipping Labels" amount={shippingFees} />
          <TaxLine line="27a" description="Other: Equipment" amount={expEquipment} />
          <TaxLine line="28" description="Total expenses" amount={totalExpenses} isTotal />
        </div>

        <div className="mb-6">
          <div className={`p-6 rounded-2xl flex justify-between items-center border ${netProfit >= 0 ? 'bg-emerald-50/50 border-emerald-200/60 text-emerald-900 shadow-sm' : 'bg-red-50 border-red-200 text-red-900'}`}>
            <div className="flex items-center"><span className="w-16 text-[10px] uppercase tracking-widest font-bold opacity-50">Line 31</span><span className="font-bold text-lg tracking-tight">Net profit (or loss)</span></div>
            <span className="text-3xl font-semibold tracking-tighter">{formatCurrency(netProfit)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const style = document.createElement('style');
style.textContent = `
  .hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  
  @keyframes spring-in {
    0% { transform: scale(0.9); opacity: 0; }
    60% { transform: scale(1.02); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  .animate-spring-in {
    animation: spring-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }
  
  @media print {
    .no-print { display: none !important; }
    body { background-color: white !important; -webkit-print-color-adjust: exact; }
    .print-bg-white { background-color: white !important; }
    .print-no-padding { padding: 0 !important; margin: 0 !important; }
    .print-area { max-width: 100% !important; padding: 0 !important; border: none !important; box-shadow: none !important; }
    @page { margin: 0.5in; }
  }
`;
document.head.appendChild(style);