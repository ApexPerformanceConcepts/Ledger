import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, DollarSign, Receipt, Wallet, Car, Settings, Plus, Trash2, ClipboardList, Edit2, Check
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

// 1. PASTE YOUR FIREBASE CONFIG HERE
const firebaseConfig = {
  apiKey: "AIzaSyAXtaglk0mUuQyknLmyGuT6yoB8a0KYH7g",
  authDomain: "apex-performance-ledger.firebaseapp.com",
  projectId: "apex-performance-ledger",
  storageBucket: "apex-performance-ledger.firebasestorage.app",
  messagingSenderId: "833698468013",
  appId: "1:833698468013:web:a2665043c9a345afd0f624",
  measurementId: "G-0NR5S32JGE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuth, setIsAuth] = useState(false);

  // --- STATE MANAGEMENT ---
  const [revenues, setRevenues] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [equities, setEquities] = useState([]);
  const [mileages, setMileages] = useState([]);
  
  const [appSettings, setAppSettings] = useState({ initialInvestment: 1219.00 });
  const [cogs, setCogs] = useState({
    spoolCost: 20.00, gramsUsed: 250, concreteCost: 0.15, lbsUsed: 5, boxCost: 1.25
  });

  // --- FIREBASE AUTHENTICATION ---
  useEffect(() => {
    signInAnonymously(auth).then(() => setIsAuth(true)).catch(console.error);
  }, []);

  // --- REALTIME DATA FETCHING ---
  useEffect(() => {
    if (!isAuth) return;
    
    const unsubRevs = onSnapshot(collection(db, 'revenues'), 
      (snap) => setRevenues(snap.docs.map(d => ({ id: d.id, ...d.data() }))), console.error);
    const unsubExps = onSnapshot(collection(db, 'expenses'), 
      (snap) => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))), console.error);
    const unsubEqs = onSnapshot(collection(db, 'equities'), 
      (snap) => setEquities(snap.docs.map(d => ({ id: d.id, ...d.data() }))), console.error);
    const unsubMiles = onSnapshot(collection(db, 'mileages'), 
      (snap) => setMileages(snap.docs.map(d => ({ id: d.id, ...d.data() }))), console.error);
    
    const unsubCogs = onSnapshot(doc(db, 'settings', 'cogs'), 
      (docSnap) => { if (docSnap.exists()) setCogs(docSnap.data()); }, console.error);
    const unsubSettings = onSnapshot(doc(db, 'settings', 'app'), 
      (docSnap) => { if (docSnap.exists()) setAppSettings(docSnap.data()); }, console.error);

    return () => { unsubRevs(); unsubExps(); unsubEqs(); unsubMiles(); unsubCogs(); unsubSettings(); };
  }, [isAuth]);

  // --- MUTATION HANDLERS (Saving to Cloud) ---
  const handleAdd = async (collectionName, data) => {
    await setDoc(doc(db, collectionName, Date.now().toString()), data);
  };
  
  const handleDelete = async (collectionName, id) => {
    await deleteDoc(doc(db, collectionName, id.toString()));
  };

  const handleUpdateCogs = async (newCogs) => {
    setCogs(newCogs);
    await setDoc(doc(db, 'settings', 'cogs'), newCogs);
  };

  const handleUpdateSettings = async (newSettings) => {
    setAppSettings(newSettings);
    await setDoc(doc(db, 'settings', 'app'), newSettings);
  };

  // --- CALCULATIONS ---
  const totalGrossRevenue = useMemo(() => revenues.reduce((sum, r) => sum + Number(r.gross || 0), 0), [revenues]);
  const totalPlatformFees = useMemo(() => revenues.reduce((sum, r) => sum + Number(r.ebay || 0) + Number(r.ad || 0) + Number(r.shipping || 0), 0), [revenues]);
  const totalOperatingExpenses = useMemo(() => expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0), [expenses]);
  
  const netProfit = totalGrossRevenue - totalPlatformFees - totalOperatingExpenses;
  const taxReserve = netProfit > 0 ? netProfit * 0.25 : 0;
  
  const totalEquityPaid = useMemo(() => equities.reduce((sum, e) => sum + Number(e.amount || 0), 0), [equities]);
  
  const initialGoal = Number(appSettings.initialInvestment || 0);
  const remainingToRecoup = Math.max(0, initialGoal - totalEquityPaid);
  
  const availableGolfFund = remainingToRecoup === 0 ? Math.max(0, netProfit - taxReserve) : 0;

  const petgCostPerGram = cogs.spoolCost / 1000;
  const costPerTrainer = (petgCostPerGram * cogs.gramsUsed) + (cogs.concreteCost * cogs.lbsUsed) + Number(cogs.boxCost);

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  
  const TabButton = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors w-full sm:w-auto ${
        activeTab === id 
          ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50' 
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      }`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <h1 className="text-2xl font-bold text-slate-800">Apex Performance Concepts LLC</h1>
            <p className="text-sm text-slate-500">Automated Business Ledger</p>
          </div>
          <div className="flex overflow-x-auto hide-scrollbar border-t border-slate-100">
            <TabButton id="dashboard" icon={LayoutDashboard} label="Dashboard" />
            <TabButton id="revenue" icon={DollarSign} label="Revenue Log" />
            <TabButton id="expenses" icon={Receipt} label="Expense Tracker" />
            <TabButton id="equity" icon={Wallet} label="Owner Equity" />
            <TabButton id="mileage" icon={Car} label="Mileage Log" />
            <TabButton id="cogs" icon={Settings} label="Manufacturing" />
            <TabButton id="tax" icon={ClipboardList} label="Tax Summary" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-xl font-semibold mb-4 text-slate-800">Command Center</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <DashboardCard title="Total Revenue (Gross)" amount={totalGrossRevenue} subtitle="Total sales before fees" color="blue" />
              <DashboardCard title="Total Platform Fees" amount={totalPlatformFees} subtitle="eBay, Ads, & Shipping" color="red" isNegative />
              <DashboardCard title="Operating Expenses" amount={totalOperatingExpenses} subtitle="Printers, tools, gear" color="orange" isNegative />
              
              <div className="col-span-1 md:col-span-2 lg:col-span-3 border-t border-slate-200 my-2"></div>
              
              <DashboardCard title="Net Profit" amount={netProfit} subtitle="The actual 'Apex' earnings" color={netProfit >= 0 ? "emerald" : "red"} highlight />
              <DashboardCard title="Tax Reserve (25%)" amount={taxReserve} subtitle="Set aside for IRS & Iowa" color="indigo" />
              
              <div className="col-span-1 md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <ProgressCard 
                  totalEquityPaid={totalEquityPaid} initialGoal={initialGoal} remainingToRecoup={remainingToRecoup}
                  formatCurrency={formatCurrency} onUpdateGoal={(newGoal) => handleUpdateSettings({ ...appSettings, initialInvestment: newGoal })}
                />
                <div className={`rounded-xl border p-6 shadow-sm flex flex-col items-center justify-center text-center transition-colors ${availableGolfFund > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                  <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">Available Golf Fund</h3>
                  <div className={`text-4xl font-extrabold ${availableGolfFund > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {formatCurrency(availableGolfFund)}
                  </div>
                  <p className="text-sm text-slate-500 mt-2">
                    {remainingToRecoup > 0 ? "Unlock by recouping initial investment first" : "Ready for the course!"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'revenue' && <RevenueLog revenues={revenues} onAdd={(data) => handleAdd('revenues', data)} onDelete={(id) => handleDelete('revenues', id)} formatCurrency={formatCurrency} />}
        {activeTab === 'expenses' && <ExpenseTracker expenses={expenses} onAdd={(data) => handleAdd('expenses', data)} onDelete={(id) => handleDelete('expenses', id)} formatCurrency={formatCurrency} />}
        {activeTab === 'equity' && <OwnerEquity equities={equities} initialGoal={initialGoal} onAdd={(data) => handleAdd('equities', data)} onDelete={(id) => handleDelete('equities', id)} formatCurrency={formatCurrency} />}
        {activeTab === 'mileage' && <MileageLog mileages={mileages} onAdd={(data) => handleAdd('mileages', data)} onDelete={(id) => handleDelete('mileages', id)} formatCurrency={formatCurrency} />}
        {activeTab === 'cogs' && <Manufacturing cogs={cogs} onUpdate={handleUpdateCogs} costPerTrainer={costPerTrainer} petgCostPerGram={petgCostPerGram} formatCurrency={formatCurrency} />}
        {activeTab === 'tax' && <TaxSummary revenues={revenues} expenses={expenses} mileages={mileages} formatCurrency={formatCurrency} />}

      </main>
    </div>
  );
}

// --- SUB-COMPONENTS ---
function ProgressCard({ totalEquityPaid, initialGoal, remainingToRecoup, formatCurrency, onUpdateGoal }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempGoal, setTempGoal] = useState(initialGoal);

  const handleSave = () => {
    onUpdateGoal(Number(tempGoal));
    setIsEditing(false);
  };

  const percentComplete = initialGoal > 0 ? Math.min(100, (totalEquityPaid / initialGoal) * 100) : 100;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col items-center text-center relative group">
      <div className="absolute top-4 right-4">
        {!isEditing && (
          <button onClick={() => setIsEditing(true)} className="text-slate-300 hover:text-blue-500 transition-colors p-1" title="Edit Initial Goal">
            <Edit2 size={16} />
          </button>
        )}
      </div>
      <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">Remaining to Recoup</h3>
      <div className="text-3xl font-bold text-slate-800 mb-1">{formatCurrency(remainingToRecoup)}</div>
      <div className="w-full bg-slate-200 rounded-full h-2.5 mt-4">
        <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${percentComplete}%` }}></div>
      </div>
      {isEditing ? (
        <div className="flex items-center space-x-2 mt-3">
          <span className="text-sm text-slate-500">Goal: $</span>
          <input type="number" className="border border-slate-300 rounded px-2 py-1 w-24 text-sm outline-none focus:border-blue-500" value={tempGoal} onChange={(e) => setTempGoal(e.target.value)} />
          <button onClick={handleSave} className="bg-blue-100 text-blue-600 p-1.5 rounded hover:bg-blue-200"><Check size={14} /></button>
        </div>
      ) : (
        <p className="text-xs text-slate-500 mt-3">Progress to {formatCurrency(initialGoal)} initial investment</p>
      )}
    </div>
  );
}

