import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShieldCheck, FileText, Settings, Loader2, X, 
  Globe, Scale, AlertCircle, History, BookOpen, 
  Search, Key, Download, ChevronUp, ChevronDown, 
  CheckCircle2, AlertTriangle, Clock, User, LogOut, 
  ChevronRight, Menu, Shield, Briefcase, Activity,
  Home as HomeIcon, Save, Camera, FileUp, Info, CheckCircle, XCircle, 
  Plus, MoreVertical, Edit2, Star, Folder, ExternalLink, Library,
  LayoutDashboard, Bell, Search as SearchIcon, Cpu, Sparkles, Wand2, Map, History as HistoryIcon, Book,
  CloudUpload, Database, FileSpreadsheet, FileJson, Share2, Gavel, Calendar, Layers, RefreshCw, Hash,
  Copy
} from 'lucide-react';
import { Citation, AnalysisStats, CitationFilter, ReportJournalEntry, ViewState, HistoricalContextData } from '../types';
import { extractCitations, highlightText } from '../services/citationService';
import { verifyCitationWithGemini, getHistoricalContext } from '../services/geminiService';
import { lookupCitationOnCourtListener } from '../services/courtListenerService';
import CitationCard from './CitationCard';
import StatsPanel from './StatsPanel';

const JOURNAL_STORAGE_KEY = 'lexicite_journal_history';
const CL_KEY_STORAGE_KEY = 'lexicite_cl_api_key';
const DEFAULT_CL_KEY = "3149ff4a1dfd96b754c754c75d1afc4366e2177c1f2f";
const CL_HELP_URL = "https://www.courtlistener.com/help/api/rest/";

