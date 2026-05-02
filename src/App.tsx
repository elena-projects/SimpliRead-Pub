/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { FileText, Camera, FileUp, FileSearch, Loader2, Settings, X, Wind } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import './index.css';

type InputMethod = 'text' | 'image' | 'file';
type AppMode = 'input' | 'presurvey' | 'reading' | 'postsurvey' | 'report' | 'vault';

interface Chunk {
  heading: string;
  text: string;
  htmlContent: string;
  note: string;
  keyTerms: string[];
}

const COLORS = [
  { id: 'yellow', hex: 'rgba(255, 235, 153, 0.6)', label: 'Core Concept' },
  { id: 'green', hex: 'rgba(200, 230, 201, 0.6)', label: 'Understood' },
  { id: 'pink', hex: 'rgba(248, 187, 208, 0.6)', label: 'Exam Focus' },
  { id: 'blue', hex: 'rgba(187, 222, 251, 0.6)', label: 'Needs Review' },
];

const d = {
  welcome: 'Read Less. Understand More',
  welcomeBack: 'Welcome back',
  subtitle: 'SimpliRead uses AI to break down dense, intimidating text into digestible semantic chunks. Reduce cognitive load and master complex information faster.',
  textMethod: 'Smart Text',
  imageMethod: 'Analyze Image',
  fileMethod: 'Document Analysis',
  placeholderText: 'Paste your most intimidating, complex article or notes here. Watch SimpliRead simplify it...',
  startBtn: 'Transform My Reading',
  surveyDesc1: 'Rate your current overwhelm level (1-5)',
  surveyDesc2: 'Rate your current clarity (1-5)',
  calm: 'Calm',
  overwhelmed: 'Overwhelmed',
  foggy: 'Foggy',
  clear: 'Crystal Clear',
  btnReading: 'Start Reading',
  btnReport: 'View My Report',
  hintEdit: 'Double-click text to edit and rephrase.',
  btnNext: 'I understand this chunk. Next.',
  titleReport: 'Learning Session Summary',
  ts: 'Time Spent',
  ch: 'Chunks Completed',
  score: 'Overwhelm Reduction Score',
  refl: 'Your Reflections',
  hl: 'Your Highlights',
  newSession: 'Start New Session'
};

