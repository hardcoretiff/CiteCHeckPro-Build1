import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShieldCheck, FileText, Settings, Loader2, X, 
  PanelRightClose, PanelRightOpen, Globe, Scale, AlertCircle, 
  History, BookOpen, Search, Key, Download,
  ChevronUp, ChevronDown, Play, CheckCircle2, AlertTriangle, Clock, User, LogOut, ChevronRight, Menu
} from 'lucide-react';
import { Citation, AnalysisStats, CitationFilter, ReportJournalEntry } from './types';
import { extractCitations, highlightText } from './services/citationService';
import { verifyCitationWithGemini } from './services/geminiService';
import { lookupCitationOnCourtListener } from './services/courtListenerService';
import CitationCard from './components/CitationCard';
import StatsPanel from './components/StatsPanel';

const TEXT_STORAGE_KEY = 'lexicite_saved_text';
const TITLE_STORAGE_KEY = 'lexicite_saved_title';
const CL_KEY_STORAGE_KEY = 'lexicite_cl_api_key';
const JOURNAL_STORAGE_KEY = 'lexicite_journal_history';
const AUTO_SAVE_INTERVAL = 10000;

const DEFAULT_CL_KEY = "3149ff4a1dfd96b754c754c75d1afc4366e2177c1f2f";

const DEFAULT_TEXT = `The legal framework regarding abortion has shifted significantly. 
Previously, the primary authority was Roe v. Wade, 410 U.S. 113 (1973). 
Modern briefs must account for Dobbs v. Jackson Women's Health Organization, 597 U.S. 215 (2022).

For criminal procedure, see Miranda v. Arizona, 384 U.S. 436 (1966).`;