const VerificationOverlay: React.FC<{ message?: string }> = ({ message }) => {
  const [msgIndex, setMsgIndex] = useState(0);
  const messages = ["Consulting Legal Repositories...", "Auditing Precedential History...", "Scanning for Hallucinations...", "Synchronizing with CourtListener...", "Validating Bluebook Formatting...", "Cross-referencing Overruling Decisions...", "Finalizing Authority Trust Scores..."];
  useEffect(() => {
    const timer = setInterval(() => setMsgIndex((prev) => (prev + 1) % messages.length), 2500);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="fixed inset-0 z-[2000] bg-[#0b3a6f]/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-white animate-in fade-in duration-500">
      <div className="scan-line" />
      <div className="relative">
        <div className="absolute inset-0 bg-orange-500 rounded-full blur-[80px] opacity-30 animate-pulse-fast" />
        <div className="relative w-40 h-40 flex items-center justify-center">
           <div className="absolute inset-0 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin-slow" />
           <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center backdrop-blur-md border border-white/10 shadow-2xl">
             <Scale size={48} className="text-orange-400 drop-shadow-[0_0_15px_rgba(243,146,0,0.8)]" />
           </div>
        </div>
      </div>
      <div className="mt-12 text-center space-y-4 max-w-sm">
        <h2 className="text-2xl font-black tracking-tighter italic uppercase text-orange-100">AI Authority Audit</h2>
        <p className="text-sm font-bold text-orange-400 uppercase tracking-[0.2em]">{message || messages[msgIndex]}</p>
      </div>
    </div>
  );
};

const BluebookGuide: React.FC<{ onReturn: () => void; onVerify: (text: string) => void }> = ({ onReturn, onVerify }) => {
  const [activeBBTab, setActiveBBTab] = useState('cases');
  const bbContent = {
    cases: {
      title: "Case Citations (Rule 2.1)",
      rules: [
        { name: "Case Name", desc: "Italicize or underline. Use 'v.' and abbreviate according to Rule T6.", ex: "Miranda v. Arizona" },
        { name: "Volume & Reporter", desc: "Volume number followed by reporter abbreviation.", ex: "384 U.S." },
        { name: "First Page", desc: "The starting page of the case in the reporter.", ex: "436" },
        { name: "Pincite", desc: "Specific page referenced, preceded by a comma.", ex: "384 U.S. 436, 440" },
        { name: "Court & Year", desc: "Parenthetical containing the court (if not clear from reporter) and year.", ex: "(1966)" }
      ]
    },
    statutes: {
      title: "Statutes & Codes (Rule 2.2)",
      rules: [
        { name: "Federal Statute", desc: "Title number, code abbreviation, and section symbol.", ex: "18 U.S.C. § 1001" },
        { name: "Section Symbol", desc: "Use § for one section, §§ for multiple.", ex: "§ 1001(a)(1)" },
        { name: "State Code", desc: "Varies by jurisdiction; check Rule T1.", ex: "CAL. PENAL CODE § 187" }
      ]
    },
    electronic: {
      title: "Electronic Sources",
      rules: [
        { name: "Websites", desc: "Author, Title, URL (Date of visit).", ex: "The Bluebook: A Uniform System of Citation, https://www.legalbluebook.com (last visited May 1, 2024)" },
        { name: "Westlaw/Lexis", desc: "Include database identifier if not in print.", ex: "2024 WL 123456" }
      ]
    }
  };

  return (
    <div className="flex-1 overflow-y-auto pb-20 px-6 lg:px-12 pt-10 bg-[#f6f8fb]">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="animate-in slide-in-from-left duration-500">
            <button onClick={onReturn} className="mb-4 flex items-center gap-2 text-[#0b3a6f] font-black text-[10px] uppercase tracking-widest hover:translate-x-[-4px] transition-all">
              <ChevronRight className="rotate-180" size={14} /> Back to Dashboard
            </button>
            <h1 className="text-[34px] font-black text-[#0b3a6f] tracking-tight">Bluebook Guide</h1>
            <p className="text-[#6b7280] font-medium">Professional standards for legal citation based on Cornell Law methodology.</p>
          </div>
        </div>

        <div className="flex p-1.5 bg-white border border-[#e6edf4] rounded-[2rem] shadow-sm max-w-lg mx-auto">
            {Object.keys(bbContent).map((k) => (
              <button 
                key={k} 
                onClick={() => setActiveBBTab(k)}
                className={`flex-1 py-4 text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all ${activeBBTab === k ? 'bg-[#0b3a6f] text-white shadow-lg' : 'text-gray-400 hover:text-[#0b3a6f]'}`}
              >
                {k}
              </button>
            ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="space-y-6">
             <h3 className="text-[12px] font-black uppercase tracking-[0.25em] text-[#94a3b8] flex items-center gap-2">
               <Shield size={14} /> Basic Components
             </h3>
             <div className="space-y-4">
               {(bbContent as any)[activeBBTab].rules.map((rule: any, i: number) => (
                 <div key={i} className="bg-white border border-[#e6edf4] rounded-[1.8rem] p-6 shadow-sm hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-lg font-black text-[#0b3a6f]">{rule.name}</h4>
                      <div className="bg-[#f39200]/10 text-[#f39200] px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Rule Match</div>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed mb-4">{rule.desc}</p>
                    <div className="bg-[#f6f8fb] rounded-xl p-4 border border-[#e6edf4] font-mono text-xs text-[#1f2937] flex justify-between items-center group">
                      <span>{rule.ex}</span>
                      <button 
                        onClick={() => navigator.clipboard.writeText(rule.ex)}
                        className="opacity-0 group-hover:opacity-100 p-2 bg-white rounded-lg text-[#0b3a6f] hover:bg-gray-100 transition-all shadow-sm"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                 </div>
               ))}
             </div>
          </div>

          <div className="space-y-8">
             <div className="bg-[#0b3a6f] rounded-[2.2rem] p-8 text-white shadow-2xl shadow-[#0b3a6f]/20">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-6">
                  <Info className="text-white" size={24} />
                </div>
                <h3 className="text-xl font-black mb-4">Pro Tip: Pincites</h3>
                <p className="text-sm leading-relaxed text-white/80 font-medium">
                  "When referencing a specific point within a case, you must include the first page of the case followed by a comma and the specific page number. This is critical for trial briefs and motions."
                </p>
                <div className="mt-8 flex gap-4">
                  <button onClick={() => onVerify("Miranda v. Arizona, 384 U.S. 436")} className="px-6 py-3 bg-white text-[#0b3a6f] rounded-xl text-[11px] font-black uppercase tracking-widest hover:scale-105 transition-all">Start Verifying</button>
                </div>
             </div>

             <div className="bg-white rounded-[2.2rem] border border-[#e6edf4] p-8 shadow-sm">
                <h3 className="text-[12px] font-black uppercase tracking-[0.25em] text-[#94a3b8] mb-6">Common Abbreviations (T6)</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { full: 'California', ab: 'Cal.' },
                    { full: 'Association', ab: 'Ass\'n' },
                    { full: 'Department', ab: 'Dep\'t' },
                    { full: 'Insurance', ab: 'Ins.' },
                    { full: 'Government', ab: 'Gov\'t' },
                    { full: 'University', ab: 'Univ.' }
                  ].map((abb, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-[#f6f8fb] rounded-xl border border-[#e6edf4]">
                       <span className="text-[10px] font-bold text-gray-400">{abb.full}</span>
                       <span className="text-xs font-black text-[#0b3a6f]">{abb.ab}</span>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('library');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [courtListenerKey, setCourtListenerKey] = useState(() => localStorage.getItem(CL_KEY_STORAGE_KEY) || DEFAULT_CL_KEY);
  
  const [inputText, setInputText] = useState('');
  const [libSearchInput, setLibSearchInput] = useState('');
  const [histSearchInput, setHistSearchInput] = useState('');
  
  const [citations, setCitations] = useState<Citation[]>([]);
  const [activeTab, setActiveTab] = useState<CitationFilter>('all');
  const [isInspectionPanelOpen, setIsInspectionPanelOpen] = useState(true);

  const [histData, setHistData] = useState<HistoricalContextData | null>(null);
  const [isLoadingHist, setIsLoadingHist] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [journal, setJournal] = useState<ReportJournalEntry[]>(() => {
    const saved = localStorage.getItem(JOURNAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    if (currentView === 'editor' && inputText.trim()) {
      const extracted = extractCitations(inputText);
      setCitations(prev => extracted.map(newCite => prev.find(p => p.originalText === newCite.originalText && p.startIndex === newCite.startIndex) || newCite));
    }
  }, [inputText, currentView]);

  useEffect(() => {
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(journal));
  }, [journal]);

  const stats: AnalysisStats = useMemo(() => {
    if (!citations.length) return { total: 0, valid: 0, invalid: 0, pending: 0 };
    return {
      total: citations.length,
      valid: citations.filter(c => c.status === 'valid' && (c.legalStatus === 'good' || c.legalStatus === 'verified' || c.legalStatus === 'unknown')).length,
      invalid: citations.filter(c => ['hallucination', 'error'].includes(c.status) || ['overruled', 'superseded', 'retracted'].includes(c.legalStatus || '')).length,
      pending: citations.filter(c => c.status === 'pending' || c.status === 'checking').length
    };
  }, [citations]);

  // Dynamic Ticker Calculations
  const liveTickerData = useMemo(() => {
    const historicalTotal = journal.reduce((acc, entry) => acc + (entry.stats.total || 0), 0);
    const historicalValid = journal.reduce((acc, entry) => acc + (entry.stats.valid || 0), 0);
    const grandTotal = historicalTotal + stats.total;
    const grandValid = historicalValid + stats.valid;
    const integrityRating = grandTotal > 0 ? Math.round((grandValid / grandTotal) * 100) : 100;

    return {
      grandTotal: grandTotal.toLocaleString(),
      activeBuffer: stats.total,
      journalSize: journal.length,
      integrity: integrityRating
    };
  }, [journal, stats]);

  const filteredCitations = useMemo(() => {
    if (activeTab === 'all') return citations;
    if (activeTab === 'issues') return citations.filter(c => ['hallucination', 'error'].includes(c.status) || ['overruled', 'superseded'].includes(c.legalStatus || ''));
    if (activeTab === 'valid') return citations.filter(c => c.status === 'valid' && ['good', 'verified'].includes(c.legalStatus || ''));
    return citations;
  }, [citations, activeTab]);

  const syncToCloud = async (entry: ReportJournalEntry) => {
    try {
      setIsSyncing(true);
      await fetch('report.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
    } catch (e) {
      console.warn("Cloud Sync failed (expected if report.php not on same domain):", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncFullDatasetToCloud = async () => {
    try {
      setIsSyncing(true);
      await fetch('report.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'FULL_DATASET_REPORT', timestamp: Date.now(), journalCount: journal.length, data: journal })
      });
    } catch (e) {
      console.warn("Full Cloud Sync failed:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const runVerificationBatch = async (textOverride?: string) => {
    const textToProcess = textOverride !== undefined ? textOverride : inputText;
    if (!textToProcess.trim()) return;
    
    setIsAnalyzing(true);
    const extracted = extractCitations(textToProcess);
    setCitations(extracted);
    
    const results = await Promise.all(extracted.map(async (cite) => {
      setCitations(p => p.map(c => c.id === cite.id ? { ...c, status: 'checking' } : c));
      try {
        const result = await verifyCitationWithGemini(cite.originalText, 'standard');
        let clData = null;
        if (courtListenerKey && result.isValid) {
          clData = await lookupCitationOnCourtListener(cite.originalText, courtListenerKey);
        }
        const updatedCite: Citation = { 
          ...cite, 
          status: result.isValid ? 'valid' : 'hallucination', 
          caseName: clData?.caseName || result.caseName || undefined, 
          legalStatus: result.legalStatus, 
          reason: result.reason, 
          areaOfLaw: result.areaOfLaw,
          sources: clData?.absolute_url ? [{ uri: clData.absolute_url, title: 'CourtListener' }, ...(result.sources || [])] : result.sources,
          supersedingCase: result.supersedingCase
        };
        setCitations(p => p.map(c => c.id === cite.id ? updatedCite : c));
        return updatedCite;
      } catch (e) { 
        return { ...cite, status: 'error' as const, reason: "Verification failed." }; 
      }
    }));
    
    setIsAnalyzing(false);
    setIsInspectionPanelOpen(true);
    
    const newEntry: ReportJournalEntry = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      documentTitle: textToProcess.substring(0, 40).trim() + (textToProcess.length > 40 ? "..." : ""),
      status: 'verified',
      stats: {
        total: results.length,
        valid: results.filter(r => r.status === 'valid').length,
        invalid: results.filter(r => r.status === 'hallucination' || r.status === 'error').length,
        pending: 0
      },
      findings: results.map(r => ({
        text: r.originalText,
        status: r.status,
        caseName: r.caseName,
        legalStatus: r.legalStatus,
        areaOfLaw: r.areaOfLaw
      }))
    };
    setJournal(prev => [newEntry, ...prev]);
    syncToCloud(newEntry);
  };

  const handleFetchHistorical = async (q: string) => {
    if (!q.trim()) return;
    setIsLoadingHist(true);
    const data = await getHistoricalContext(q);
    if (data) setHistData(data);
    setIsLoadingHist(false);
  };

  const applyCorrection = (id: string, newCitation: string, newCaseName: string) => {
    const cite = citations.find(c => c.id === id);
    if (!cite) return;
    const newText = inputText.substring(0, cite.startIndex) + newCitation + inputText.substring(cite.endIndex);
    setInputText(newText);
    setCitations(prev => prev.filter(c => c.id !== id));
  };

  const handleAcceptCorrection = (id: string) => {
    setCitations(prev => prev.map(c => {
      if (c.id === id && c.supersedingCase) {
        return { ...c, status: 'valid', caseName: c.supersedingCase.name, legalStatus: 'verified' as const };
      }
      return c;
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsAnalyzing(true);
      // Simulated extraction logic
      setTimeout(() => {
        const simulatedText = `MEMORANDUM OF LAW\n\nPursuant to the holding in Brown v. Board of Education, 347 U.S. 483 (1954), the principle of separate but equal is unconstitutional. See also Miranda v. Arizona, 384 U.S. 436 (1966) regarding the requirement of procedural safeguards for custodial interrogation. Furthermore, 18 U.S.C. § 1001 provides penalties for false statements.`;
        setInputText(simulatedText);
        setIsAnalyzing(false);
        setCurrentView('editor');
        runVerificationBatch(simulatedText);
      }, 2000);
    }
  };

  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      setIsCameraActive(false);
      alert("Camera access is required for scanning.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
    setIsCameraActive(false);
  };

  const captureScan = () => {
    setIsAnalyzing(true);
    stopCamera();
    setTimeout(() => {
      const simulatedScan = "Based on the authority of Gideon v. Wainwright, 372 U.S. 335 (1963), the Sixth Amendment right to counsel is a fundamental right. Compare with Roe v. Wade, 410 U.S. 113.";
      setInputText(simulatedScan);
      setIsAnalyzing(false);
      setCurrentView('editor');
      runVerificationBatch(simulatedScan);
    }, 1500);
  };

  const renderEcosystemPlaceholder = (id: string, title: string, icon: React.ReactNode) => (
    <div className="flex-1 overflow-y-auto pb-20 px-6 pt-10 bg-[#f6f8fb]">
      <div className="max-w-4xl mx-auto text-center space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-white border border-[#e6edf4] rounded-[2rem] flex items-center justify-center mx-auto text-[#0b3a6f] shadow-sm">
          {icon}
        </div>
        <div>
          <h1 className="text-4xl font-black text-[#0b3a6f] tracking-tight">{title}</h1>
          <p className="text-gray-500 mt-2 max-w-lg mx-auto">This LexiCite Ecosystem module is currently under active development. Integration with the 2025 Precedent Engine is in progress.</p>
        </div>
        <button 
          onClick={() => setCurrentView('library')}
          className="bg-[#0b3a6f] text-white px-8 h-14 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-[#092a52] transition-all shadow-xl shadow-[#0b3a6f]/20"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );

  const renderHistoricalContext = () => (
    <div className="flex-1 overflow-y-auto pb-20 px-6 lg:px-12 pt-10 bg-[#f6f8fb]">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="animate-in slide-in-from-left duration-500">
            <button onClick={() => setCurrentView('library')} className="mb-4 flex items-center gap-2 text-[#0b3a6f] font-black text-[10px] uppercase tracking-widest hover:translate-x-[-4px] transition-all">
              <ChevronRight className="rotate-180" size={14} /> Back to Dashboard
            </button>
            <h1 className="text-[34px] font-black text-[#0b3a6f] tracking-tight">Historical Context</h1>
            <p className="text-[#6b7280] font-medium">Surface the era, court climate, and social forces surrounding decisions.</p>
          </div>
          {histData && (
            <div className="flex items-center gap-3">
               <span className="px-4 py-2 bg-white border border-[#e6edf4] rounded-2xl text-[12px] font-bold text-[#0b3a6f] shadow-sm flex items-center gap-2">
                 <span className="material-symbols-outlined text-[16px]">history</span> 
                 Era: {histData.era}
               </span>
               <span className="px-4 py-2 bg-[#f39200]/10 text-[#f39200] border border-[#f39200]/20 rounded-2xl text-[12px] font-bold shadow-sm">
                 Topic: {histData.topic}
               </span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-[2rem] border border-[#e6edf4] p-2 shadow-sm flex items-center group focus-within:ring-4 focus-within:ring-[#0b3a6f]/5 transition-all">
          <div className="w-14 h-14 flex items-center justify-center text-[#94a3b8] group-focus-within:text-[#0b3a6f]">
             <SearchIcon size={22} />
          </div>
          <input 
            type="text" 
            value={histSearchInput}
            onChange={(e) => setHistSearchInput(e.target.value)}
            placeholder="Search case history (e.g., Miranda v. Arizona)..."
            className="flex-1 h-14 bg-transparent border-none focus:ring-0 text-lg font-medium text-[#0b3a6f]"
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleFetchHistorical(histSearchInput);
            }}
          />
          <button 
            disabled={isLoadingHist || !histSearchInput}
            onClick={() => handleFetchHistorical(histSearchInput)}
            className="bg-[#0b3a6f] text-white px-8 h-12 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-[#092a52] transition-all disabled:opacity-50"
          >
            {isLoadingHist ? <Loader2 size={18} className="animate-spin" /> : 'Explore History'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
             <h3 className="text-[12px] font-black uppercase tracking-[0.25em] text-[#94a3b8] flex items-center gap-2">
               <Calendar size={14} /> Landmark Timeline
             </h3>
             <div className="space-y-4">
               {(histData?.timeline || [
                 { year: '1961', caseName: 'Mapp v. Ohio', summary: 'Exclusionary rule applied to the states; foundation for rights expansion.' },
                 { year: '1963', caseName: 'Gideon v. Wainwright', summary: 'Right to counsel affirmed for felony defendants.' },
                 { year: '1966', caseName: 'Miranda v. Arizona', summary: 'Miranda warnings introduced amid expanding civil liberties.' },
                 { year: '1968', caseName: 'Terry v. Ohio', summary: 'Stop-and-frisk established with reasonable suspicion standard.' }
               ]).map((event, i) => (
                 <div key={i} className="group relative bg-white border border-[#e6edf4] rounded-[1.8rem] p-6 hover:shadow-xl hover:border-[#0b3a6f]/20 transition-all cursor-pointer flex gap-6 animate-in slide-in-from-bottom duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                    <div className="flex flex-col items-center">
                       <div className="text-[18px] font-black text-[#0b3a6f] leading-none mb-2">{event.year}</div>
                       <div className="w-1 flex-1 bg-[#e6edf4] rounded-full group-last:bg-transparent" />
                    </div>
                    <div className="flex-1">
                       <h4 className="text-lg font-extrabold text-[#0b3a6f] mb-1">{event.caseName}</h4>
                       <p className="text-sm text-[#6b7280] leading-relaxed">{event.summary}</p>
                       <button 
                         onClick={(e) => { 
                           e.stopPropagation();
                           setInputText(event.caseName); 
                           setCurrentView('editor'); 
                           runVerificationBatch(event.caseName); 
                         }} 
                         className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#f39200] hover:text-[#0b3a6f] transition-colors"
                       >
                          <ShieldCheck size={14} /> Verify Authority
                       </button>
                    </div>
                    <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                       <ChevronRight size={20} className="text-[#0b3a6f]" />
                    </div>
                 </div>
               ))}
             </div>
          </div>

          <div className="space-y-6">
             <div className="bg-[#0b3a6f] rounded-[2.2rem] p-8 text-white shadow-2xl shadow-[#0b3a6f]/20 animate-in zoom-in duration-500">
                <h3 className="text-[12px] font-black uppercase tracking-[0.25em] text-white/50 mb-4">Context Brief</h3>
                <p className="text-sm leading-relaxed font-medium">
                  {histData?.brief || "The Warren Court presided over a period of dramatic expansion of individual rights, emphasizing due process and equality under the law as foundational pillars of the American legal system."}
                </p>
             </div>
             <div className="bg-white rounded-[2.2rem] border border-[#e6edf4] p-8 space-y-6 shadow-sm">
                <h3 className="text-[12px] font-black uppercase tracking-[0.25em] text-[#94a3b8]">Key Social Forces</h3>
                <div className="space-y-3">
                  {(histData?.keyForces || ["1964 Civil Rights Act aftermath", "Urban policing scrutiny", "Procedural safeguards shift"]).map((force, i) => (
                    <div key={i} className="flex items-start gap-3 p-4 bg-[#f6f8fb] rounded-2xl border border-[#e6edf4] text-[13px] font-bold text-[#0b3a6f]">
                       <div className="w-2 h-2 bg-[#f39200] rounded-full mt-1.5 shrink-0" />
                       {force}
                    </div>
                  ))}
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEditor = () => (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      <div className="h-20 sm:h-24 px-10 border-b flex justify-between items-center bg-white shrink-0 z-10">
        <div className="flex items-center gap-6">
          <button onClick={() => setCurrentView('library')} className="flex items-center gap-2 text-[#0b3a6f] font-bold text-xs uppercase tracking-[0.2em] hover:bg-[#eef2f7] px-4 py-2.5 rounded-xl transition-all">
            <ChevronRight className="rotate-180" size={20} /> Dashboard
          </button>
          <div className="hidden sm:flex items-center gap-3 text-[#1f2937] font-extrabold text-xl tracking-tight">
            <span className="material-symbols-outlined text-[#0b3a6f] text-[28px]">description</span>
            <input 
              defaultValue="Untitled Legal Research Brief" 
              className="border-none focus:ring-0 p-0 font-extrabold text-[#1f2937] bg-transparent min-w-[300px]"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
           <button onClick={() => { setInputText(''); setCitations([]); }} className="p-3 text-[#94a3b8] hover:text-[#ef4444] hover:bg-[#ef4444]/5 rounded-2xl transition-all" title="Clear All Text">
             <span className="material-symbols-outlined">delete</span>
           </button>
           <button 
             onClick={() => runVerificationBatch()}
             disabled={isAnalyzing || !inputText.trim()}
             className="bg-[#0b3a6f] text-white px-10 h-14 rounded-2xl text-[13px] font-bold uppercase tracking-[0.15em] shadow-xl shadow-[#0b3a6f]/20 disabled:opacity-50 flex items-center gap-3 hover:translate-y-[-1px] transition-all"
           >
             {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <span className="material-symbols-outlined text-[20px]">verified_user</span>}
             Verify Now
           </button>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative overflow-y-auto scrollbar-hide bg-[#f6f8fb] p-8">
          <div className="max-w-4xl mx-auto w-full relative bg-white min-h-[calc(100vh-200px)] rounded-[2rem] border border-[#e6edf4] shadow-sm overflow-hidden">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="absolute inset-0 w-full h-full p-12 sm:p-20 font-serif text-[18px] sm:text-[21px] leading-relaxed bg-transparent border-none focus:ring-0 resize-none z-10 text-transparent caret-[#0b3a6f]"
              spellCheck={false}
              placeholder="Paste legal text here for instant verification..."
            />
            <div className="p-12 sm:p-20 font-serif text-[18px] sm:text-[21px] leading-relaxed pointer-events-none break-words whitespace-pre-wrap">
              {highlightText(inputText, citations).map((s, i) => {
                const cite = citations.find(c => c.id === s.citationId);
                const isInvalid = cite?.status === 'hallucination' || ['overruled', 'superseded'].includes(cite?.legalStatus || '');
                const isChecking = cite?.status === 'checking';
                return (
                  <span key={i} className={s.isCitation ? `border-b-[4px] transition-all cursor-pointer pointer-events-auto rounded-sm ${isChecking ? 'bg-blue-50 border-[#0b3a6f] animate-pulse' : isInvalid ? 'bg-red-50 border-[#ef4444]' : 'bg-green-50/40 border-[#22c55e]'}` : ''} onClick={() => s.isCitation && setIsInspectionPanelOpen(true)}>
                    {s.text}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
        {isInspectionPanelOpen && (
          <aside className="hidden xl:flex w-[480px] bg-white border-l flex-col animate-in slide-in-from-right duration-500 relative z-20 overflow-hidden">
            <div className="p-8 border-b flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                 <span className="material-symbols-outlined text-[#0b3a6f] text-[28px]">fact_check</span>
                 <h2 className="font-extrabold text-[#1f2937] uppercase tracking-[0.2em] text-[14px]">Precedent Inspector</h2>
              </div>
              <button onClick={() => setIsInspectionPanelOpen(false)} className="p-3 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
              <StatsPanel stats={stats} />
              <div className="flex p-1.5 bg-[#f6f8fb] rounded-2xl border border-[#e6edf4]">
                  {(['all', 'issues', 'valid'] as CitationFilter[]).map(t => (
                    <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-3 text-[11px] font-bold uppercase rounded-xl transition-all ${activeTab === t ? 'bg-white text-[#0b3a6f] shadow-md border border-[#e6edf4]' : 'text-[#94a3b8] hover:text-[#1f2937]'}`}>{t}</button>
                  ))}
              </div>
              <div className="space-y-6">
                {filteredCitations.map(c => <CitationCard key={c.id} citation={c} fullText={inputText} onApplySuperseding={applyCorrection} onAcceptCorrection={handleAcceptCorrection} />)}
                {filteredCitations.length === 0 && (
                  <div className="py-24 text-center flex flex-col items-center gap-6 text-gray-200">
                    <span className="material-symbols-outlined text-[64px] opacity-10">search_off</span>
                    <p className="font-bold uppercase tracking-[0.3em] text-xs">No Audit Results</p>
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-[#f6f8fb] text-[#1f2937] overflow-hidden font-sans">
      {(isAnalyzing || isSyncing) && <VerificationOverlay message={isSyncing ? "Syncing data to secure cloud storage..." : undefined} />}
      
      {isCameraActive && (
        <div className="fixed inset-0 z-[3000] bg-black flex flex-col">
          <div className="absolute top-8 left-8 z-10">
            <button onClick={stopCamera} className="bg-white/10 hover:bg-white/20 p-4 rounded-full text-white backdrop-blur-md transition-all">
              <X size={28} />
            </button>
          </div>
          <video ref={videoRef} autoPlay playsInline className="flex-1 object-cover" />
          <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center gap-8">
            <div className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center p-1">
              <button onClick={captureScan} className="w-full h-full bg-white rounded-full hover:bg-white/90 active:scale-95 transition-all shadow-xl" />
            </div>
          </div>
          <div className="absolute bottom-32 left-0 right-0 text-center">
            <p className="text-white/60 font-black text-xs uppercase tracking-[0.3em]">Align citation within frame</p>
          </div>
        </div>
      )}

      <header className="h-20 sm:h-[88px] bg-white border-b border-[#e6edf4] shrink-0 z-50">
        <div className="max-w-[1200px] mx-auto h-full px-6 flex items-center justify-between">
           <div className="flex items-center gap-4 group cursor-pointer" onClick={() => setCurrentView('library')}>
              <div className="w-11 h-11 bg-[#0b3a6f] rounded-xl flex items-center justify-center text-white relative">
                 <span className="material-symbols-outlined">account_balance</span>
                 <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#f39200] rounded-full border-2 border-white shadow-sm" />
              </div>
              <span className="text-[26px] font-extrabold tracking-tight text-[#0b3a6f]">Lexi<span className="text-[#f39200]">Cite</span>360</span>
           </div>
           <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col text-right mr-2">
                 <p className="text-[13px] font-extrabold text-[#1f2937]">Advocate Sarah</p>
                 <p className="text-[10px] font-bold text-[#f39200] uppercase tracking-widest">Master Council</p>
              </div>
              <button onClick={() => setShowAdmin(true)} className="w-11 h-11 rounded-full bg-[#eef2f7] flex items-center justify-center text-gray-500 hover:bg-[#e2e8f0] transition-all">
                <span className="material-symbols-outlined">settings</span>
              </button>
           </div>
        </div>
      </header>

      {/* Live Data Ticker */}
      <div className="h-10 bg-[#f39200] text-white flex items-center justify-center px-6 overflow-hidden relative shrink-0 shadow-lg z-40">
        <div className="flex items-center gap-16 animate-marquee whitespace-nowrap">
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-black tracking-[0.2em] uppercase opacity-70">Total Authorities Scrutinized:</span>
            <span className="text-[14px] font-black tracking-[0.1em]">{liveTickerData.grandTotal}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-black tracking-[0.2em] uppercase opacity-70">Integrity Rating:</span>
            <span className="text-[14px] font-black tracking-[0.1em]">{liveTickerData.integrity}% Verified</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-black tracking-[0.2em] uppercase opacity-70">Active Session Buffer:</span>
            <span className="text-[14px] font-black tracking-[0.1em]">{liveTickerData.activeBuffer} Citations</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-black tracking-[0.2em] uppercase opacity-70">Journal History:</span>
            <span className="text-[14px] font-black tracking-[0.1em]">{liveTickerData.journalSize} Audit Records</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative flex flex-col">
        {currentView === 'library' && (
          <div className="flex-1 overflow-y-auto pb-12 px-6 sm:px-12 pt-10">
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-14 h-14 bg-[#e6f0fb] text-[#0b3a6f] rounded-2xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-[32px]">shield</span>
                </div>
                <h1 className="text-[34px] font-extrabold text-[#1f2937] tracking-tight">Hello, Advocate.</h1>
              </div>
              
              <div className="bg-white rounded-[1.5rem] border border-[#e6edf4] p-8 card-shadow space-y-6">
                <div>
                  <h2 className="text-[22px] font-bold text-[#1f2937] mb-1">Ready to Verify? Start here!</h2>
                  <p className="text-[#6b7280]">Quick search for case law or statutes</p>
                </div>
                <div className="space-y-2">
                  <div className="flex h-16 border border-[#e6edf4] bg-[#fdfdfd] rounded-2xl overflow-hidden shadow-sm group focus-within:ring-2 focus-within:ring-[#0b3a6f]/10 transition-colors">
                    <div className="w-16 flex items-center justify-center text-[#0b3a6f]">
                      <span className="material-symbols-outlined">search</span>
                    </div>
                    <input 
                      type="text" 
                      value={libSearchInput}
                      onChange={(e) => setLibSearchInput(e.target.value)}
                      placeholder="e.g., 347 U.S. 483"
                      className="flex-1 px-4 text-lg border-none bg-transparent focus:ring-0 placeholder-gray-400"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                           setInputText(libSearchInput);
                           setCurrentView('editor');
                           runVerificationBatch(libSearchInput);
                        }
                      }}
                    />
                    <button 
                      disabled={!libSearchInput.trim()}
                      onClick={() => { 
                        setInputText(libSearchInput); 
                        setCurrentView('editor'); 
                        runVerificationBatch(libSearchInput); 
                      }} 
                      className="bg-[#0b3a6f] text-white px-8 font-bold tracking-[0.1em] hover:bg-[#092a52] transition-colors disabled:opacity-50"
                    >
                      VERIFY
                    </button>
                  </div>
                  <div className="pl-4">
                    {courtListenerKey && courtListenerKey !== DEFAULT_CL_KEY ? (
                      <button 
                        onClick={() => setShowAdmin(true)}
                        className="text-red-500 underline text-[11px] font-black uppercase tracking-widest hover:text-red-600 transition-colors cursor-pointer"
                      >
                        Enter Token
                      </button>
                    ) : (
                      <a 
                        href={CL_HELP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-500 underline text-[11px] font-black uppercase tracking-widest hover:text-red-600 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        Get Token <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <button onClick={startCamera} className="flex items-center justify-center gap-3 h-[120px] bg-[#0b3a6f] text-white rounded-2xl font-bold text-lg shadow-xl shadow-[#0b3a6f]/20 hover:translate-y-[-2px] transition-all">
                    <Camera size={24} />
                    Scan Case
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-3 h-[120px] bg-white border-2 border-[#f39200] text-[#1f2937] rounded-2xl font-bold text-lg hover:bg-[#f39200]/5 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm">
                    <FileUp size={24} className="text-[#f39200]" />
                    Upload PDF
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.doc,.docx" onChange={handleFileUpload} />
                </div>
              </div>

              <div>
                <h3 className="text-[13px] font-black uppercase tracking-[0.3em] text-[#9aa7b6] mb-4">LexiCite Ecosystem</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { id: 'precedent', icon: <Map size={24} />, label: 'Precedent Map', color: '#f59e0b', bg: '#fff3e0' },
                    { id: 'historical', icon: <HistoryIcon size={24} />, label: 'Historical Context', color: '#2563eb', bg: '#e8f1ff' },
                    { id: 'bluebook', icon: <Book size={24} />, label: 'Bluebook Guide', color: '#64748b', bg: '#eef2f7' },
                    { id: 'casefinder', icon: <Search size={24} />, label: 'Case Finder', color: '#16a34a', bg: '#eaf8ef' }
                  ].map((item, i) => (
                    <div key={i} onClick={() => setCurrentView(item.id as ViewState)} className={`flex items-center gap-3 p-4 bg-white border ${currentView === item.id ? 'border-[#0b3a6f] ring-2 ring-[#0b3a6f]/10' : 'border-[#e6edf4]'} rounded-2xl hover:border-[#0b3a6f]/20 transition-all cursor-pointer group hover:-translate-y-1`}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: item.bg, color: item.color }}>
                        {item.icon}
                      </div>
                      <span className="text-[14px] font-bold text-[#1f2937]">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {journal.length > 0 && (
                <div className="border-t border-[#e6edf4] pt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[14px] font-black uppercase tracking-[0.2em] text-[#1f2937]">Recent Activity</h3>
                    <button onClick={() => setJournal([])} className="text-[11px] font-bold text-red-500 hover:underline uppercase tracking-widest">Clear History</button>
                  </div>
                  <div className="space-y-3">
                    {journal.map(entry => (
                      <div key={entry.id} onClick={() => { setInputText(entry.documentTitle); setCurrentView('editor'); runVerificationBatch(entry.documentTitle); }} className="flex items-center gap-4 bg-white border border-[#e6edf4] rounded-2xl p-4 hover:border-[#0b3a6f]/30 transition-all cursor-pointer group">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-sm ${entry.status === 'verified' ? 'bg-[#22c55e]' : 'bg-[#f59e0b]'}`}>
                          {entry.status === 'verified' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[#1f2937] truncate">{entry.documentTitle}</div>
                          <div className={`text-[10px] font-black uppercase tracking-widest ${entry.status === 'verified' ? 'text-[#16a34a]' : 'text-[#f59e0b]'}`}>
                            {entry.status === 'verified' ? 'AUDIT COMPLETE • VALID' : 'ACTION REQUIRED • AUDIT FAILED'}
                          </div>
                        </div>
                        <div className="text-[11px] text-[#9aa7b6] font-bold">
                          {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {currentView === 'editor' && renderEditor()}
        {currentView === 'historical' && renderHistoricalContext()}
        {currentView === 'bluebook' && <BluebookGuide onReturn={() => setCurrentView('library')} onVerify={(text) => { setInputText(text); setCurrentView('editor'); runVerificationBatch(text); }} />}
        {currentView === 'precedent' && renderEcosystemPlaceholder('precedent', 'Precedent Map', <Map size={48} />)}
        {currentView === 'casefinder' && renderEcosystemPlaceholder('casefinder', 'Case Finder', <Search size={48} />)}
      </div>

      <nav className="lg:hidden h-[72px] bg-white border-t border-[#e6edf4] flex items-center justify-around px-4 shrink-0">
        {[
          { id: 'library', icon: <HomeIcon size={22} />, label: 'Home' },
          { id: 'editor', icon: <FileText size={22} />, label: 'Verify' },
          { id: 'historical', icon: <HistoryIcon size={22} />, label: 'History' },
          { id: 'settings', icon: <Settings size={22} />, label: 'Config' }
        ].map(item => (
          <button 
            key={item.id}
            onClick={() => {
              if (item.id === 'settings') setShowAdmin(true);
              else setCurrentView(item.id as ViewState);
            }}
            className={`flex flex-col items-center gap-1 min-w-[64px] transition-all ${currentView === item.id ? 'text-[#0b3a6f]' : 'text-gray-400'}`}
          >
            {item.icon}
            <span className="text-[10px] font-black uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </nav>

      {showAdmin && (
        <div className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl flex flex-col animate-in zoom-in duration-300 overflow-hidden">
              <div className="p-8 flex items-center justify-between border-b border-[#e6edf4] bg-[#f6f8fb]">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-[#0b3a6f] text-white rounded-2xl"><Settings size={24} /></div>
                    <h2 className="text-2xl font-extrabold text-[#0b3a6f] tracking-tight">System Configuration</h2>
                 </div>
                 <button onClick={() => setShowAdmin(false)} className="p-3 bg-white hover:bg-gray-100 border border-[#e6edf4] rounded-full transition-all"><X size={24} /></button>
              </div>
              <div className="p-10 space-y-10">
                 <div className="flex items-center gap-8 p-8 bg-[#e6f0fb] rounded-[2rem] border border-[#0b3a6f]/10">
                    <div className="w-24 h-24 bg-[#0b3a6f] rounded-[1.8rem] flex items-center justify-center text-white text-4xl font-black italic">TP</div>
                    <div className="flex-1">
                       <h3 className="text-2xl font-extrabold text-[#0b3a6f]">Advocate Sarah</h3>
                       <p className="text-gray-500 font-bold">Managing Partner | LexiCite LAW</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <button onClick={syncFullDatasetToCloud} disabled={isSyncing} className="p-4 bg-white border border-[#e6edf4] rounded-2xl text-[#0b3a6f] hover:bg-gray-50 transition-all flex items-center gap-2 font-bold text-xs uppercase shadow-sm">
                          {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                          Manual Cloud Sync
                        </button>
                    </div>
                 </div>
                 <div className="space-y-4">
                   <div className="flex items-center justify-between">
                     <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest block">CourtListener API Token</label>
                     <a 
                       href={CL_HELP_URL}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="text-red-500 underline text-[10px] font-black uppercase tracking-widest hover:text-red-600 transition-colors flex items-center gap-1"
                     >
                       Generate New Token <ExternalLink size={10} />
                     </a>
                   </div>
                   <input 
                     type="password"
                     value={courtListenerKey}
                     onChange={(e) => {setCourtListenerKey(e.target.value); localStorage.setItem(CL_KEY_STORAGE_KEY, e.target.value);}}
                     className="w-full bg-[#f6f8fb] border-2 border-[#e6edf4] rounded-2xl py-6 px-8 font-mono focus:ring-4 focus:ring-[#0b3a6f]/5 outline-none shadow-inner"
                     placeholder="Enter Token..."
                   />
                 </div>
                 <div className="flex gap-4">
                   <button onClick={() => setShowAdmin(false)} className="flex-1 bg-[#0b3a6f] text-white h-16 rounded-2xl font-bold uppercase tracking-widest hover:bg-[#092a52] transition-all shadow-lg shadow-[#0b3a6f]/20">Save Configuration</button>
                   <button 
                    onClick={() => { setInputText(''); setJournal([]); setCurrentView('library'); setShowAdmin(false); }} 
                    className="flex-1 bg-white border-2 border-[#f39200] text-[#ef4444] h-16 rounded-2xl font-bold uppercase tracking-widest hover:bg-[#f39200]/5 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm"
                   >
                    Sign Out & Reset
                   </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;