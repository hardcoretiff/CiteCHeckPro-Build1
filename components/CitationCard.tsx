import React from 'react';
import { Citation } from '../types';
import { 
  ExternalLink, Wand2, Sparkles, CheckCircle, Gavel
} from 'lucide-react';

interface CitationCardProps {
  citation: Citation;
  onApplySuperseding?: (id: string, newCitation: string, newCaseName: string) => void;
  onAcceptCorrection?: (id: string) => void;
  fullText?: string;
}

const CitationCard: React.FC<CitationCardProps> = ({ citation, onApplySuperseding, onAcceptCorrection, fullText }) => {
  const isObsolete = citation.legalStatus === 'overruled' || citation.legalStatus === 'superseded' || citation.legalStatus === 'retracted';
  const isError = citation.status === 'error';
  
  const getStatusConfig = () => {
    if (citation.status === 'checking') return { icon: 'sync', color: 'text-blue-500', bg: 'bg-blue-50', label: 'Checking...' };
    if (citation.status === 'hallucination') return { icon: 'error', color: 'text-red-500', bg: 'bg-red-50', label: 'HALLUCINATION' };
    if (isError) return { icon: 'warning', color: 'text-amber-500', bg: 'bg-amber-50', label: 'ERROR' };
    
    switch (citation.legalStatus) {
      case 'overruled': 
      case 'retracted': return { icon: 'dangerous', color: 'text-red-600', bg: 'bg-red-50', label: 'OVERRULED' };
      case 'superseded': return { icon: 'update', color: 'text-orange-500', bg: 'bg-orange-50', label: 'SUPERSEDED' };
      case 'good':
      case 'verified': return { icon: 'check_circle', color: 'text-green-500', bg: 'bg-green-50', label: 'VALID LAW' };
      default: return { icon: 'help', color: 'text-gray-400', bg: 'bg-gray-50', label: 'PENDING' };
    }
  };

  const config = getStatusConfig();
  const showSuperseding = !!citation.supersedingCase && (isObsolete || citation.status === 'hallucination');

  const AreaOfLawBadge = () => (
    citation.areaOfLaw ? (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f39200]/10 text-[#f39200] rounded-lg text-[10px] font-black uppercase tracking-widest border border-[#f39200]/20 shadow-sm animate-in fade-in zoom-in duration-300">
        <Gavel size={14} className="opacity-70" />
        {citation.areaOfLaw}
      </div>
    ) : null
  );

  if (showSuperseding) {
    return (
      <div className="bg-white rounded-3xl border border-[#e6edf4] overflow-hidden shadow-sm mb-4 animate-in fade-in slide-in-from-top-2">
        <div className="p-5 border-b border-[#e6edf4] bg-[#f6f8fb] flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-widest text-[#0b3a6f]">Precedent Replacement</span>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-600 rounded-full text-[9px] font-bold uppercase">
             <span className="material-symbols-outlined text-[14px]">dangerous</span> Overruled
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-red-50/50 rounded-2xl p-4 border border-red-100 text-center">
              <span className="text-[9px] font-black text-red-500 uppercase tracking-widest block mb-1">Outdated</span>
              <div className="text-red-700 font-bold text-xs line-through break-all">{citation.originalText}</div>
            </div>
            <div className="bg-green-50/50 rounded-2xl p-4 border border-green-100 text-center">
              <span className="text-[9px] font-black text-green-500 uppercase tracking-widest block mb-1">Updated</span>
              <div className="text-green-700 font-bold text-xs break-all">{citation.supersedingCase!.citation}</div>
            </div>
          </div>

          <AreaOfLawBadge />

          <div className="bg-orange-50/50 rounded-2xl p-5 border border-orange-100">
             <div className="flex gap-4">
                <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-orange-500/10">
                   <Wand2 size={20} />
                </div>
                <div>
                   <h4 className="text-[#0b3a6f] font-bold text-sm">LexiCite Suggestion</h4>
                   <p className="text-[11px] text-gray-500 leading-relaxed mt-1">This law was modified by <strong>{citation.supersedingCase!.name}</strong>. Apply the fix to your draft?</p>
                </div>
             </div>
             
             <div className="flex flex-col gap-2.5 mt-5">
               <button 
                 onClick={() => onApplySuperseding?.(citation.id, citation.supersedingCase!.citation, citation.supersedingCase!.name)}
                 className="w-full bg-[#0b3a6f] text-white h-12 rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-[#092a52] transition-all flex items-center justify-center gap-2 shadow-md shadow-[#0b3a6f]/10"
               >
                 <Sparkles size={14} /> Insert Current Precedent
               </button>
               
               <button 
                 onClick={() => {
                   if (citation.supersedingCase?.uri) {
                     window.open(citation.supersedingCase.uri, '_blank');
                   } else {
                     alert("Reference URI missing for this superseding authority.");
                   }
                 }}
                 className="w-full bg-[#f0f4f8] text-[#0b3a6f] border border-[#d1dae5] h-12 rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-[#e2e8f0] transition-all flex items-center justify-center gap-2 shadow-sm"
               >
                 <ExternalLink size={14} /> View superseding case details
               </button>

               <button 
                 onClick={() => onAcceptCorrection?.(citation.id)}
                 className="w-full bg-white text-[#22c55e] border border-[#22c55e]/30 h-12 rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-green-50 transition-all flex items-center justify-center gap-2 shadow-sm"
               >
                 <CheckCircle size={14} /> Apply Correct Citation
               </button>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-3xl border border-[#e6edf4] bg-white hover:border-[#0b3a6f]/20 transition-all cursor-default flex flex-col gap-4 shadow-sm`}>
      <div className="flex items-start gap-4">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${config.color} ${config.bg} shrink-0 shadow-sm`}>
          <span className="material-symbols-outlined text-[24px]">{config.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
             <span className="font-mono text-[11px] font-bold text-[#1f2937] truncate max-w-[120px]">{citation.originalText}</span>
             <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${config.color} whitespace-nowrap ml-2`}>{config.label}</span>
          </div>
          <div className="text-[14px] font-extrabold text-[#0b3a6f] leading-snug line-clamp-2">
            {citation.caseName || (citation.status === 'checking' ? 'Analyzing Precedent...' : 'Case Title Unidentified')}
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <AreaOfLawBadge />
        
        {citation.reason && (
          <div className="w-full text-[11px] text-gray-500 font-medium leading-relaxed bg-[#f6f8fb] p-3 rounded-2xl border border-[#e6edf4]/60">
            {citation.reason}
          </div>
        )}
      </div>
    </div>
  );
};

export default CitationCard;