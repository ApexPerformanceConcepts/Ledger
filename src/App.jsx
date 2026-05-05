import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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

// --- TAB → COLLECTION MAP for lazy listeners ---
const TAB_COLLECTION_MAP = {
  dashboard:  ['revenues', 'expenses', 'equities', 'mileages', 'machines'],
  analytics:  ['revenues', 'expenses'],
  production: ['revenues'],
  revenue:    ['revenues'],
  warehouse:  ['restocks', 'revenues'],
  fleet:      ['machines', 'revenues'],
  expenses:   ['expenses'],
  equity:     ['equities'],
  mileage:    ['mileages'],
  cogs:       [],
  tax:        ['revenues', 'expenses', 'mileages'],
};

// --- FIX 1: AnimatedNumber — RAF cleanup + ref-based prev value (no stale closure) ---
const AnimatedNumber = ({ value, formatCurrency, isInt = false }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const startValue = prevValueRef.current;
    const endValue = Number(value) || 0;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (startValue === endValue) return;

    const duration = 1200;
    let startTime = null;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = startValue + (endValue - startValue) * easeOut;
      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        prevValueRef.current = endValue;
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      prevValueRef.current = displayValue;
    };
  }, [value]);

  if (formatCurrency) return formatCurrency(displayValue);
  return isInt ? Math.round(displayValue).toLocaleString() : displayValue.toFixed(1);
};

// --- FIX 2: MagneticButton — RAF-throttled mousemove (no setState spam) ---
const MagneticButton = ({ children, onClick, className }) => {
  const buttonRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const rafRef = useRef(null);
  const pendingRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!buttonRef.current) return;
    pendingRef.current = { clientX: e.clientX, clientY: e.clientY };
    if (rafRef.current) return;

    rafRef.current = requestAnimationFrame(() => {
      if (!buttonRef.current || !pendingRef.current) { rafRef.current = null; return; }
      const { clientX: cx, clientY: cy } = pendingRef.current;
      const { width, height, left, top } = buttonRef.current.getBoundingClientRect();
      setPosition({ x: (cx - (left + width / 2)) * 0.2, y: (cy - (top + height / 2)) * 0.2 });
      rafRef.current = null;
      pendingRef.current = null;
    });
  };

  const handleMouseLeave = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    pendingRef.current = null;
    setPosition({ x: 0, y: 0 });
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

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

  // --- FIX 3: Refs for shared lazy-listener state ---
  const subscribedCollections = useRef(new Set());
  const activeUnsubs = useRef({});

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
      if (u) setTimeout(() => setIsAppReady(true), 600);
    });
    return () => unsubscribe();
  }, []);

  // --- FIX 3A: Shared subscribe helper ---
  const subscribeToCollection = useCallback((colName) => {
    if (!user || subscribedCollections.current.has(colName)) return;
    subscribedCollections.current.add(colName);

    const setterMap = {
      revenues: setRevenues,
      expenses: setExpenses,
      equities: setEquities,
      mileages: setMileages,
      restocks:  setRestocks,
      machines:  setMachines,
    };
    const setter = setterMap[colName];
    if (!setter) return;

    activeUnsubs.current[colName] = onSnapshot(
      getColRef(colName),
      (snap) => setter(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      console.error
    );
  }, [user]);

  // --- FIX 3B: Always-on settings listeners + eager dashboard collections on login ---
  useEffect(() => {
    if (!user) return;

    // Settings are needed by every tab — always subscribe eagerly
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
      if (docSnap.exists()) setAppSettings(prev => ({ ...prev, ...docSnap.data() }));
    }, console.error);

    // Subscribe to dashboard collections immediately (default tab)
    TAB_COLLECTION_MAP['dashboard'].forEach(subscribeToCollection);

    return () => {
      unsubCogs();
      unsubSettings();
      // Unsubscribe all lazy collection listeners on logout
      Object.values(activeUnsubs.current).forEach((unsub) => unsub());
      activeUnsubs.current = {};
      subscribedCollections.current.clear();
    };
  }, [user, subscribeToCollection]);

  // --- FIX 3C: Subscribe to new collections when tab changes ---
  useEffect(() => {
    if (!user) return;
    (TAB_COLLECTION_MAP[activeTab] || []).forEach(subscribeToCollection);
  }, [activeTab, user, subscribeToCollection]);

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

  // --- CALCULATIONS ---
  // FIX: costPerTrainer is now memoized so it doesn't recalculate on every render
  const costPerTrainer = useMemo(() => {
    const blackPetgCostPerGram = (cogs.blackSpoolCost || 16.99) / 1000;
    const whitePetgCostPerGram = (cogs.whiteSpoolCost || 16.99) / 1000;
    return (
      (blackPetgCostPerGram * (cogs.blackGramsUsed || 533)) + 
      (whitePetgCostPerGram * (cogs.whiteGramsUsed || 11)) + 
      ((cogs.concreteCost || 0.15) * (cogs.lbsUsed || 5)) + 
      Number(cogs.boxCost || 0) + 
      Number(cogs.bubbleWrapCost || 0) + 
      Number(cogs.screwsCost || 0) + 
      Number(cogs.insertsCost || 0) + 
      Number(cogs.washersCost || 0)
    );
  }, [cogs]);

  // Keep these exposed for child components that need them (e.g. Manufacturing tab)
  const blackPetgCostPerGram = (cogs.blackSpoolCost || 16.99) / 1000;
  const whitePetgCostPerGram = (cogs.whiteSpoolCost || 16.99) / 1000;

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