export default function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('SIMPLIREAD_GEMINI_API_KEY') || '');
  const [nickname, setNickname] = useState(localStorage.getItem('SIMPLIREAD_NICKNAME') || '');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [vaultHistory, setVaultHistory] = useState<any[]>(JSON.parse(localStorage.getItem('SIMPLIREAD_HISTORY') || '[]'));

  const [inputMethod, setInputMethod] = useState<InputMethod>('text');
  const [inputText, setInputText] = useState('');
  
  // App State Navigation
  const [appMode, setAppMode] = useState<AppMode>('input');
  
  // Specific Data States
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Analyzing content...');
  
  // Survey & Feature States
  const [preOverwhelm, setPreOverwhelm] = useState(3);
  const [postClarity, setPostClarity] = useState(3);
  const [isBionicMode, setIsBionicMode] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const [sessionTime, setSessionTime] = useState(0);

  // Active editing state
  const [isEditingChunk, setIsEditingChunk] = useState(false);
  const [currentChunkText, setCurrentChunkText] = useState('');
  
  const [fadeKey, setFadeKey] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAnalyzing) {
      const messages = [
        "Reading the entire document...",
        "Extracting key concepts...",
        "Creating bite-sized chunks...",
        "Formatting for optimal learning..."
      ];
      let i = 0;
      setLoadingMessage(messages[0]);
      interval = setInterval(() => {
        i = (i + 1) % messages.length;
        setLoadingMessage(messages[i]);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  useEffect(() => {
    if (chunks[currentIndex]) {
      setCurrentChunkText(chunks[currentIndex].text);
    }
  }, [currentIndex, chunks]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (appMode === 'reading') {
      interval = setInterval(() => setSessionTime(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [appMode]);

  // Behavioral Frustration Detection
  useEffect(() => {
    const clicks: number[] = [];
    const handleGlobalClick = () => {
      const now = Date.now();
      clicks.push(now);
      while (clicks.length > 0 && now - clicks[0] > 3000) {
        clicks.shift();
      }
      if (clicks.length > 4) {
        setShowToast(true);
        clicks.length = 0; // reset
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleApplyColor = (color: typeof COLORS[0]) => {
     const selection = window.getSelection();
     if (!selection || selection.isCollapsed) return;
     const range = selection.getRangeAt(0);
     
     const container = document.getElementById('chunk-html-container');
     if (!container || !container.contains(range.commonAncestorContainer)) return;

     const mark = document.createElement('mark');
     mark.style.backgroundColor = color.hex;
     mark.dataset.category = color.id;
     mark.className = 'user-highlight';
     
     try {
       range.surroundContents(mark);
       const updatedHtml = container.innerHTML;
       const updatedChunks = [...chunks];
       updatedChunks[currentIndex].htmlContent = updatedHtml;
       setChunks(updatedChunks);
       selection.removeAllRanges();
     } catch (e) {
       alert('Please select text within a single continuous block.');
     }
  };

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('SIMPLIREAD_GEMINI_API_KEY', key);
  };

  const handleSaveNickname = (name: string) => {
    setNickname(name);
    localStorage.setItem('SIMPLIREAD_NICKNAME', name);
  };

  const applyBionicReading = (html: string) => {
    if (!isBionicMode) return html;
    
    const div = document.createElement('div');
    div.innerHTML = html;
    
    const walk = (node: Node) => {
      if (node.nodeType === 3) {
        const text = node.nodeValue;
        if (!text || !text.trim()) return;
        
        const words = text.split(/(\s+)/);
        const span = document.createElement('span');
        
        words.forEach(word => {
          if (!word.trim() || word.length <= 1) {
            span.appendChild(document.createTextNode(word));
            return;
          }
          const mid = Math.ceil(word.length / 2);
          const b = document.createElement('b');
          b.style.fontWeight = 'bold';
          b.textContent = word.substring(0, mid);
          
          span.appendChild(b);
          span.appendChild(document.createTextNode(word.substring(mid)));
        });
        node.parentNode?.replaceChild(span, node);
      } else if (node.nodeType === 1) {
        const elem = node as HTMLElement;
        if (elem.nodeName !== 'B' && elem.nodeName !== 'STRONG') {
          Array.from(node.childNodes).forEach(walk);
        }
      }
    };
    
    Array.from(div.childNodes).forEach(walk);
    return div.innerHTML;
  };

  const escapeHtml = (unsafe: string) => {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  };

  const highlightText = (text: string, terms: string[]) => {
    if (!text) return '';
    let highlighted = escapeHtml(text);
    terms.forEach(keyword => {
      if (!keyword) return;
      // escape regex characters in keyword
      const safeKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b(${safeKeyword})\\b`, 'gi');
      highlighted = highlighted.replace(regex, '<mark class="mark-highlight">$&</mark>');
    });
    return highlighted;
  };

  const fileToBase64 = (file: File): Promise<{ base64: string, mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve({ base64, mimeType: file.type });
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const callGeminiAPI = async (text: string, base64Image?: string, mimeType?: string) => {
    setIsAnalyzing(true);
    setLoadingMessage(base64Image ? "Unlocking visual concepts..." : "Analyzing cognitive chunks...");
    
    try {
      const activeApiKey = apiKey || process.env.GEMINI_API_KEY;
      if (!activeApiKey) {
        throw new Error("Missing Gemini API Key. Please click the gear icon to set it.");
      }

      const ai = new GoogleGenAI({ apiKey: activeApiKey });
      const parts = [];
      
      if (base64Image && mimeType) {
        parts.push({
          inlineData: {
            data: base64Image,
            mimeType: mimeType
          }
        });
      }
      
      const promptText = text.trim() 
        ? text 
        : "Analyze this image, identify the core themes, and summarize them.";
      
      parts.push({ text: promptText });

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts },
        config: {
          systemInstruction: "You are a Cognitive Psychologist. You specialize in reducing cognitive load by breaking complex information into manageable, thematic chunks. Provide a structured summary.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              chunks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    theme: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    key_terms: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ['theme', 'summary', 'key_terms']
                }
              }
            },
            required: ['chunks']
          }
        }
      });
      
      const textOutput = response.text;
      if (!textOutput) throw new Error("No response from AI.");
      const json = JSON.parse(textOutput);
      
      const aiChunks = json.chunks || [];
      const newChunks: Chunk[] = aiChunks.map((c: any) => {
        const text = c.summary || "";
        const terms = c.key_terms || [];
        const html = highlightText(text, terms);
        return {
          heading: c.theme || "Core Concept",
          text: text,
          htmlContent: html,
          note: '',
          keyTerms: terms
        };
      });
      
      if (newChunks.length > 0) {
        setChunks(newChunks);
        setCurrentIndex(0);
        setAppMode('presurvey');
        setFadeKey(Date.now());
      } else {
        throw new Error("AI did not return any readable chunks.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartReading = () => {
    if (!inputText.trim() && inputMethod === 'text') return;
    callGeminiAPI(inputText);
  };

  const handleNextChunk = () => {
    if (currentIndex < chunks.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsEditingChunk(false);
      setFadeKey(Date.now());
    } else {
      setAppMode('postsurvey');
      setIsEditingChunk(false);
      
      // Save to Vault
      const newItem = {
        id: Date.now(),
        date: new Date().toLocaleDateString(),
        title: chunks[0]?.heading || 'Untitled Session',
        chunks: [...chunks]
      };
      const updated = [newItem, ...vaultHistory];
      setVaultHistory(updated);
      localStorage.setItem('SIMPLIREAD_HISTORY', JSON.stringify(updated));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const isImage = file.type.startsWith('image/');
      
      if (isImage) {
        try {
          const { base64, mimeType } = await fileToBase64(file);
          // Auto-trigger API call with image
          callGeminiAPI("", base64, mimeType);
        } catch(err) {
          alert("Error reading file");
        }
      } else {
        // Fallback for non-image docs in demo
        const fileName = file.name;
        setInputText(`[Extracted from ${fileName}]\n\nReading long PDF documents or presentation slides can overwhelm working memory.\n\nThe human brain functions better when digesting small, cohesive parts of a whole.\n\nSimpliRead helps you minimize cognitive strain by dividing the file into these manageable chunks.`);
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const isImage = file.type.startsWith('image/');
      
      if (isImage) {
        try {
          const { base64, mimeType } = await fileToBase64(file);
          callGeminiAPI("", base64, mimeType);
        } catch(err) {
          alert("Error reading file");
        }
      } else {
        const fileName = file.name;
        setInputText(`[Extracted from ${fileName}]\n\nReading long PDF documents or presentation slides can overwhelm working memory.\n\nThe human brain functions better when digesting small, cohesive parts of a whole.\n\nSimpliRead helps you minimize cognitive strain by dividing the file into these manageable chunks.`);
      }
    }
  };

  const currentSettingsModal = isSettingsOpen && (
    <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-modal-btn" onClick={() => setIsSettingsOpen(false)}>
          <X size={20} />
        </button>
        <h2 className="modal-title">Settings</h2>
        <p className="modal-desc">
          Set up your API Key and Profile.
        </p>
        <div style={{ marginBottom: 10, fontSize: '0.9rem', color: '#555' }}>Nickname</div>
        <input 
          type="text" 
          className="api-input" 
          placeholder="Display Name" 
          value={nickname} 
          onChange={(e) => handleSaveNickname(e.target.value)} 
        />
        <div style={{ marginBottom: 10, fontSize: '0.9rem', color: '#555' }}>Gemini API Key</div>
        <input 
          type="password" 
          className="api-input" 
          placeholder="AIzaSy..." 
          value={apiKey} 
          onChange={(e) => handleSaveApiKey(e.target.value)} 
        />
      </div>
    </div>
  );

  const currentNote = chunks[currentIndex]?.note.trim() || "";
  const isPulsing = currentNote === "";

  const renderReport = () => {
    const highlights: Record<string, string[]> = { yellow: [], green: [], pink: [], blue: [] };
    
    chunks.forEach(chunk => {
      const div = document.createElement('div');
      div.innerHTML = chunk.htmlContent;
      const marks = div.querySelectorAll('mark.user-highlight');
      marks.forEach(mark => {
         const cat = (mark as HTMLElement).dataset.category;
         if (cat && highlights[cat]) {
            highlights[cat].push(mark.textContent || '');
         }
      });
    });

    return (
       <div className="report-container fade-transition">
          <h2 className="report-title">{d.titleReport}</h2>
          <div className="report-stats">
             <div className="stat">{d.ts}: {formatTime(sessionTime)}</div>
             <div className="stat">{d.ch}: {chunks.length}</div>
             <div className="stat" style={{ color: "var(--accent-teal)", fontWeight: 600 }}>
                 {d.score}: +{Math.max(0, (preOverwhelm * 10) + (postClarity * 10))} pts
             </div>
          </div>
          
          <div className="report-section">
             <h3>{d.refl}</h3>
             {chunks.map((c, i) => (
               <div key={i} className="report-note">
                  <h4>{c.heading}</h4>
                  <p>{c.note || <i style={{ color: '#AAA' }}>No notes taken.</i>}</p>
               </div>
             ))}
          </div>

          <div className="report-section">
             <h3>{d.hl}</h3>
             {COLORS.map(color => (
                <div key={color.id} className="highlight-group">
                   <div className="highlight-color-label" style={{ backgroundColor: color.hex }}>
                     {color.label}
                   </div>
                   <ul>
                     {highlights[color.id].length > 0 
                        ? highlights[color.id].map((h, i) => <li key={i}>{h}</li>)
                        : <li className="empty-highlight">No highlights in this category.</li>}
                   </ul>
                </div>
             ))}
          </div>

          <button className="action-btn" onClick={() => { setAppMode('input'); setChunks([]); setInputText(''); setSessionTime(0); setCurrentIndex(0); }}>
            {d.newSession}
          </button>
       </div>
    );
  };

  const renderVault = () => (
    <div className="vault-container">
      <h2 className="vault-title">My Vault</h2>
      {vaultHistory.length === 0 ? (
        <p style={{ color: '#999', fontFamily: 'var(--font-sans)' }}>No history found.</p>
      ) : (
        <div className="vault-grid">
          {vaultHistory.map((item, idx) => (
            <div key={idx} className="vault-card">
              <div className="vault-card-title">{item.title}</div>
              <div className="vault-card-date">Read on {item.date}</div>
              <button 
                className="vault-review-btn"
                onClick={() => {
                  setChunks(item.chunks);
                  setAppMode('report');
                }}
              >
                Review Notes
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="simpliread-container">
      <nav className="global-nav">
        <a href="#" className="nav-logo" onClick={(e) => { e.preventDefault(); setAppMode('input'); }}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="6" fill="#1B998B"/>
            <path d="M7 8H17" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round"/>
            <path d="M7 12H14" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="2" strokeLinecap="round"/>
            <path d="M7 16H11" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="16" cy="16" r="2" fill="#FFD166"/>
          </svg>
          SimpliRead
        </a>
        <div className="nav-links">
          <button className="nav-btn" onClick={() => setAppMode('vault')}>My Vault</button>
          <button className="nav-btn" onClick={() => setIsSettingsOpen(true)}>Settings</button>
        </div>
      </nav>

      {showToast && (
        <div className="toast-notification">
          <div className="toast-content">
            <p>Feeling stuck? It's okay. Take a 1-minute breather with Tether.</p>
            <div>
              <a href="#" className="tether-bridge toast-action">
                <Wind size={16} /> Breathe with Tether
              </a>
              <button className="toast-close" onClick={() => setShowToast(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="app-content">
        <div className="app-header">
          <div className="header-left">
          {appMode !== 'input' && (
             <>
               <div className="focus-timer">
                   Time Spent Learning: {formatTime(sessionTime)}
               </div>
               <a href="#" className="tether-bridge" title="Feeling Overwhelmed? Breathe with Tether.">
                 <Wind size={18} />
                 <span>Breathe with Tether</span>
               </a>
             </>
          )}
          {appMode === 'reading' && (
             <label className="adhd-toggle">
               <input type="checkbox" checked={isBionicMode} onChange={(e) => setIsBionicMode(e.target.checked)} />
               <span>ADHD Focus Mode</span>
             </label>
          )}
        </div>
      </div>

      {currentSettingsModal}

      {appMode === 'input' && (
        <div className="input-container fade-transition" style={{ position: 'relative' }}>
          {isAnalyzing && (
            <div className="loading-overlay">
              <Loader2 className="spinner-icon" size={48} />
              <div className="loading-text">{loadingMessage}</div>
            </div>
          )}
          
          <div className="hero-section">
            <h1 className="hero-title">{d.welcome}{nickname ? `, ${nickname}` : ''}</h1>
            <p className="hero-subtitle">{d.subtitle}</p>
          </div>
          
          <div className="input-workspace">
            <div className="workspace-modes">
              <button 
                className={`mode-btn ${inputMethod === 'text' ? 'active' : ''}`}
                onClick={() => setInputMethod('text')}
              >
                <FileText size={18} />
                <span>{d.textMethod}</span>
              </button>
              <button 
                className={`mode-btn ${inputMethod === 'image' ? 'active' : ''}`}
                onClick={() => setInputMethod('image')}
              >
                <Camera size={18} />
                <span>{d.imageMethod}</span>
              </button>
              <button 
                className={`mode-btn ${inputMethod === 'file' ? 'active' : ''}`}
                onClick={() => setInputMethod('file')}
              >
                <FileUp size={18} />
                <span>{d.fileMethod}</span>
              </button>
            </div>

            <div className="workspace-content">
              {inputMethod === 'text' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <textarea
                  className="main-textarea"
                  placeholder={d.placeholderText}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
                <div style={{ marginTop: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => setInputText("The human immune system is a highly complex network of cells, tissues, and organs that work together to defend the body against attacks by foreign invaders. These are primarily microbes—tiny organisms such as bacteria, parasites, and fungi that can cause infections. Viruses also cause infections, but are too primitive to be classified as living organisms. The immune system's primary task is to distinguish between self and non-self. When it detects a non-self substance (antigen), it triggers an immune response. This involves the activation of various white blood cells, including macrophages, T cells, and B cells. Macrophages engulf and digest the invader. T cells destroy infected cells and help coordinate the overall response. B cells produce antibodies, which are specialized proteins that lock onto specific antigens, marking them for destruction. Memory cells are also created, allowing the immune system to respond more rapidly and effectively if the same pathogen is encountered again in the future. However, sometimes the immune system goes awry, mistakenly attacking the body's own healthy cells, leading to autoimmune diseases like rheumatoid arthritis or lupus.")}
                    style={{ fontSize: '0.85rem', padding: '6px 12px', backgroundColor: 'transparent', border: '1px solid var(--border-color, #E2E8F0)', borderRadius: '20px', cursor: 'pointer', color: 'var(--text-secondary, #64748b)', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s' }}
                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover, #F8FAFC)'; e.currentTarget.style.borderColor = 'var(--accent-teal, #1B998B)'; e.currentTarget.style.color = 'var(--accent-teal, #1B998B)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-color, #E2E8F0)'; e.currentTarget.style.color = 'var(--text-secondary, #64748b)'; }}
                  >
                    💡 Try Medical Paper
                  </button>
                  <button 
                    onClick={() => setInputText("Inflation is a measure of the rate of rising prices of goods and services in an economy. Inflation can occur when prices rise due to increases in production costs, such as raw materials and wages. A surge in demand for products and services can cause inflation as consumers are willing to pay more for the product. Inflation is closely monitored by the Federal Reserve, which sets monetary policy to keep inflation at a target rate of 2%. Inflation can be viewed positively or negatively depending on the individual viewpoint and rate of change. Those with tangible assets, like property or stocked commodities, may like to see some inflation as that raises the value of their assets. People holding cash may not like inflation, as it erodes the value of their cash holdings. The Consumer Price Index (CPI) is a measure that examines the weighted average of prices of a basket of consumer goods and services, such as transportation, food, and medical care.")}
                    style={{ fontSize: '0.85rem', padding: '6px 12px', backgroundColor: 'transparent', border: '1px solid var(--border-color, #E2E8F0)', borderRadius: '20px', cursor: 'pointer', color: 'var(--text-secondary, #64748b)', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s' }}
                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover, #F8FAFC)'; e.currentTarget.style.borderColor = 'var(--accent-teal, #1B998B)'; e.currentTarget.style.color = 'var(--accent-teal, #1B998B)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-color, #E2E8F0)'; e.currentTarget.style.color = 'var(--text-secondary, #64748b)'; }}
                  >
                    💡 Try Financial Report
                  </button>
                </div>
              </div>
              )}

              {inputMethod === 'image' && (
                <label 
                  className={`file-upload-label ${isDragging ? 'drag-active' : ''}`} 
                  onClick={(e) => { e.preventDefault(); imageInputRef.current?.click(); }}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  onDrop={(e) => handleDrop(e)}
                >
                  <Camera size={40} style={{ marginBottom: 15, opacity: 0.5 }} />
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '1.1rem', color: '#555' }}>
                    {d.imageMethod}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#999', marginTop: 5 }}>
                    Click or drag to select an image or diagram
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden-input" 
                    ref={imageInputRef}
                    onChange={(e) => handleFileUpload(e, 'image')}
                  />
                  {inputText && inputText.startsWith('[Extracted') && (
                    <p style={{ marginTop: '15px', color: 'var(--accent-teal)', fontSize: '0.9rem', fontWeight: 500 }}>
                      Image successfully loaded!
                    </p>
                  )}
                </label>
              )}

              {inputMethod === 'file' && (
                <label 
                  className={`file-upload-label ${isDragging ? 'drag-active' : ''}`} 
                  onClick={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  onDrop={(e) => handleDrop(e)}
                >
                  <FileUp size={40} style={{ marginBottom: 15, opacity: 0.5 }} />
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '1.1rem', color: '#555' }}>
                    {d.fileMethod}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#999', marginTop: 5 }}>
                    Click or drag to upload a PDF or Word document
                  </div>
                  <input 
                    type="file" 
                    accept=".pdf,.docx,.png,.jpg,.jpeg" 
                    className="hidden-input" 
                    ref={fileInputRef}
                    onChange={(e) => handleFileUpload(e, 'file')}
                  />
                  {inputText && inputText.startsWith('[Extracted') && (
                    <p style={{ marginTop: '15px', color: 'var(--accent-teal)', fontSize: '0.9rem', fontWeight: 500 }}>
                      File successfully loaded!
                    </p>
                  )}
                </label>
              )}
            </div>

            <div className="workspace-actions">
              <button
                className="start-btn"
                onClick={handleStartReading}
                disabled={!inputText.trim() && inputMethod === 'text'}
              >
                <Wind size={18} />
                {d.startBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {appMode === 'presurvey' && (
        <div className="survey-container fade-transition">
          <h2 className="survey-title">Before we begin...</h2>
          <p className="survey-desc">{d.surveyDesc1}</p>
          <div className="range-slider">
            <span>1 ({d.calm})</span>
            <input type="range" min="1" max="5" value={preOverwhelm} onChange={(e) => setPreOverwhelm(parseInt(e.target.value))} />
            <span>5 ({d.overwhelmed})</span>
          </div>
          <div className="survey-val">{preOverwhelm}</div>
          <button className="action-btn" onClick={() => setAppMode('reading')}>{d.btnReading}</button>
        </div>
      )}

      {appMode === 'reading' && (
        <div key={fadeKey} className="reading-workbench fade-transition">
          <div className="active-reading-zone">
            <div className="zone-header">
              <h2 className="chunk-heading">{chunks[currentIndex].heading}</h2>
              <div className="highlighter-wrapper">
                <div className="highlighter-hint">Highlight text to organize your thoughts.</div>
                <div className="highlighter-toolbar">
                  {COLORS.map(color => (
                    <button
                      key={color.id}
                      className="pill-btn"
                      onClick={() => handleApplyColor(color)}
                    >
                      <div className="pill-dot" style={{ backgroundColor: color.hex }}></div>
                      <span>{color.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {isEditingChunk ? (
              <textarea
                className="chunk-textarea"
                value={currentChunkText}
                onChange={(e) => setCurrentChunkText(e.target.value)}
                onBlur={() => {
                  setIsEditingChunk(false);
                  const updated = [...chunks];
                  updated[currentIndex].text = currentChunkText;
                  updated[currentIndex].htmlContent = highlightText(currentChunkText, updated[currentIndex].keyTerms);
                  setChunks(updated);
                }}
                autoFocus
              />
            ) : (
              <div 
                id="chunk-html-container"
                className="chunk-text-display"
                onDoubleClick={() => setIsEditingChunk(true)}
                dangerouslySetInnerHTML={{ __html: applyBionicReading(chunks[currentIndex].htmlContent) }}
              />
            )}
            
            {!isEditingChunk && (
              <div className="edit-hint">{d.hintEdit}</div>
            )}
          </div>

          <div className="reflection-zone">
            <div>
              <div className="reflection-zone-title">Active Reflection</div>
              <textarea
                className="reflection-textarea"
                placeholder="Write your own summary or 'Why does this matter?' here..."
                value={chunks[currentIndex].note}
                onChange={(e) => {
                  const updated = [...chunks];
                  updated[currentIndex].note = e.target.value;
                  setChunks(updated);
                }}
              />
            </div>
            
            <div className="action-footer">
              <button 
                className={`primary-btn ${isPulsing ? 'pulse-btn' : ''}`} 
                onClick={handleNextChunk}
              >
                {d.btnNext}
              </button>
            </div>
          </div>
        </div>
      )}

      {appMode === 'postsurvey' && (
        <div className="survey-container fade-transition">
          <h2 className="survey-title">Session Complete!</h2>
          <p className="survey-desc">{d.surveyDesc2}</p>
          <div className="range-slider">
            <span>1 ({d.foggy})</span>
            <input type="range" min="1" max="5" value={postClarity} onChange={(e) => setPostClarity(parseInt(e.target.value))} />
            <span>5 ({d.clear})</span>
          </div>
          <div className="survey-val">{postClarity}</div>
          <button className="action-btn" onClick={() => setAppMode('report')}>{d.btnReport}</button>
        </div>
      )}

      {appMode === 'report' && renderReport()}
      {appMode === 'vault' && renderVault()}
      
      </div> {/* End app-content */}
    </div>
  );
}
