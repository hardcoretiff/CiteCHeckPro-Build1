
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShieldCheck, Eraser, Settings, FileText, ChevronRight, ChevronLeft, Search, 
  Briefcase, Zap, Loader2, Code, RotateCcw, ArrowUpDown, Menu, X, 
  PanelRightClose, PanelRightOpen, Database, Globe, Scale, AlertCircle, Check, Trash2,
  Download, Copy, Key, Info, History, BookOpen, Share
} from 'lucide-react';
import { Citation, AnalysisStats, CitationFilter, SortOption, VerificationMode, ReportJournalEntry } from './types';
import { extractCitations, highlightText, DEFAULT_CITATION_PATTERN } from './services/citationService';
import { verifyCitationWithGemini } from './services/geminiService';
import { lookupCitationOnCourtListener } from './services/courtListenerService';
import CitationCard from './components/CitationCard';
import StatsPanel from './components/StatsPanel';

const TEXT_STORAGE_KEY = 'citeops_saved_text';
const TITLE_STORAGE_KEY = 'citeops_saved_title';
const CL_KEY_STORAGE_KEY = 'citeops_cl_api_key';
const JOURNAL_STORAGE_KEY = 'citeops_journal_history';
const AUTO_SAVE_INTERVAL = 30000;

const DEFAULT_CL_KEY = "3149ff4a1dfd96b754c754c75d1afc4366e2177c1f2f";

const DEFAULT_TEXT = `The legal framework regarding abortion has shifted significantly. 
Previously, the primary authority was Roe v. Wade, 410 U.S. 113 (1973). 
However, modern briefs must account for the ruling in Dobbs v. Jackson Women's Health Organization, 597 U.S. 215 (2022).
For criminal procedure, see Miranda v. Arizona, 384 U.S. 436 (1966).`;