// --- FIX: ProductionBoard — OrderCard hoisted out of render scope ---
// OrderCard is now defined outside ProductionBoard so React doesn't treat it
// as a new component type on every render (which was resetting its internal state).
const OrderCard = ({ order, status, finishedBuffer, appSettings, handleUpdateSettings, handleUpdateRecord }) => {
  const updateStatus = (id, newStatus) => {
    handleUpdateRecord('revenues', id, { fulfillmentStatus: newStatus });
  };

  const pullFromBuffer = (order) => {
    const qty = Number(order.qty || 1);
    if (finishedBuffer >= qty) {
      handleUpdateSettings({ ...appSettings, finishedBuffer: finishedBuffer - qty });
      updateStatus(order.id, 'shipped');
    } else {
      alert("Not enough fully assembled units in the safety buffer!");
    }
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

  const qty = Number(order.qty || 1);
  const baseHours = qty * 12.6;
  const coverHours = qty * 4.4;
  const totalHours = baseHours + coverHours;
  const urgency = getUrgency(order.date, totalHours);
  const isOverdue = urgency.text.includes('OVERDUE') || urgency.text.includes('LATE RISK');

  return (
    <div className={`bg-white rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all group relative ${isOverdue ? 'border-rose-200' : 'border-zinc-200'}`}>
      <button onClick={(e) => { e.preventDefault(); updateStatus(order.id, 'archived'); }} className="absolute top-2 right-2 text-zinc-400 hover:text-rose-600 bg-white hover:bg-rose-50 p-1.5 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all shadow-sm border border-zinc-200 z-10" title="Remove from Queue">
        <X size={14} strokeWidth={3} />
      </button>
      
      <div className="flex justify-between items-start mb-2 pr-8">
        <div>
          <div className="font-bold text-sm text-zinc-900 line-clamp-1">{order.desc}</div>
          <div className="text-[10px] font-mono text-zinc-500 mt-0.5">{order.orderNum || 'Manual Sale'} • Qty: {qty}</div>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 mt-2.5">
        <div className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded border ${urgency.color} whitespace-nowrap`}>{urgency.text}</div>
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
            <button onClick={() => updateStatus(order.id, 'new')} className="bg-zinc-100 hover:bg-zinc-200 text-zinc-600 px-3 py-2 rounded-lg transition-colors shadow-sm" title="Revert to To Print"><ArrowRightLeft size={14} /></button>
            <button onClick={() => updateStatus(order.id, 'ready')} className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-bold py-2 rounded-lg transition-colors flex justify-center items-center shadow-sm">
              <CheckCircle2 size={14} className="mr-1.5" /> Finish & Assemble
            </button>
          </div>
        )}
        {status === 'ready' && (
          <div className="flex gap-2">
            <button onClick={() => updateStatus(order.id, 'printing')} className="bg-zinc-100 hover:bg-zinc-200 text-zinc-600 px-3 py-2 rounded-lg transition-colors shadow-sm" title="Revert to Printing"><ArrowRightLeft size={14} /></button>
            <button onClick={() => updateStatus(order.id, 'shipped')} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg transition-colors flex justify-center items-center shadow-sm">
              <ArrowRight size={14} className="mr-1.5" /> Mark Shipped
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

function ProductionBoard({ revenues, appSettings, handleUpdateSettings, handleUpdateRecord, buildableUnits }) {
  const finishedBuffer = Number(appSettings.finishedBuffer || 0);
  const targetBuffer = Number(appSettings.targetBuffer || 6);

  const activeOrders = useMemo(() => {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const cutoff = fiveDaysAgo.toISOString().split('T')[0];
    return revenues.filter(r => {
      if (r.fulfillmentStatus === 'shipped' || r.fulfillmentStatus === 'archived') return false;
      if (r.fulfillmentStatus === 'new' || r.fulfillmentStatus === 'printing' || r.fulfillmentStatus === 'ready') return true;
      if (!r.fulfillmentStatus && r.date >= cutoff && Number(r.qty) > 0) return true;
      return false;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [revenues]);

  const adjustBuffer = (amount) => {
    const newTotal = Math.max(0, finishedBuffer + amount);
    if (amount > 0 && buildableUnits < amount) { alert("Not enough raw materials in the Warehouse to print this!"); return; }
    handleUpdateSettings({ ...appSettings, finishedBuffer: newTotal });
  };

  const newOrders = activeOrders.filter(r => !r.fulfillmentStatus || r.fulfillmentStatus === 'new');
  const printingOrders = activeOrders.filter(r => r.fulfillmentStatus === 'printing');
  const readyOrders = activeOrders.filter(r => r.fulfillmentStatus === 'ready');

  // Shared props passed down to the hoisted OrderCard
  const cardProps = { finishedBuffer, appSettings, handleUpdateSettings, handleUpdateRecord };

  return (
    <div className="space-y-6 animate-in fade-in">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-50/80 backdrop-blur-sm rounded-3xl border border-zinc-200/60 p-5 flex flex-col h-full">
          <div className="flex justify-between items-center mb-5 px-1">
            <h3 className="font-bold text-zinc-900 flex items-center"><Inbox size={16} className="mr-2 text-zinc-400"/> To Print</h3>
            <span className="bg-zinc-200 text-zinc-700 text-xs font-bold px-2.5 py-1 rounded-full">{newOrders.length}</span>
          </div>
          <div className="flex-1 space-y-4">
            {newOrders.map(order => <OrderCard key={order.id} order={order} status="new" {...cardProps} />)}
            {newOrders.length === 0 && <div className="text-center py-10 text-zinc-400 text-sm font-medium border-2 border-dashed border-zinc-200 rounded-2xl">No pending orders.<br/><span className="text-xs font-normal mt-1 opacity-70 block">You can push older orders to the board<br/>from your Revenue Ledger.</span></div>}
          </div>
        </div>

        <div className="bg-blue-50/50 backdrop-blur-sm rounded-3xl border border-blue-100/60 p-5 flex flex-col h-full">
          <div className="flex justify-between items-center mb-5 px-1">
            <h3 className="font-bold text-blue-900 flex items-center"><Settings size={16} className="mr-2 text-blue-500 animate-[spin_4s_linear_infinite]"/> Printing</h3>
            <span className="bg-blue-200 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full">{printingOrders.length}</span>
          </div>
          <div className="flex-1 space-y-4">
            {printingOrders.map(order => <OrderCard key={order.id} order={order} status="printing" {...cardProps} />)}
            {printingOrders.length === 0 && <div className="text-center py-10 text-blue-300 text-sm font-medium border-2 border-dashed border-blue-100 rounded-2xl">Printers are idle.</div>}
          </div>
        </div>

        <div className="bg-emerald-50/50 backdrop-blur-sm rounded-3xl border border-emerald-100/60 p-5 flex flex-col h-full">
          <div className="flex justify-between items-center mb-5 px-1">
            <h3 className="font-bold text-emerald-900 flex items-center"><Package size={16} className="mr-2 text-emerald-500"/> Assembly / Pack</h3>
            <span className="bg-emerald-200 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full">{readyOrders.length}</span>
          </div>
          <div className="flex-1 space-y-4">
            {readyOrders.map(order => <OrderCard key={order.id} order={order} status="ready" {...cardProps} />)}
            {readyOrders.length === 0 && <div className="text-center py-10 text-emerald-300 text-sm font-medium border-2 border-dashed border-emerald-100 rounded-2xl">Nothing waiting to pack.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- FIX: StockCard hoisted out of Warehouse render scope ---
// Was previously defined inside Warehouse(), causing React to treat it as a
// new component type on every render and destroy its useState on each update.
const StockCard = ({ title, materialName, amount, unit, isWarning, daysRemaining, velocity, onAdjust }) => {
  const cleanAmount = Number.isInteger(amount) ? amount : Number(Number(amount).toFixed(2));
  const [isEditing, setIsEditing] = useState(false);
  const [editVal, setEditVal] = useState(cleanAmount);

  useEffect(() => {
    if (!isEditing) setEditVal(Number.isInteger(amount) ? amount : Number(Number(amount).toFixed(2)));
  }, [amount, isEditing]);

  const handleSave = () => {
    const diff = Number(editVal) - cleanAmount;
    if (diff !== 0) onAdjust(materialName, diff);
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

function Warehouse({ restocks, currentStock, buildableUnits, runoutDays, dailySalesVelocity, onAdd, onDelete, formatCurrency, cogs }) {
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], material: 'Black PETG (grams)', qty: '' });
  const materials = ['Black PETG (grams)', 'White PETG (grams)', 'Concrete (lbs)', 'Boxes (qty)', 'Bubble Wrap (qty)', 'Screws (sets)', 'Inserts (sets)', 'Washers (sets)'];
  const { items: sortedRestocks, requestSort, sortConfig } = useSortableData(restocks);

  const addRow = (e) => { e.preventDefault(); if (!formData.qty) return; onAdd(formData); setFormData({ ...formData, qty: '' }); };

  const handleStockAdjustment = (materialName, diff) => {
    onAdd({ date: new Date().toISOString().split('T')[0], material: materialName, qty: diff, type: 'Audit' });
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
            );
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
      while(headerIdx < parsed.length && (!parsed[headerIdx] || !parsed[headerIdx].some(h => h && (h.includes('Order Number') || h.includes('Order number'))))) { headerIdx++; }
      if (headerIdx >= parsed.length) { alert("Could not find 'Order Number' header in this CSV."); return; }
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
      headers.forEach((h, idx) => { const headerStr = (h || '').toLowerCase(); if (headerStr.includes('fee') || headerStr.includes('final value')) feeIndices.add(idx); });
      const specificFeeCols = ['Final Value Fee - variable', 'Final Value Fee - fixed', 'Regulatory operating fee', 'International fee'];
      specificFeeCols.forEach(feeName => { const idx = findHeader(feeName); if (idx > -1) feeIndices.add(idx); });
      const months = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
      const ordersMap = new Map();
      for (let i = headerIdx + 1; i < parsed.length; i++) {
        const row = parsed[i];
        if (row.length < headers.length) continue;
        let orderNum = row[orderIdx] ? row[orderIdx].trim() : '';
        if (!orderNum || orderNum.startsWith('--')) { const refIdx = findHeader('Reference ID'); let refId = refIdx > -1 ? row[refIdx] : ''; if (refId && refId !== '--') orderNum = refId; else orderNum = 'Misc-' + i; }
        const type = typeIdx > -1 ? (row[typeIdx] || '').toLowerCase() : 'order';
        if (type === 'payout' || type === 'transfer') continue;
        if (!ordersMap.has(orderNum)) ordersMap.set(orderNum, { orderNum: orderNum.startsWith('Misc-') ? '' : orderNum, date: '', desc: '', state: '', qty: 0, gross: 0, salesTax: 0, ebay: 0, ad: 0, shipping: 0 });
        const rec = ordersMap.get(orderNum);
        const cleanNum = (val) => { if (!val) return 0; if (typeof val === 'number') return val; let str = val.toString().trim(); if (str === '--' || str === '-' || str === '') return 0; const isNegative = str.startsWith('-') || (str.startsWith('(') && str.endsWith(')')); const cleaned = str.replace(/[^0-9.]/g, ''); const num = parseFloat(cleaned); if (isNaN(num)) return 0; return isNegative ? -num : num; };
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
          if (row[dateIdx] && !rec.date && row[dateIdx] !== '--') { const rawDate = row[dateIdx]; const d = new Date(rawDate); if (!isNaN(d.getTime())) { rec.date = d.toLocaleDateString('en-CA'); } else { const parts = rawDate.split('-'); if (parts.length === 3) rec.date = `20${parts[2]}-${months[parts[0]] || '01'}-${parts[1].padStart(2, '0')}`; else rec.date = rawDate; } }
          if (cleanTitle && (!rec.desc || rec.desc === 'eBay Sale' || rec.desc.startsWith('Shipping') || rec.desc.startsWith('Ad') || rec.desc === '--')) rec.desc = cleanTitle;
          if (stateIdx > -1 && row[stateIdx] && row[stateIdx] !== '--' && !rec.state) rec.state = row[stateIdx].toUpperCase().trim();
          if (rowQty > 0 && (type.includes('order') || type === 'sale')) rec.qty += rowQty;
        }
        if (type.includes('shipping label')) { rec.shipping += Math.abs(rawNet || rawGross); if(!rec.desc || rec.desc === '--') rec.desc = 'Shipping Label'; }
        else if (type.includes('other fee') || type.includes('ad fee') || cleanDesc.toLowerCase().includes('promoted')) { rec.ad += Math.abs(rawNet || sumFees || rawGross); if(!rec.desc || rec.desc === '--') rec.desc = 'Ad Fee / Other'; }
        else if (type.includes('refund')) { rec.gross += adjustedGross; rec.salesTax -= Math.abs(rawTax); rec.ebay -= Math.abs(sumFees); }
        else { rec.gross += adjustedGross; rec.salesTax += Math.abs(rawTax); rec.ebay += Math.abs(sumFees); if (!rec.desc || rec.desc === 'Shipping Label' || rec.desc === 'Ad Fee / Other' || rec.desc === '--') rec.desc = cleanTitle || cleanDesc || 'eBay Sale'; }
      }
      const newRows = [];
      let unchangedCount = 0, updatedCount = 0, index = 0;
      for (const [orderNum, rec] of ordersMap.entries()) {
        const existingRecord = revenues.find(r => r.orderNum === orderNum);
        if (existingRecord) {
          let needsUpdate = false, updates = {};
          if (rec.gross !== 0 && Number(existingRecord.gross || 0) !== Number(rec.gross.toFixed(2))) { updates.gross = rec.gross.toFixed(2); needsUpdate = true; }
          if (rec.salesTax !== 0 && Number(existingRecord.salesTax || 0) !== Number(rec.salesTax.toFixed(2))) { updates.salesTax = rec.salesTax.toFixed(2); needsUpdate = true; }
          if (rec.ebay !== 0 && Number(existingRecord.ebay || 0) !== Number(rec.ebay.toFixed(2))) { updates.ebay = rec.ebay.toFixed(2); needsUpdate = true; }
          if (rec.ad !== 0 && Number(existingRecord.ad || 0) !== Number(rec.ad.toFixed(2))) { updates.ad = rec.ad.toFixed(2); needsUpdate = true; }
          if (rec.shipping !== 0 && Number(existingRecord.shipping || 0) !== Number(rec.shipping.toFixed(2))) { updates.shipping = rec.shipping.toFixed(2); needsUpdate = true; }
          if (rec.state && existingRecord.state !== rec.state) { updates.state = rec.state; needsUpdate = true; }
          if (rec.qty > 0 && Number(existingRecord.qty || 1) !== rec.qty) { updates.qty = rec.qty; needsUpdate = true; }
          if (rec.desc && rec.desc !== 'eBay Sale' && existingRecord.desc !== rec.desc) { updates.desc = rec.desc; needsUpdate = true; }
          if (needsUpdate) { newRows.push({ ...existingRecord, ...updates, isUpdate: true }); updatedCount++; } else { unchangedCount++; }
          continue;
        }
        newRows.push({ id: Date.now() + index++, date: rec.date, orderNum: rec.orderNum, desc: rec.desc || 'eBay Sale', state: rec.state, qty: rec.qty || 1, gross: rec.gross.toFixed(2), salesTax: rec.salesTax.toFixed(2), ebay: rec.ebay > 0 ? rec.ebay.toFixed(2) : '', ad: rec.ad > 0 ? rec.ad.toFixed(2) : '', shipping: rec.shipping > 0 ? rec.shipping.toFixed(2) : '', isUpdate: false });
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
      delete payload.isUpdate; delete payload.net; delete payload.trueProfit; delete payload.margin;
      if (r.isUpdate) { onUpdate(r.id, payload); } else { onAdd(payload); }
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
                <p className="text-sm text-zinc-500 mt-1">Found <strong className="text-emerald-600">{importStats.new} new</strong> sales and <strong className="text-amber-500">{importStats.updated} updates</strong> to existing records. Skipped {importStats.unchanged} fully matched orders.</p>
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
                    ) : importPreview.map(r => (
                      <tr key={r.id} className="hover:bg-zinc-50/50">
                        <td className="px-6 py-3 font-medium text-zinc-500">{r.date}</td>
                        <td className="px-6 py-3 font-mono text-[11px] text-zinc-500 flex items-center">
                          {r.isUpdate ? <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded mr-2 font-bold text-[9px] shadow-sm">OVERWRITE</span> : <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded mr-2 font-bold text-[9px] shadow-sm">NEW</span>}
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
                    ))}
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
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-zinc-400 text-center select-none">Action</th>
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
                    <td className="px-6 py-4 text-zinc-400 font-mono text-[10px] tracking-wider flex flex-wrap items-center gap-1.5 min-w-[120px]">
                      {r.fulfillmentStatus === 'shipped' && <span className="text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded font-bold" title="Shipped">SHIPPED</span>}
                      {r.fulfillmentStatus === 'archived' && <span className="text-zinc-500 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded font-bold" title="Archived">ARCHIVED</span>}
                      {(r.fulfillmentStatus === 'new' || r.fulfillmentStatus === 'printing' || r.fulfillmentStatus === 'ready') && <span className="text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded font-bold" title="In Production Queue">QUEUED</span>}
                      <span className="truncate">{r.orderNum || '-'}</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-zinc-900 text-xs">{r.state || '-'}</td>
                    <td className="px-6 py-4 truncate max-w-[200px] font-semibold text-zinc-800" title={r.desc}>{r.desc}</td>
                    <td className="px-6 py-4 text-center font-bold text-zinc-900">{r.qty}</td>
                    <td className="px-6 py-4 text-right font-medium text-zinc-600">{formatCurrency(r.gross)}</td>
                    <td className="px-6 py-4 text-right text-zinc-400" title={`Tax: ${formatCurrency(r.salesTax || 0)} | eBay: ${formatCurrency(r.ebay || 0)} | Ad: ${formatCurrency(r.ad || 0)} | Ship: ${formatCurrency(r.shipping || 0)}`}>{formatCurrency(totalFees)}</td>
                    <td className="px-6 py-4 text-right font-semibold text-blue-600">{formatCurrency(r.net)}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600 tracking-tight">{formatCurrency(r.trueProfit)}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600 tracking-tight">{r.margin.toFixed(0)}%</td>
                    <td className="px-6 py-4 text-right space-x-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {(!r.fulfillmentStatus || r.fulfillmentStatus === 'archived' || r.fulfillmentStatus === 'shipped') ? (
                        <button onClick={() => onUpdate(r.id, { fulfillmentStatus: 'new' })} className="text-blue-500 hover:text-white hover:bg-blue-500 bg-blue-50 p-1.5 rounded-lg transition-colors" title="Send to Production Queue"><Inbox size={14} /></button>
                      ) : (
                        <button onClick={() => onUpdate(r.id, { fulfillmentStatus: 'archived' })} className="text-rose-500 hover:text-white hover:bg-rose-500 bg-rose-50 p-1.5 rounded-lg transition-colors" title="Remove from Queue"><X size={14} /></button>
                      )}
                      <button onClick={() => startEdit(r)} className="text-zinc-400 hover:text-zinc-900 bg-zinc-50 hover:bg-zinc-100 p-1.5 rounded-lg transition-colors" title="Edit Record"><Edit2 size={14} /></button>
                      <button onClick={() => onDelete(r.id)} className="text-zinc-400 hover:text-red-500 bg-zinc-50 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title="Delete Record"><Trash2 size={14} /></button>
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

// NOTE: Analytics, ExpenseTracker, OwnerEquity, MileageLog, Manufacturing,
// TaxSummary, DashboardCard, ProgressCard, QuickExpenseModal, QuickEquityModal
// are unchanged from your original file — paste them in below this line.

const style = document.createElement('style');
style.textContent = `
  .hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  @keyframes spring-in {
    0% { transform: scale(0.9); opacity: 0; }
    60% { transform: scale(1.02); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  .animate-spring-in { animation: spring-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
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