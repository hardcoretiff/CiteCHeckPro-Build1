import React from 'react';
import { Citation } from '../types';
import { 
  CheckCircle, XCircle, Loader2, AlertCircle, 
  ExternalLink, Globe, AlertTriangle, ShieldAlert,
  ArrowRight, Info, Scale, Briefcase
} from 'lucide-react';

interface CitationCardProps {
  citation: Citation;
  onApplySuperseding?: (id: string, newCitation: string, newCaseName: string) => void;
}

const CitationCard: React.FC<CitationCardProps> = ({ citation, onApplySuperseding }) => {
  const isObsolete = citation.legalStatus === 'overruled' || citation.legalStatus === 'superseded' || citation.legalStatus === 'retracted';
  const isError = citation.status === 'error';
  
  const getStatusStyles = () => {
    if (citation.status === 'checking') return 'border-blue-200 bg-blue-50/30';
    if (citation.status === 'hallucination') return 'border-red-200 bg-red-50/20';
    if (isError) return 'border-amber-300 bg-amber-50/30';
    
    switch (citation.legalStatus) {
      case 'overruled': 
      case 'retracted': return 'border-red-500 bg-red-50 ring-2 ring-red-100';
      case 'superseded': return 'border-orange-500 border-dashed bg-gradient-to-br from-orange-50 to-white shadow-sm ring-1 ring-orange-200/30';
      case 'good':
      case 'verified': return 'border-green-200 bg-white shadow-sm hover:shadow-md';
      default: return 'border-gray-200 bg-white';
    }
  };

  const getStatusBadge = () => {
    if (citation.status === 'hallucination') return (
      <span className="flex items-center text-[8px] font-black uppercase bg-red-100 text-red-600 px-1.5 py-0.5 rounded tracking-tighter">
        Factual Discrepancy
      </span>
    );
    if (isError) return (
      <span className="flex items-center text-[8px] font-black uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded tracking-tighter">
        Engine Failed
      </span>
    );
    switch (citation.legalStatus) {
      case 'good': 
      case 'verified': return (
        <span className="flex items-center text-[8px] font-black uppercase bg-green-100 text-green-700 px-1.5 py-0.5 rounded tracking-tighter">
          <CheckCircle className="w-2 h-2 mr-1" /> Good Precedent
        </span>
      );
      default: return null;
    }
  };

  const handleViewDetails = () => {
    if (citation.supersedingCase?.uri) {
      window.open(citation.supersedingCase.uri, '_blank');
    } else {
      alert("Further details for this authority are not currently available via the API.");
    }
  };

  // Only show superseding UI if there's a correction available AND the current citation is problematic
  const showSuperseding = !!citation.supersedingCase && (isObsolete || citation.status === 'hallucination');

  return (
    <div className={`p-4 rounded-lg border transition-all duration-300 group ${getStatusStyles()}`}>
      <div className="flex justify-between items-start gap-2 mb-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center space-x-2">
            {citation.status === 'checking' ? (
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            ) : (citation.status === 'hallucination' || isError) ? (
              <XCircle className={`w-4 h-4 ${isError ? 'text-amber-500' : 'text-red-600'}`} />
            ) : isObsolete ? (
              <AlertTriangle className="w-4 h-4 text-red-600" />
            ) : (
              <CheckCircle className="w-4 h-4 text-green-600" />
            )}
            <span className="font-mono text-[11px] font-bold text-gray-900 truncate max-w-[140px]">
              {citation.originalText}
            </span>
          </div>
          <div className="flex flex-wrap gap-1 mt-0.5">
            <div className="flex items-center text-[7px] font-black text-gray-500 uppercase tracking-tighter bg-gray-100 px-1 py-0.5 rounded border border-gray-200 w-fit">
              <Scale className="w-2 h-2 mr-0.5" />
              LEGAL REFERENCE
            </div>
            {citation.areaOfLaw && (
              <div className="flex items-center text-[7px] font-black text-indigo-600 uppercase tracking-tighter bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100 w-fit">
                <Briefcase className="w-2 h-2 mr-0.5" />
                {citation.areaOfLaw}
              </div>
            )}
          </div>
        </div>
        {getStatusBadge()}
      </div>
      
      {citation.status !== 'checking' && (
        <div className="space-y-3">
          <div className="text-xs font-serif font-bold text-gray-800 leading-tight">
            {citation.caseName || (isError ? "Verification Interrupted" : "Unidentified Source")}
          </div>

          {citation.reason && (
            <div className={`text-[10px] leading-relaxed p-2 rounded border ${isError ? 'bg-amber-100/30 border-amber-200 text-amber-900' : isObsolete ? 'bg-red-100/30 border-red-200 text-red-900' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
              <div className="flex items-start">
                <Info className="w-3 h-3 mr-1.5 mt-0.5 flex-shrink-0 opacity-50" />
                <span>{citation.reason}</span>
              </div>
            </div>
          )}

          {showSuperseding && (
            <div className="p-3 bg-red-600 text-white rounded-xl shadow-lg space-y-3 mt-4">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
                <ShieldAlert size={12} className="text-white animate-pulse" />
                Critical Update Available
              </div>
              
              <div className="space-y-1">
                <div className="text-[10px] font-bold leading-tight line-clamp-2">
                  {citation.supersedingCase!.name}
                </div>
                <div className="font-mono text-[9px] opacity-80">
                  {citation.supersedingCase!.citation}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <button 
                  onClick={handleViewDetails}
                  className="w-full bg-red-700/50 text-white border border-red-400/30 px-3 py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 hover:bg-red-700/80 transition-colors"
                >
                  <ExternalLink size={14} /> View superseding case details
                </button>

                <button 
                  onClick={() => onApplySuperseding?.(citation.id, citation.supersedingCase!.citation, citation.supersedingCase!.name)}
                  className="w-full bg-white text-red-700 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-tight flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors shadow-sm"
                >
                  <ArrowRight size={14} /> Apply Correct Citation
                </button>
              </div>
            </div>
          )}

          {citation.sources && citation.sources.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                <Globe className="w-2.5 h-2.5 mr-1 text-blue-400" /> Grounded Evidence
              </div>
              <div className="flex flex-wrap gap-1">
                {citation.sources.map((source, i) => (
                  <a 
                    key={i} 
                    href={source.uri} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center px-1.5 py-1 bg-white text-gray-500 border border-gray-100 rounded text-[8px] hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all truncate max-w-[140px]"
                  >
                    <span className="truncate">{source.title}</span>
                    <ExternalLink className="w-2.5 h-2.5 ml-1 opacity-50" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CitationCard;