const App: React.FC = () => {
  const [inputText, setInputText] = useState<string>(() => localStorage.getItem(TEXT_STORAGE_KEY) || DEFAULT_TEXT);
  const [documentTitle, setDocumentTitle] = useState(() => localStorage.getItem(TITLE_STORAGE_KEY) || "Precedent Verification: High-Value Brief");
  const [courtListenerKey, setCourtListenerKey] = useState(() => localStorage.getItem(CL_KEY_STORAGE_KEY) || DEFAULT_CL_KEY);
  const [journal, setJournal] = useState<ReportJournalEntry[]>(() => {
    const saved = localStorage.getItem(JOURNAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [citations, setCitations] = useState<Citation[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<CitationFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('status');
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [verificationMode, setVerificationMode] = useState<VerificationMode>('research');
  const [customRegex, setCustomRegex] = useState<string>(DEFAULT_CITATION_PATTERN);
  const [showSettings, setShowSettings] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [noCitationsFound, setNoCitationsFound] = useState(false);
  
  const [isGoogleSearchEnabled, setIsGoogleSearchEnabled] = useState(true);
  const [isCourtListenerEnabled, setIsCourtListenerEnabled] = useState(true);
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isInspectionPanelOpen, setIsInspectionPanelOpen] = useState(true);

  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textRef = useRef(inputText);
  const titleRef = useRef(documentTitle);

  useEffect(() => { 
    textRef.current = inputText;
    titleRef.current = documentTitle;
  }, [inputText, documentTitle]);

  useEffect(() => {
    const interval = setInterval(() => {
      localStorage.setItem(TEXT_STORAGE_KEY, textRef.current);
      localStorage.setItem(TITLE_STORAGE_KEY, titleRef.current);
    }, AUTO_SAVE_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(journal));
  }, [journal]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setIsSidebarCollapsed(true);
      if (window.innerWidth < 1280) setIsInspectionPanelOpen(false);
      else setIsInspectionPanelOpen(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const stats: AnalysisStats = useMemo(() => {
    if (!citations.length) return { total: 0, valid: 0, invalid: 0, pending: 0 };
    return {
      total: citations.length,
      valid: citations.filter(c => c.status === 'valid' && (c.legalStatus === 'good' || c.legalStatus === 'unknown')).length,
      invalid: citations.filter(c => c.status === 'hallucination' || c.legalStatus === 'overruled' || c.legalStatus === 'superseded').length,
      pending: citations.filter(c => c.status === 'pending' || c.status === 'checking').length
    };
  }, [citations]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputText(text);
    if (isLiveMode) {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      debounceTimeout.current = setTimeout(() => analyzeText(text), 1000);
    }
  };

  const handleApplySuperseding = (id: string, newName: string) => {
    setCitations(prev => prev.map(c => 
      c.id === id ? { ...c, status: 'valid', caseName: newName, legalStatus: 'good' as const } : c
    ));
  };

  // Added missing saveCLKey function to update and persist CourtListener API key state and localStorage.
  const saveCLKey = (key: string) => {
    setCourtListenerKey(key);
    localStorage.setItem(CL_KEY_STORAGE_KEY, key);
  };

  const archiveAnalysis = (finalCitations: Citation[]) => {
    const entry: ReportJournalEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      documentTitle: titleRef.current,
      stats: {
        total: finalCitations.length,
        valid: finalCitations.filter(c => c.status === 'valid' && (c.legalStatus === 'good' || c.legalStatus === 'unknown')).length,
        invalid: finalCitations.filter(c => c.status === 'hallucination' || c.legalStatus === 'overruled' || c.legalStatus === 'superseded').length,
        pending: 0
      },
      findings: finalCitations.map(c => ({
        text: c.originalText,
        status: c.status,
        caseName: c.caseName,
        legalStatus: c.legalStatus
      }))
    };
    setJournal(prev => [entry, ...prev].slice(0, 100)); // Keep last 100 for storage limits
  };

  const analyzeText = async (textToAnalyze: string = inputText) => {
    setIsAnalyzing(true);
    setNoCitationsFound(false);
    const extracted = extractCitations(textToAnalyze, customRegex);
    if (!extracted.length) {
      setCitations([]);
      setNoCitationsFound(true);
      setIsAnalyzing(false);
      return;
    }
    setCitations(extracted);

    const promises = extracted.map(async (cite) => {
      setCitations(p => p.map(c => c.id === cite.id ? { ...c, status: 'checking' } : c));
      try {
        const mode = isGoogleSearchEnabled ? verificationMode : 'standard';
        const result = await verifyCitationWithGemini(cite.originalText, mode);
        
        let clData = null;
        if (isCourtListenerEnabled && courtListenerKey && result.isValid) {
          clData = await lookupCitationOnCourtListener(cite.originalText, courtListenerKey);
        }

        const updatedCite: Citation = {
          ...cite,
          status: (result.reason.includes("Network Error") || result.reason.includes("API Key")) ? 'error' : (result.isValid ? 'valid' : 'hallucination'),
          caseName: clData?.caseName || result.caseName || undefined,
          reason: clData?.error ? `${result.reason} (Authority Error: ${clData.error})` : result.reason,
          legalStatus: result.legalStatus,
          confidence: result.confidence,
          supersedingCase: result.supersedingCase || undefined,
          sources: clData?.absolute_url ? [{ uri: clData.absolute_url, title: 'Authoritative Opinion (CL)' }, ...(result.sources || [])] : result.sources,
          isCourtListenerVerified: !!clData?.found
        };

        setCitations(p => p.map(c => c.id === cite.id ? updatedCite : c));
        return updatedCite;
      } catch (e) {
        const errorCite: Citation = { ...cite, status: 'error', reason: "System Error" };
        setCitations(p => p.map(c => c.id === cite.id ? errorCite : c));
        return errorCite;
      }
    });

    const results = await Promise.all(promises);
    setIsAnalyzing(false);
    archiveAnalysis(results);
  };

  const exportJournal = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(journal, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `citeops_case_study_data_${Date.now()}.json`);
    dlAnchorElem.click();
  };

  const clearSavedData = () => {
    localStorage.removeItem(TEXT_STORAGE_KEY);
    localStorage.removeItem(TITLE_STORAGE_KEY);
    localStorage.removeItem(CL_KEY_STORAGE_KEY);
    localStorage.removeItem(JOURNAL_STORAGE_KEY);
    setJournal([]);
    setCourtListenerKey(DEFAULT_CL_KEY);
    alert('Session data and Journal history cleared.');
  };

  const filteredCitations = useMemo(() => {
    let filtered = [...citations];
    if (activeTab === 'issues') filtered = filtered.filter(c => ['hallucination', 'error'].includes(c.status) || ['overruled', 'superseded'].includes(c.legalStatus || ''));
    else if (activeTab === 'valid') filtered = filtered.filter(c => c.status === 'valid' && c.legalStatus === 'good');
    return filtered.sort((a, b) => {
      if (sortBy === 'confidence') return (b.confidence || 0) - (a.confidence || 0);
      return a.startIndex - b.startIndex;
    });
  }, [citations, activeTab, sortBy]);

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
      <aside className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} bg-gray-900 text-white transition-all duration-300 hidden lg:flex flex-col z-20`}>
        <div className="p-4 flex items-center justify-between border-b border-gray-800">
          {!isSidebarCollapsed && <div className="flex items-center gap-2 font-black text-xl tracking-tighter text-blue-400"><ShieldCheck /> CITEOPS</div>}
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-1 hover:bg-gray-800 rounded">
            {isSidebarCollapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          <button className="w-full flex items-center gap-3 p-3 bg-blue-600 rounded-lg font-bold text-sm shadow-lg shadow-blue-900/20"><FileText size={18} /> {!isSidebarCollapsed && "Active Brief"}</button>
          <button onClick={() => setShowJournal(true)} className="w-full flex items-center gap-3 p-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg font-bold text-sm transition-colors">
            <BookOpen size={18} /> {!isSidebarCollapsed && "Case Study Journal"}
          </button>
          <button onClick={() => setShowSettings(true)} className="w-full flex items-center gap-3 p-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg font-bold text-sm transition-colors"><Settings size={18} /> {!isSidebarCollapsed && "Engine Config"}</button>
        </nav>
        <div className="p-4 border-t border-gray-800 text-[10px] text-gray-400 font-bold uppercase">
          {!isSidebarCollapsed && <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/> Logged in Pilot</div>}
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-10 shadow-sm">
          <div className="flex items-center gap-4 flex-1">
            <button className="lg:hidden p-2" onClick={() => setIsMobileSidebarOpen(true)}><Menu size={20} /></button>
            <input 
              value={documentTitle} 
              onChange={(e) => setDocumentTitle(e.target.value)}
              className="font-bold text-gray-800 border-none bg-transparent focus:ring-0 p-0 text-sm md:text-base w-full max-w-md"
            />
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => analyzeText()}
              disabled={isAnalyzing || !inputText.trim()}
              className="bg-gray-900 text-white px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-black disabled:opacity-50 transition-all shadow-md active:scale-95"
            >
              {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} className="fill-current" />}
              {isAnalyzing ? "Verifying..." : "Run Analysis"}
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <div className="flex-1 flex flex-col bg-white overflow-hidden border-r border-gray-100">
            <div className="flex-1 relative overflow-auto p-10 font-serif leading-relaxed text-lg bg-white selection:bg-blue-100">
              <textarea
                value={inputText}
                onChange={handleTextChange}
                className="absolute inset-0 w-full h-full p-10 bg-transparent border-none focus:ring-0 resize-none z-10 text-transparent caret-gray-900"
                spellCheck={false}
              />
              <div className="pointer-events-none">
                {highlightText(inputText, citations).map((s, i) => (
                  <span key={i} className={s.isCitation ? `bg-blue-100/40 border-b-2 ${citations.find(c => c.id === s.citationId)?.status === 'hallucination' ? 'border-red-500 bg-red-50' : 'border-blue-500'}` : ''}>
                    {s.text}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <aside className={`${isInspectionPanelOpen ? 'w-full md:w-80 lg:w-96' : 'w-0'} bg-gray-50 border-l border-gray-200 flex flex-col transition-all duration-300 overflow-hidden`}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
              <h2 className="font-bold text-sm flex items-center gap-2"><Search size={16} className="text-blue-500" /> Active Report</h2>
              <button onClick={() => setIsInspectionPanelOpen(false)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><X size={14} /></button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <StatsPanel stats={stats} />
              <div className="flex p-1 bg-gray-200/50 rounded-lg">
                {(['all', 'issues', 'valid'] as CitationFilter[]).map(t => (
                  <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${activeTab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{t}</button>
                ))}
              </div>
              <div className="space-y-3 pb-6">
                {filteredCitations.map(c => <CitationCard key={c.id} citation={c} onApplySuperseding={handleApplySuperseding} />)}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Case Study Journal Modal */}
      {showJournal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="text-xl font-black tracking-tight flex items-center gap-2 text-gray-800"><History className="text-blue-600" /> Case Study Journal</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Automatic analysis snapshots for grounding verification studies</p>
              </div>
              <button onClick={() => setShowJournal(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
              {journal.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <BookOpen size={32} strokeWidth={1.5} />
                  </div>
                  <p className="font-bold text-sm">No analysis history found</p>
                  <p className="text-xs">Run an analysis to auto-archive report data here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {journal.map((entry) => (
                    <div key={entry.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm hover:border-blue-200 transition-all group">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{new Date(entry.timestamp).toLocaleString()}</div>
                          <h4 className="font-bold text-gray-800">{entry.documentTitle}</h4>
                        </div>
                        <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black border border-blue-100">
                          {Math.round((entry.stats.valid / (entry.stats.total || 1)) * 100)}% SCORE
                        </div>
                      </div>
                      <div className="flex gap-4 border-t border-gray-50 pt-3 text-[11px]">
                         <span className="flex items-center gap-1 text-gray-500 font-bold"><Zap size={12} className="text-yellow-500"/> {entry.stats.total} Checked</span>
                         <span className="flex items-center gap-1 text-green-600 font-bold"><Check size={12}/> {entry.stats.valid} Valid</span>
                         <span className="flex items-center gap-1 text-red-600 font-bold"><AlertCircle size={12}/> {entry.stats.invalid} Issues</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 bg-white border-t border-gray-100 flex justify-between items-center">
              <div className="text-[10px] font-bold text-gray-400 uppercase">
                {journal.length} snapshot entries preserved
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={exportJournal} 
                  disabled={journal.length === 0}
                  className="flex items-center gap-2 bg-gray-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-black transition-all disabled:opacity-30"
                >
                  <Share size={16} /> Export study data (JSON)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Engine Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-white/20">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-lg font-black tracking-tight flex items-center gap-2"><Settings className="text-blue-600" /> Deployment Config</h3>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-3">Grounding Credentials</label>
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-700"><Key size={14} className="text-blue-500" /> CourtListener API Token</div>
                  <input type="password" value={courtListenerKey} onChange={(e) => saveCLKey(e.target.value)} className="w-full bg-white border-gray-200 rounded-xl text-xs py-2 px-3 focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-3">Maintenance</label>
                <button onClick={clearSavedData} className="w-full flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 text-xs font-bold py-3 border border-red-200 rounded-2xl transition-all"><Trash2 size={16} /> Reset All Session & Journal Data</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