function DashboardCard({ title, amount, subtitle, color, isNegative, highlight }) {
  const colorMap = { blue: 'text-blue-600', red: 'text-red-600', emerald: 'text-emerald-600', orange: 'text-orange-600', indigo: 'text-indigo-600' };
  return (
    <div className={`bg-white rounded-xl border p-6 shadow-sm ${highlight ? 'ring-2 ring-emerald-500/20 shadow-md' : 'border-slate-200'}`}>
      <h3 className="text-sm font-medium text-slate-500">{title}</h3>
      <div className={`text-3xl font-bold mt-2 ${colorMap[color]}`}>
        {isNegative && amount > 0 ? '-' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)}
      </div>
      <p className="text-xs text-slate-400 mt-2">{subtitle}</p>
    </div>
  );
}

function RevenueLog({ revenues, onAdd, onDelete, formatCurrency }) {
  const [formData, setFormData] = useState({ date: '', orderNum: '', desc: '', gross: '', ebay: '', ad: '', shipping: '' });
  const addRow = (e) => { e.preventDefault(); if (!formData.gross) return; onAdd(formData); setFormData({ date: '', orderNum: '', desc: '', gross: '', ebay: '', ad: '', shipping: '' }); };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-slate-800">Add New Sale</h2>
        <form onSubmit={addRow} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-4">
          <input type="date" className="input-field col-span-1" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
          <input type="text" placeholder="Order #" className="input-field col-span-1" value={formData.orderNum} onChange={e => setFormData({...formData, orderNum: e.target.value})} />
          <input type="text" placeholder="Description" className="input-field col-span-1 sm:col-span-1" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} required />
          <input type="number" step="0.01" placeholder="Gross ($)" className="input-field" value={formData.gross} onChange={e => setFormData({...formData, gross: e.target.value})} required />
          <input type="number" step="0.01" placeholder="eBay Fee ($)" className="input-field" value={formData.ebay} onChange={e => setFormData({...formData, ebay: e.target.value})} />
          <input type="number" step="0.01" placeholder="Ad Fee ($)" className="input-field" value={formData.ad} onChange={e => setFormData({...formData, ad: e.target.value})} />
          <input type="number" step="0.01" placeholder="Shipping ($)" className="input-field" value={formData.shipping} onChange={e => setFormData({...formData, shipping: e.target.value})} />
          <button type="submit" className="md:col-span-7 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center transition-colors">
            <Plus size={18} className="mr-2" /> Add Sale
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="p-4 font-medium">Date</th><th className="p-4 font-medium">Order #</th><th className="p-4 font-medium">Description</th>
                <th className="p-4 font-medium text-right">Gross</th><th className="p-4 font-medium text-right text-red-500">eBay Fee</th>
                <th className="p-4 font-medium text-right text-red-500">Ad Fee</th><th className="p-4 font-medium text-right text-red-500">Shipping</th>
                <th className="p-4 font-medium text-right text-emerald-600">Net Payout</th><th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {revenues.length === 0 ? <tr><td colSpan="9" className="p-4 text-center text-slate-400">No records found.</td></tr> : revenues.map(r => {
                const net = Number(r.gross) - Number(r.ebay || 0) - Number(r.ad || 0) - Number(r.shipping || 0);
                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">{r.date}</td><td className="p-4 text-slate-500 font-mono text-xs">{r.orderNum || '-'}</td><td className="p-4">{r.desc}</td>
                    <td className="p-4 text-right font-medium">{formatCurrency(r.gross)}</td><td className="p-4 text-right text-slate-500">{formatCurrency(r.ebay || 0)}</td>
                    <td className="p-4 text-right text-slate-500">{formatCurrency(r.ad || 0)}</td><td className="p-4 text-right text-slate-500">{formatCurrency(r.shipping || 0)}</td>
                    <td className="p-4 text-right font-bold text-emerald-600">{formatCurrency(net)}</td>
                    <td className="p-4 text-right"><button onClick={() => onDelete(r.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button></td>
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

function ExpenseTracker({ expenses, onAdd, onDelete, formatCurrency }) {
  const [formData, setFormData] = useState({ date: '', desc: '', category: 'Supplies', amount: '' });
  const categories = ['Supplies', 'Advertising', 'Travel', 'Equipment', 'Office'];
  const addRow = (e) => { e.preventDefault(); if (!formData.amount) return; onAdd(formData); setFormData({ date: '', desc: '', category: 'Supplies', amount: '' }); };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-slate-800">Log Expense</h2>
        <form onSubmit={addRow} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <input type="date" className="input-field" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
          <input type="text" placeholder="Description" className="input-field" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} required />
          <select className="input-field" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
          <input type="number" step="0.01" placeholder="Amount ($)" className="input-field" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required />
          <button type="submit" className="sm:col-span-4 bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center transition-colors">
            <Plus size={18} className="mr-2" /> Add Expense
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
            <tr><th className="p-4 font-medium">Date</th><th className="p-4 font-medium">Description</th><th className="p-4 font-medium">Category</th><th className="p-4 font-medium text-right">Amount</th><th className="p-4"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expenses.map(e => (
              <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4">{e.date}</td><td className="p-4">{e.desc}</td><td className="p-4"><span className="px-2 py-1 bg-slate-100 rounded text-xs">{e.category}</span></td>
                <td className="p-4 text-right font-medium">{formatCurrency(e.amount)}</td><td className="p-4 text-right"><button onClick={() => onDelete(e.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OwnerEquity({ equities, initialGoal, onAdd, onDelete, formatCurrency }) {
  const [formData, setFormData] = useState({ date: '', desc: '', amount: '' });
  const addRow = (e) => { e.preventDefault(); onAdd(formData); setFormData({ date: '', desc: '', amount: '' }); };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-slate-800">Record Payout (Recouping {formatCurrency(initialGoal)})</h2>
        <form onSubmit={addRow} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input type="date" className="input-field" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
          <input type="text" placeholder="Description (e.g. Owner Draw)" className="input-field" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} required />
          <input type="number" step="0.01" placeholder="Amount ($)" className="input-field" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required />
          <button type="submit" className="sm:col-span-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center transition-colors"><Plus size={18} className="mr-2" /> Log Equity Payment</button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
            <tr><th className="p-4 font-medium">Date</th><th className="p-4 font-medium">Description</th><th className="p-4 font-medium text-right">Amount</th><th className="p-4"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {equities.map(e => (
              <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4">{e.date}</td><td className="p-4">{e.desc}</td><td className="p-4 text-right font-medium">{formatCurrency(e.amount)}</td>
                <td className="p-4 text-right"><button onClick={() => onDelete(e.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MileageLog({ mileages, onAdd, onDelete, formatCurrency }) {
  const [formData, setFormData] = useState({ date: '', desc: '', miles: '' });
  const RATE_2026 = 0.725;
  const addRow = (e) => { e.preventDefault(); onAdd(formData); setFormData({ date: '', desc: '', miles: '' }); };

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
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
            <tr><th className="p-4 font-medium">Date</th><th className="p-4 font-medium">Trip Description</th><th className="p-4 font-medium text-right">Miles</th><th className="p-4 font-medium text-right text-blue-600">Deduction Value</th><th className="p-4"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {mileages.map(m => (
              <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4">{m.date}</td><td className="p-4">{m.desc}</td><td className="p-4 text-right font-medium">{m.miles} mi</td>
                <td className="p-4 text-right font-bold text-blue-600">{formatCurrency(m.miles * RATE_2026)}</td><td className="p-4 text-right"><button onClick={() => onDelete(m.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Manufacturing({ cogs, onUpdate, costPerTrainer, petgCostPerGram, formatCurrency }) {
  const handleChange = (e) => { onUpdate({ ...cogs, [e.target.name]: Number(e.target.value) }); };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-slate-800">COGS Variables</h2>
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Cost of Spool (PETG)</label><div className="relative"><span className="absolute left-3 top-2.5 text-slate-400">$</span><input type="number" step="0.01" name="spoolCost" value={cogs.spoolCost} onChange={handleChange} className="input-field pl-8" /></div></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Grams Used Per Trainer</label><input type="number" name="gramsUsed" value={cogs.gramsUsed} onChange={handleChange} className="input-field" /></div>
            <hr className="border-slate-100 my-4" />
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Concrete Cost per lb</label><div className="relative"><span className="absolute left-3 top-2.5 text-slate-400">$</span><input type="number" step="0.01" name="concreteCost" value={cogs.concreteCost} onChange={handleChange} className="input-field pl-8" /></div></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">lbs Used Per Trainer</label><input type="number" step="0.1" name="lbsUsed" value={cogs.lbsUsed} onChange={handleChange} className="input-field" /></div>
            <hr className="border-slate-100 my-4" />
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Box / Packaging Cost</label><div className="relative"><span className="absolute left-3 top-2.5 text-slate-400">$</span><input type="number" step="0.01" name="boxCost" value={cogs.boxCost} onChange={handleChange} className="input-field pl-8" /></div></div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-md text-white flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10"><Settings size={120} className="animate-[spin_20s_linear_infinite]" /></div>
          <h2 className="text-xl font-semibold mb-6 text-slate-200 z-10">Cost Per Unit Breakdown</h2>
          <div className="space-y-4 z-10">
            <div className="flex justify-between items-center border-b border-slate-700 pb-2"><span className="text-slate-400">PETG Cost</span><span className="font-medium">{formatCurrency(petgCostPerGram * cogs.gramsUsed)}</span></div>
            <div className="flex justify-between items-center border-b border-slate-700 pb-2"><span className="text-slate-400">Concrete Cost</span><span className="font-medium">{formatCurrency(cogs.concreteCost * cogs.lbsUsed)}</span></div>
            <div className="flex justify-between items-center border-b border-slate-700 pb-2"><span className="text-slate-400">Box & Packaging</span><span className="font-medium">{formatCurrency(cogs.boxCost)}</span></div>
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
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
          <div><h2 className="text-xl font-bold text-slate-800">Schedule C Preparer</h2></div>
          <div className="text-right"><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tax Year</p><p className="text-xl font-bold text-indigo-600">2026</p></div>
        </div>
        <div className="mb-8"><h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2 bg-slate-100 p-2 rounded">Part I: Income</h3><TaxLine line="1" description="Gross receipts or sales" amount={grossSales} /><TaxLine line="7" description="Gross income" amount={grossSales} isTotal /></div>
        <div className="mb-8">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2 bg-slate-100 p-2 rounded">Part II: Expenses</h3>
          <TaxLine line="8" description="Advertising" amount={expAdvertising} /><TaxLine line="9" description="Car/truck expenses" amount={mileageDeduction} />
          <TaxLine line="10" description="Commissions and fees" amount={ebayAdFees} /><TaxLine line="18" description="Office expense" amount={expOffice} />
          <TaxLine line="22" description="Supplies" amount={expSupplies} /><TaxLine line="24a" description="Travel" amount={expTravel} />
          <TaxLine line="27a" description="Other: Shipping Labels" amount={shippingFees} /><TaxLine line="27a" description="Other: Equipment" amount={expEquipment} />
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

// Ensure basic Tailwind + custom CSS works 
const style = document.createElement('style');
style.textContent = `
  .input-field { width: 100%; padding: 0.625rem 0.875rem; border-radius: 0.5rem; border: 1px solid #e2e8f0; background-color: #f8fafc; font-size: 0.875rem; transition: all 0.2s; outline: none; }
  .input-field:focus { border-color: #3b82f6; background-color: #ffffff; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
  .hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`;
document.head.appendChild(style);