const App: React.FC = () => {
  const [inputText, setInputText] = useState<string>(() => localStorage.getItem(TEXT_STORAGE_KEY) || DEFAULT_TEXT);
  const [documentTitle, setDocumentTitle] = useState(() => localStorage.getItem(TITLE_STORAGE_KEY) || "Analysis: LexiCite 360 Document");
  const [courtListenerKey, setCourtListenerKey] = useState(() => localStorage.getItem(CL_KEY_STORAGE_KEY) || DEFAULT_CL_KEY);
  const [journal, setJournal] = useState<ReportJournalEntry[]>(() => {
    const saved = localStorage.getItem(JOURNAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [citations, setCitations] = useState<Citation[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<CitationFilter>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(window.innerWidth < 1024);
  const [isInspectionPanelOpen, setIsInspectionPanelOpen] = useState(window.innerWidth >= 1280);

  const textRef = useRef(inputText);
  const titleRef = useRef(documentTitle);

  useEffect(() => {
    textRef.current = inputText;
    const extracted = extractCitations(inputText);
    setCitations(prev => {
      return extracted.map(newCite => {
        const existing = prev.find(p => p.originalText === newCite.originalText && p.startIndex === newCite.startIndex);
        return existing || newCite;
      });
    });
  }, [inputText]);

  useEffect(() => {
    const interval = setInterval(() => {
      localStorage.setItem(TEXT_STORAGE_KEY, textRef.current);
      localStorage.setItem(TITLE_STORAGE_KEY, titleRef.current);
      localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(journal));
    }, AUTO_SAVE_INTERVAL);
    return () => clearInterval(interval);
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

  const downloadJournal = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(journal, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", `lexicite_master_log_${new Date().toISOString().split('T')[0]}.json`);
    dl.click();
  };

  const archiveAnalysis = async (finalCitations: Citation[]) => {
    const entry: ReportJournalEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      documentTitle: titleRef.current,
      stats: {
        total: finalCitations.length,
        valid: finalCitations.filter(c => c.status === 'valid' && (c.legalStatus === 'good' || c.legalStatus === 'verified' || c.legalStatus === 'unknown')).length,
        invalid: finalCitations.filter(c => c.status === 'hallucination' || c.legalStatus === 'overruled' || c.legalStatus === 'superseded' || c.legalStatus === 'retracted').length,
        pending: 0
      },
      findings: finalCitations.map(c => ({
        text: c.originalText,
        status: c.status,
        citationType: c.citationType,
        caseName: c.caseName,
        legalStatus: c.legalStatus,
        areaOfLaw: c.areaOfLaw
      }))
    };
    setJournal(prev => [entry, ...prev].slice(0, 50));
  };

  const handleApplySuperseding = (id: string, newCitation: string, newCaseName: string) => {
    const cite = citations.find(c => c.id === id);
    if (!cite) return;
    const before = inputText.substring(0, cite.startIndex);
    const after = inputText.substring(cite.endIndex);
    const updatedText = before + newCitation + after;
    setInputText(updatedText);
    setCitations(prev => prev.map(c => c.id === id ? { ...c, status: 'valid', caseName: newCaseName, legalStatus: 'good' } : c));
  };

  const runVerification = async () => {
    if (citations.length === 0) return;
    setIsAnalyzing(true);
    setIsInspectionPanelOpen(true);
    const promises = citations.map(async (cite) => {
      if (cite.status !== 'pending') return cite;
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
          citationType: result.citationType,
          caseName: clData?.caseName || result.caseName || undefined,
          areaOfLaw: result.areaOfLaw,
          reason: clData?.error ? `${result.reason} (${clData.error})` : result.reason,
          legalStatus: result.legalStatus,
          confidence: result.confidence,
          supersedingCase: result.supersedingCase || undefined,
          sources: clData?.absolute_url ? [{ uri: clData.absolute_url, title: 'Auth Opinion' }, ...(result.sources || [])] : result.sources,
          isCourtListenerVerified: !!clData?.found
        };
        setCitations(p => p.map(c => c.id === cite.id ? updatedCite : c));
        return updatedCite;
      } catch (e) {
        const errorCite: Citation = { ...cite, status: 'error', reason: "Verification Failed" };
        setCitations(p => p.map(c => c.id === cite.id ? errorCite : c));
        return errorCite;
      }
    });
    const results = await Promise.all(promises);
    setIsAnalyzing(false);
    archiveAnalysis(results);
  };

  const filteredCitations = useMemo(() => {
    let filtered = [...citations];
    if (activeTab === 'issues') filtered = filtered.filter(c => ['hallucination', 'error'].includes(c.status) || ['overruled', 'superseded', 'retracted'].includes(c.legalStatus || ''));
    else if (activeTab === 'valid') filtered = filtered.filter(c => c.status === 'valid' && (c.legalStatus === 'good' || c.legalStatus === 'verified'));
    return filtered.sort((a, b) => a.startIndex - b.startIndex);
  }, [citations, activeTab]);

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
      {/* Sidebar - Mobile Responsive Overlay Logic */}
      <div 
        className={`fixed inset-0 bg-gray-900/40 z-50 lg:hidden transition-opacity duration-300 ${isSidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        onClick={() => setIsSidebarCollapsed(true)}
      />
      <aside className={`
        fixed lg:relative z-50 lg:z-20 h-full
        ${isSidebarCollapsed ? '-translate-x-full lg:translate-x-0 lg:w-16' : 'translate-x-0 w-64'} 
        bg-gray-900 text-white transition-all duration-300 flex flex-col overflow-hidden
      `}>
        <div className="p-4 flex items-center justify-between border-b border-gray-800 min-w-[256px] lg:min-w-0">
          {!isSidebarCollapsed && <div className="flex items-center gap-2 font-black text-lg tracking-tighter text-blue-400"><ShieldCheck /> LEXICITE 360</div>}
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-1 hover:bg-gray-800 rounded">
            {isSidebarCollapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
          </button>
        </div>
        
        <nav className="flex-1 p-2 space-y-1">
          <button onClick={() => setIsSidebarCollapsed(window.innerWidth < 1024)} className="w-full flex items-center gap-3 p-3 bg-blue-600 rounded-lg font-bold text-sm"><FileText size={18} /> {!isSidebarCollapsed && "Active Editor"}</button>
          <button onClick={() => { setShowJournal(true); setIsSidebarCollapsed(window.innerWidth < 1024); }} className="w-full flex items-center gap-3 p-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg font-bold text-sm transition-colors"><BookOpen size={18} /> {!isSidebarCollapsed && "Case History"}</button>
          <button onClick={() => { setShowSettings(true); setIsSidebarCollapsed(window.innerWidth < 1024); }} className="w-full flex items-center gap-3 p-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg font-bold text-sm transition-colors"><Settings size={18} /> {!isSidebarCollapsed && "Engine Config"}</button>
        </nav>

        {/* ACCOUNT INFO PANEL */}
        <div className="mt-auto p-3 border-t border-gray-800">
          <div className={`flex items-center gap-3 p-2 rounded-xl transition-colors hover:bg-gray-800 cursor-pointer group`}>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white shrink-0 relative shadow-inner">
              SJ
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-gray-900 rounded-full" />
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-black text-white truncate flex items-center gap-1">
                  Sarah Jenkins
                  <div className="px-1 bg-blue-500/20 text-blue-400 text-[8px] rounded uppercase tracking-tighter">Pro</div>
                </div>
                <div className="text-[10px] text-gray-400 truncate font-medium">Jenkins & Assoc. LLP</div>
              </div>
            )}
            {!isSidebarCollapsed && <ChevronRight size={14} className="text-gray-600 group-hover:text-white" />}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 z-10 shadow-sm gap-2 shrink-0">
          <div className="flex items-center gap-2 lg:hidden">
            <button 
              onClick={() => setIsSidebarCollapsed(false)}
              className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              <Menu size={20} />
            </button>
          </div>
          
          <div className="flex-1 min-w-0 text-left ml-2 lg:ml-0">
            <input 
              value={documentTitle} 
              onChange={(e) => setDocumentTitle(e.target.value)}
              className="font-bold text-gray-800 border-none bg-transparent focus:ring-0 p-0 text-sm md:text-base w-full truncate"
            />
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSettings(true)}
              className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              title="Engine Config"
            >
              <Settings size={20} />
            </button>
            <button 
              onClick={runVerification}
              disabled={isAnalyzing || citations.length === 0}
              className={`px-3 py-2 md:px-4 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 transition-all bg-blue-600 text-white shadow-lg hover:bg-blue-700 disabled:opacity-50`}
            >
              {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Scale size={16} />}
              <span className="max-sm:hidden">{isAnalyzing ? "Verifying..." : "Verify All"}</span>
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          <div className="flex-1 flex flex-col bg-white overflow-hidden relative border-r border-gray-100 min-h-[40vh]">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="absolute inset-0 w-full h-full p-6 md:p-10 bg-transparent border-none focus:ring-0 resize-none z-10 text-transparent caret-gray-900 font-serif text-base md:text-lg leading-relaxed"
              spellCheck={false}
              placeholder="Paste your legal document here..."
            />
            <div className="p-6 md:p-10 font-serif leading-relaxed text-base md:text-lg bg-white pointer-events-none break-words">
              {highlightText(inputText, citations).map((s, i) => {
                const cite = citations.find(c => c.id === s.citationId);
                const isPending = cite?.status === 'pending';
                const isInvalid = cite?.status === 'hallucination' || cite?.status === 'error' || ['overruled', 'superseded', 'retracted'].includes(cite?.legalStatus || '');
                return (
                  <span key={i} className={s.isCitation ? `border-b-2 transition-all ${isPending ? 'bg-blue-50 border-blue-400 animate-pulse' : isInvalid ? 'bg-red-50 border-red-500' : 'bg-green-50/30 border-green-500'}` : ''}>
                    {s.text}
                  </span>
                );
              })}
            </div>
            
            <button 
              onClick={() => setIsInspectionPanelOpen(!isInspectionPanelOpen)}
              className="lg:hidden absolute bottom-12 right-4 z-30 bg-gray-900 text-white p-3 rounded-full shadow-xl"
            >
              {isInspectionPanelOpen ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </button>

            <div 
              onClick={() => setIsInspectionPanelOpen(true)}
              className="h-9 bg-gray-50/80 backdrop-blur-md border-t border-gray-200 flex items-center justify-between px-4 z-40 shrink-0 cursor-pointer hover:bg-white transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                   <Scale size={14} className="text-blue-500" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Legal Audit</span>
                </div>
                <div className="h-3 w-px bg-gray-200" />
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-green-500" />
                    <span className="text-[10px] font-bold text-gray-700">{stats.valid}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertTriangle size={12} className="text-red-500" />
                    <span className="text-[10px] font-bold text-gray-700">{stats.invalid}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={12} className="text-blue-400" />
                    <span className="text-[10px] font-bold text-gray-700">{stats.pending}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isAnalyzing ? (
                  <div className="flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin text-blue-600" />
                    <span className="text-[9px] font-black text-blue-600 uppercase">Analyzing Precedent</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                    <span className="text-[9px] font-black text-gray-400 uppercase">System Ready</span>
                  </div>
                )}
                {!isInspectionPanelOpen && <ChevronUp size={14} className="text-gray-400 ml-2" />}
              </div>
            </div>
          </div>

          <aside className={`${isInspectionPanelOpen ? 'h-[60vh] lg:h-full w-full lg:w-80 xl:w-96' : 'h-0 lg:w-0'} bg-gray-50 border-t lg:border-t-0 lg:border-l border-gray-200 flex flex-col transition-all duration-300 overflow-hidden shrink-0`}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
              <h2 className="font-bold text-xs flex items-center gap-2 text-blue-600 uppercase tracking-widest">Precedent Inspect</h2>
              <button onClick={() => setIsInspectionPanelOpen(false)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1 scrollbar-hide">
              {stats.total > 0 && <StatsPanel stats={stats} />}
              
              <div className="space-y-3 pb-20">
                {citations.length > 0 ? (
                  <>
                    <div className="flex p-1 bg-gray-200/50 rounded-lg shrink-0">
                      {(['all', 'issues', 'valid'] as CitationFilter[]).map(t => (
                        <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${activeTab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{t}</button>
                      ))}
                    </div>
                    {filteredCitations.map(c => (
                      <CitationCard 
                        key={c.id} 
                        citation={c} 
                        onApplySuperseding={handleApplySuperseding}
                      />
                    ))}
                  </>
                ) : (
                  <div className="text-center py-10 px-6">
                    <div className="bg-white p-6 rounded-2xl border border-dashed border-gray-300">
                      <Search className="mx-auto mb-3 text-blue-200" size={40} />
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">No Authorities Detected</p>
                      <div className="text-left space-y-3">
                         <p className="text-[10px] text-gray-500 font-bold uppercase">Supported Formats:</p>
                         <ul className="text-[11px] text-gray-600 space-y-2">
                           <li className="flex gap-2"><span>⚖️</span> <span>410 U.S. 113</span></li>
                           <li className="flex gap-2"><span>⚖️</span> <span>123 F.3d 456</span></li>
                           <li className="flex gap-2"><span>⚖️</span> <span>28 U.S.C. § 1291</span></li>
                         </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {showJournal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-black tracking-tight flex items-center gap-2"><History className="text-blue-600" /> Case History</h3>
              <button onClick={() => setShowJournal(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {journal.map((entry) => (
                <div key={entry.id} className="bg-white p-4 rounded-xl border border-gray-200">
                  <h4 className="font-bold text-sm">{entry.documentTitle}</h4>
                  <div className="flex gap-3 text-[10px] mt-1 font-bold uppercase text-gray-400">
                    <span>{new Date(entry.timestamp).toLocaleDateString()}</span>
                    <span className="text-green-600">{entry.stats.valid} Verified</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-gray-50 border-t flex justify-between gap-2">
               <button onClick={downloadJournal} className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2"><Download size={14}/> Export Log</button>
               <button onClick={() => setShowJournal(false)} className="bg-gray-900 text-white px-6 py-2 rounded-xl text-xs font-bold">Close</button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-black tracking-tight">Engine Configuration</h3>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-700"><Key size={14} className="text-blue-500" /> CourtListener API Token</div>
                <input 
                  type="password" 
                  value={courtListenerKey} 
                  onChange={(e) => {setCourtListenerKey(e.target.value); localStorage.setItem(CL_KEY_STORAGE_KEY, e.target.value);}} 
                  className="w-full bg-white border-gray-200 rounded-xl text-xs py-2 px-3 focus:ring-2 focus:ring-blue-500/20" 
                />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end">
              <button onClick={() => setShowSettings(false)} className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold text-sm">Save Configuration</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;