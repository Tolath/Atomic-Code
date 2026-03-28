/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Terminal, ShieldAlert, ShieldCheck, RefreshCw, Info, X, Cpu, MoveHorizontal } from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import rawWords from './words.txt?raw';

// ======== AUDIO CONFIGURATION ========
const HUMM_OVERLAP = 0.2; // Seconds before end of current sound to trigger next buffer
const HUMM_TARGET_VOLUME = 1.0;

// ======== BOOT CONFIGURATION ========
const BOOT_BLACK_DURATION = 8000; // Total blackout time (ms)
const BOOT_FADE_DURATION = 1000;  // Fade-in time (ms)

// ======== CONFIGURATION ========
const WORD_LENGTH = 5;
const CONSISTENT_CODE_FOR_SAME_LETTER = true;
const UNCOVER_GUESS_LETTERS = true; // If true, reveals all correctly guessed digits in their positions
const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

const FALLBACK_WORDS = [
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "it", "for",
  "not", "on", "with", "he", "as", "you", "do", "at", "this", "but", "his", "by",
  "from", "they", "we", "say", "her", "she", "or", "an", "will", "my", "one", "all",
  "would", "there", "their", "what", "so", "up", "out", "if", "about", "who", "get",
  "which", "go", "me", "when", "make", "can", "like", "time", "no", "just", "him",
  "know", "take", "people", "into", "year", "your", "good", "some", "could", "them",
  "see", "other", "than", "then", "now", "look", "only", "come", "its", "over", "think",
  "also", "back", "after", "use", "two", "how", "our", "work", "first", "well", "way",
  "even", "new", "want", "because", "any", "these", "give", "day", "most", "us",
  "code", "data", "link", "fire", "base", "zone", "gate", "path", "lock", "key",
  "alpha", "bravo", "delta", "gamma", "omega", "sigma", "theta", "zeta", "echo",
  "activate", "security", "terminal", "protocol", "database", "overseer", "shutdown", "junction",
  "position", "strength"
];

const EXTERNAL_WORDS = rawWords
  ? rawWords.split(/\r?\n/).map(w => w.trim().toLowerCase()).filter(w => w.length > 0)
  : [];

console.log(`[Terminal] Loaded external word database: ${EXTERNAL_WORDS.length} entries.`);

interface PuzzleItem {
  char: string;
  digit: string;
}

interface GameState {
  targetWord: string;
  keyWord: string;
  puzzleData: PuzzleItem[];
  correctCode: string;
  status: 'idle' | 'playing' | 'success' | 'failure';
  userInput: string;
  cipherAlphabet: string;
  attempts: number;
  revealedIndices: number[];
}

export default function App() {
  const [game, setGame] = useState<GameState>({
    targetWord: '',
    keyWord: '',
    puzzleData: [],
    correctCode: '',
    status: 'idle',
    userInput: '',
    cipherAlphabet: '',
    attempts: 0,
    revealedIndices: []
  });
  const [bootStatus, setBootStatus] = useState<'black' | 'fading' | 'ready'>('black');
  const [isHelperOpen, setIsHelperOpen] = useState(false);

  // States for the interactive helper workbench
  const audioStarted = useRef(false);
  const startupSoundRef = useRef<HTMLAudioElement>(null);
  const humm1Ref = useRef<HTMLAudioElement>(null);
  const humm2Ref = useRef<HTMLAudioElement>(null);
  const [workbenchLetters, setWorkbenchLetters] = useState<(PuzzleItem & { decoded: string, id: string })[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

// Global focus management for inputs and prevent focus loss
  useEffect(() => {
    const handleGlobalFocus = (e: Event) => {
// Don't steal focus if user intentionally clicks button
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.tagName === 'A') return;
      if (target.tagName === 'INPUT') return;

      const activeInput = isHelperOpen 
        ? document.getElementById('helper-input') as HTMLInputElement 
        : inputRef.current;

      activeInput?.focus();
    };

    const focusAlways = () => {
      if (isHelperOpen) {
        document.getElementById('helper-input')?.focus();
      } else {
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', focusAlways);
    window.addEventListener('mousedown', handleGlobalFocus);
    return () => {
      window.removeEventListener('keydown', focusAlways);
      window.removeEventListener('mousedown', handleGlobalFocus);
    };
  }, [isHelperOpen]);

// Realistic visual boot sequence (blackout -> fade-in)
  useEffect(() => {
    const fadeTimer = setTimeout(() => setBootStatus('fading'), BOOT_BLACK_DURATION);
    const readyTimer = setTimeout(() => setBootStatus('ready'), BOOT_BLACK_DURATION + BOOT_FADE_DURATION);
    
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(readyTimer);
    };
  }, []);

  // Audio for background music (startup and humm) with fade-in
  useEffect(() => {
// Prevents double-triggering in StrictMode
    if (audioStarted.current) return;

    const startupAudio = startupSoundRef.current;
    const humms = [humm1Ref.current, humm2Ref.current];
    let fadeInterval: NodeJS.Timeout | null = null; // To store the interval ID for fading
    let crossfadeTimeout: NodeJS.Timeout | null = null; 
    let loopInterval: NodeJS.Timeout | null = null;
    let currentHummIdx = 0;
    let loopStarted = false;

    if (startupAudio && humms[0] && humms[1]) {
      audioStarted.current = true;

// Buffer configuration
      humms.forEach(h => {
        if (h) { h.volume = 0; h.muted = false; h.loop = false; }
      });

      // Function to gradually increase hummAudio volume
      const fadeInHumm = (audio: HTMLAudioElement) => {
        if (fadeInterval) clearInterval(fadeInterval);
        
        let vol = audio.volume;
        const step = 0.05; // Fewer but larger steps to avoid glitches

        fadeInterval = setInterval(() => {
          vol += step;
          if (vol >= HUMM_TARGET_VOLUME) {
            audio.volume = HUMM_TARGET_VOLUME;
            if (fadeInterval) clearInterval(fadeInterval);
          } else {
            audio.volume = vol;
          }
        }, 50);
      };

      const startHummLoop = () => {
        const playNext = () => {
          const nextAudio = humms[currentHummIdx];
          if (nextAudio) {
            nextAudio.currentTime = 0;
            nextAudio.play().catch(() => {});
            if (nextAudio.volume === 0) fadeInHumm(nextAudio);
          }
          
          if (nextAudio) {
            const duration = nextAudio.duration || 10;
            const timeToNext = (duration - HUMM_OVERLAP) * 1000;
            
            loopInterval = setTimeout(() => {
              currentHummIdx = 1 - currentHummIdx;
              playNext();
            }, timeToNext);
          }
        };
        playNext();
      };

      const triggerHumm = () => {
        if (loopStarted) return;
        loopStarted = true;
        startHummLoop();
      };

      const startSequence = () => {
        startupAudio.play().catch(e => {
          console.warn("[Audio] Startup blocked, playing humm immediately.");
          triggerHumm();
        });

// Schedule crossfade 1s before startup ends
        const setupCrossfade = () => {
          const duration = startupAudio.duration * 1000;
          const offset = 1000; // start 1s before end
          crossfadeTimeout = setTimeout(() => {
            triggerHumm();
          }, Math.max(0, duration - offset));
        };

        if (startupAudio.readyState >= 1) setupCrossfade();
        else startupAudio.onloadedmetadata = setupCrossfade;
      };

      startSequence();

      startupAudio.onended = () => {
        if (crossfadeTimeout) clearTimeout(crossfadeTimeout);
        triggerHumm();
      };

      return () => {
        if (crossfadeTimeout) clearTimeout(crossfadeTimeout);
        if (fadeInterval) clearInterval(fadeInterval);
        if (loopInterval) clearTimeout(loopInterval);
      };
    }
  }, []);
  // Audio element for click sound
  const clickSoundRef = useRef<HTMLAudioElement>(null);
  const playClickSound = () => {
    clickSoundRef.current?.play();
  };

// Debug helper opening state
  useEffect(() => {
    console.log(`[Terminal] Decryptor state: ${isHelperOpen ? 'OPEN' : 'CLOSED'}`);
  }, [isHelperOpen]);

  const generateFullAlphabet = (key: string) => {
    const lowKey = key.toLowerCase();
    const uniqueKey = Array.from(new Set(lowKey)).join("");
    const remaining = ALPHABET.split("").filter(c => !uniqueKey.includes(c)).join("");
    return uniqueKey + remaining;
  };

  const initGame = () => {
    const combinedPool = [...FALLBACK_WORDS, ...EXTERNAL_WORDS];
    const wordsPool = combinedPool.filter(w => w.length === WORD_LENGTH);
    const keysPool = combinedPool;

    const targetWord = wordsPool[Math.floor(Math.random() * wordsPool.length)];
    
    if (!targetWord) {
console.error(`Error: No ${WORD_LENGTH}-letter words in FALLBACK_WORDS pool.`);
      return;
    }

    const keyWord = keysPool[Math.floor(Math.random() * keysPool.length)].toUpperCase();
    const cipherAlphabet = generateFullAlphabet(keyWord.toLowerCase());

    const puzzleData: PuzzleItem[] = [];
    const letterDigitMap: Record<string, string> = {};

    for (const char of targetWord) {
      const idx = ALPHABET.indexOf(char);
      const cipherChar = cipherAlphabet[idx];
      let digit: string;

      if (CONSISTENT_CODE_FOR_SAME_LETTER) {
        if (!letterDigitMap[char]) {
          letterDigitMap[char] = Math.floor(Math.random() * 9 + 1).toString();
        }
        digit = letterDigitMap[char];
      } else {
        digit = Math.floor(Math.random() * 9 + 1).toString();
      }
      puzzleData.push({ char: cipherChar.toUpperCase(), digit });
    }

// Shuffle puzzle data
    const shuffledPuzzle = [...puzzleData].sort(() => Math.random() - 0.5);

    // Calculate correct code
    const decodedPairs = puzzleData.map(data => {
      const idx = cipherAlphabet.indexOf(data.char.toLowerCase());
      const decodedChar = ALPHABET[idx];
      return { char: decodedChar, digit: data.digit };
    });

    const remainingPairs = [...decodedPairs];
    const correctDigits: string[] = [];
    for (const letter of targetWord) {
      const pairIdx = remainingPairs.findIndex(p => p.char === letter);
      if (pairIdx !== -1) {
        correctDigits.push(remainingPairs[pairIdx].digit);
        remainingPairs.splice(pairIdx, 1);
      } else {
        correctDigits.push('?');
      }
    }

    const correctCode = correctDigits.join("");

    setGame({
      targetWord,
      keyWord,
      puzzleData: shuffledPuzzle,
      correctCode,
      status: 'playing',
      userInput: '',
      cipherAlphabet,
      attempts: 0,
      revealedIndices: []
    });
    setWorkbenchLetters([]);
  };

  useEffect(() => {
    initGame();
  }, []);

  const toggleWorkbenchLetter = (originalChar: string) => {
    const upperChar = originalChar.toUpperCase();
    const allAvailable = game.puzzleData.map((p, idx) => {
      const alphaIdx = game.cipherAlphabet.indexOf(p.char.toLowerCase());
      return {
        ...p,
        decoded: ALPHABET[alphaIdx].toUpperCase(),
        id: `letter-${idx}`
      };
    });

    const instancesOfChar = allAvailable.filter(item => item.decoded === upperChar);
    if (instancesOfChar.length === 0) return;

    setWorkbenchLetters(prev => {
      const alreadyIn = prev.filter(item => item.decoded === upperChar);
      if (alreadyIn.length < instancesOfChar.length) {
        const nextToAdd = instancesOfChar.find(inst => !prev.some(p => p.id === inst.id));
        if (nextToAdd) return [...prev, nextToAdd];
      } else {
        const toRemove = prev.find(item => item.decoded === upperChar);
        return prev.filter(item => item.id !== toRemove?.id);
      }
      return prev;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (game.status !== 'playing') return;

    if (game.userInput === game.correctCode) {
      setGame(prev => ({ ...prev, status: 'success' }));
    } else {
      const nextAttempts = game.attempts + 1;
      
      if (nextAttempts >= 3) {
        setGame(prev => ({ ...prev, status: 'failure', attempts: nextAttempts }));
      } else {
        let newRevealedIndices = [...game.revealedIndices];

        if (UNCOVER_GUESS_LETTERS) {
// Reveal all digits player entered correctly in position
          for (let i = 0; i < game.userInput.length; i++) {
            if (game.userInput[i] === game.correctCode[i] && !newRevealedIndices.includes(i)) {
              newRevealedIndices.push(i);
            }
          }
        } else {
// Original logic: reveal 1 completely random position as hint
          const unrevealed = [];
          for (let i = 0; i < WORD_LENGTH; i++) {
            if (!game.revealedIndices.includes(i)) unrevealed.push(i);
          }
          if (unrevealed.length > 0) {
            const randomIdx = unrevealed[Math.floor(Math.random() * unrevealed.length)];
            newRevealedIndices.push(randomIdx);
          }
        }
        
        setGame(prev => ({
          ...prev,
          attempts: nextAttempts,
          revealedIndices: newRevealedIndices,
// Clear input after error
        }));
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, WORD_LENGTH);
    setGame(prev => ({ ...prev, userInput: val }));
  };

  return (
    <div className="terminal-screen">
      {/* Startup Overlay (3s black + 1s fade) */}
      {bootStatus !== 'ready' && (
        <div 
          className={`fixed inset-0 z-[100] bg-[#050505] transition-opacity pointer-events-none ${
            bootStatus === 'fading' ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ transitionDuration: `${BOOT_FADE_DURATION}ms` }}
        />
      )}

      <div className="scanlines"></div>
      <div className="flicker"></div>
      <div className="crt-overlay"></div>

      {/* Header */}
      <header className="border-b border-[#33ff33] pb-2 mb-4 flex justify-between items-center z-40 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={20} />
          <span className="text-lg sm:text-xl tracking-widest uppercase">RobCo Industries (TM) Termlink</span>
        </div>
        <div className="text-sm opacity-70">
          V7.0.1.2 - AUTHENTICATED AS: TOLATH
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col gap-4 z-40 max-w-3xl mx-auto w-full overflow-y-auto pr-2 custom-scrollbar">
        <div className="text-center mb-4">
<h1 className="text-3xl font-bold tracking-tighter uppercase mb-1">
            Nuclear Activation Terminal
          </h1>
          <div className="h-px w-full bg-[#33ff33] opacity-30"></div>
        </div>

        <AnimatePresence mode="wait">
          {game.status === 'playing' && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 bg-[#33ff33]/10 p-4 border border-[#33ff33]/30 rounded">
                  <p className="text-lg">
                    <span className="opacity-60">CIPHER KEY:</span>{" "}
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsHelperOpen(true); }}
                      className="font-bold underline cursor-pointer hover:bg-[#33ff33] hover:text-[#050505] transition-colors px-2 py-0.5 rounded animate-pulse"
                    >
                      {game.keyWord}
                    </button>
                  </p>
                </div>
                <div className="bg-[#33ff33]/5 p-4 border border-[#33ff33]/30 rounded flex items-center gap-4 min-w-[180px]">
                  <span className="text-xs opacity-60 uppercase">ACCESSES:</span>
                  <div className="flex gap-2">
                    {[...Array(3)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-4 h-4 border ${i < (3 - game.attempts) ? 'bg-[#33ff33] border-[#33ff33]' : 'bg-transparent border-[#33ff33]/20'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl flex items-center gap-2">
                  <Info size={18} /> FIELD OFFICER DATA:
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[30vh] overflow-y-auto p-1 border border-[#33ff33]/10 rounded bg-[#050505]/50 custom-scrollbar">
                  {game.puzzleData.map((data, i) => (
                    <motion.div
                      key={i}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="border border-[#33ff33]/20 p-3 flex justify-between items-center hover:bg-[#33ff33]/5 transition-colors"
                    >
                      <span className="opacity-60">Officer {i + 1}:</span>
                      <span className="text-xl">
                        Letter '<span className="font-bold">{data.char}</span>', Code: <span className="font-bold">{data.digit}</span>
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-[#33ff33]/20">
                <p className="text-sm opacity-70 mb-4 italic">
                  HINT: Build alphabet (KEY + remainder). Decode officer letters, arrange into word, then enter digits in letter order.
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <label className="text-lg">ENTER {WORD_LENGTH}-DIGIT ACTIVATION CODE:</label>
                  <div className="flex items-center gap-2 text-2xl">
                    <span className="blink">{">"}</span>
                    <input
                      ref={inputRef}
                      type="text"
                      value={game.userInput}
                      onChange={handleInputChange}
                      className="terminal-input text-2xl tracking-[0.5em] w-48"
                      placeholder={game.correctCode.split('').map((c, i) => game.revealedIndices.includes(i) ? c : '_').join('')}
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="hidden" // Hidden but allows Enter to submit
                  >
                    SUBMIT
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {game.status === 'success' && (
            <motion.div
              key="success"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center gap-6"
            >
              <ShieldCheck size={80} className="text-[#33ff33] animate-pulse" />
              <div className="space-y-2">
                <h2 className="text-4xl font-bold tracking-widest text-[#33ff33]">SUCCESS</h2>
                <p className="text-xl uppercase">Code accepted. Launch sequence initiated!</p>
                <p className="text-lg opacity-80">Decoded word: <span className="font-bold underline">{game.targetWord.toUpperCase()}</span></p>
              </div>
              <button
                onClick={initGame}
                className="mt-8 px-8 py-3 border-2 border-[#33ff33] hover:bg-[#33ff33] hover:text-[#050505] transition-all font-bold uppercase tracking-widest"
              >
                Restart Terminal
              </button>
            </motion.div>
          )}

          {game.status === 'failure' && (
            <motion.div
              key="failure"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center gap-6"
            >
              <ShieldAlert size={80} className="text-red-500" />
              <div className="space-y-2">
                <h2 className="text-4xl font-bold tracking-widest text-red-500">ERROR</h2>
                <p className="text-xl uppercase">System locked. Too many attempts.</p>
                <div className="bg-red-500/10 border border-red-500/30 p-4 mt-4 rounded">
                  <p className="text-lg opacity-60 uppercase italic text-red-500">CRITICAL SECURITY BREACH</p>
                  <p className="mt-2 text-sm opacity-80 uppercase">
                    EXPECTED PASSWORD: <span className="font-bold text-red-500 underline decoration-double">{game.targetWord.toUpperCase()}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={initGame}
                className="mt-8 px-8 py-3 border-2 border-[#33ff33] hover:bg-[#33ff33] hover:text-[#050505] transition-all font-bold uppercase tracking-widest"
              >
                Full System Reset
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Decryptor Helper Modal */}
      <AnimatePresence>
        {isHelperOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#050505]/95 backdrop-blur-sm"
            onClick={() => setIsHelperOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="helper-modal border-2 border-[#33ff33] bg-[#050505] p-6 max-w-3xl w-full relative shadow-[0_0_30px_rgba(51,255,51,0.15)] overflow-y-auto max-h-[90vh] custom-scrollbar"
            >
              <div className="scanlines pointer-events-none"></div>
              <div className="flicker pointer-events-none"></div>
              <div className="crt-overlay pointer-events-none"></div>

              <div className="flex justify-between items-center mb-6 border-b border-[#33ff33]/30 pb-2">
                <div className="flex items-center gap-2 text-[#33ff33]">
                  <Cpu size={20} />
                  <span className="text-lg font-bold uppercase tracking-tighter">RobCo Decryptor v1.0.4</span>
                </div>
                <button 
                  onClick={() => setIsHelperOpen(false)}
                  className="hover:bg-red-600 hover:text-white transition-colors p-1"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-8">
                {/* Terminal Memory moved here */}
                {game.revealedIndices.length > 0 && (
                  <section className="bg-[#33ff33]/5 border-2 border-dashed border-[#33ff33]/30 p-4 rounded text-center">
                <h3 className="text-xs opacity-50 uppercase tracking-[0.2em] mb-2">Terminal Memory: Sequential Logs</h3>
                    <div className="flex justify-center gap-4">
                      {game.targetWord.split('').map((char, i) => (
                        <div key={i} className="flex flex-col items-center">
                          <div className={`text-2xl font-bold ${game.revealedIndices.includes(i) ? 'text-[#33ff33]' : 'opacity-10'}`}>
                            {game.revealedIndices.includes(i) ? char.toUpperCase() : '?'}
                          </div>
                          <div className="text-[10px] opacity-40 font-mono">
                            {game.revealedIndices.includes(i) ? `[${game.correctCode[i]}]` : '[*]'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Alphabet Mapping */}
                <section>
                  <h3 className="text-xs opacity-60 uppercase mb-3 tracking-widest text-center">Substitution Table</h3>
                  <div className="overflow-x-auto pb-2 custom-scrollbar">
                    <div className="grid grid-cols-13 gap-1 min-w-[600px] text-center font-mono text-sm">
                      {ALPHABET.split('').map((char, i) => {
                        const upperChar = char.toUpperCase();
                        const isInWorkbench = workbenchLetters.some(l => l.decoded === upperChar);

                        return (
                          <button 
                            key={i} 
                            onClick={() => toggleWorkbenchLetter(char)}
                            onMouseDown={playClickSound} // Play sound on click
                            className={`border border-[#33ff33]/30 transition-all cursor-pointer ${isInWorkbench ? 'bg-[#33ff33] text-[#050505]' : 'hover:bg-[#33ff33]/20'}`}
                          >
                            <div className={`p-1 text-[10px] border-b border-[#33ff33]/10 uppercase ${isInWorkbench ? 'text-[#050505]/60' : ''}`}>{char}</div>
                            <div className="p-1 font-bold text-lg uppercase">{game.cipherAlphabet[i]}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] opacity-40 italic text-center uppercase">Top: Original | Bottom: Cipher</div>
                </section>

                {/* Officer Data Recap */}
                <section>
                  <h3 className="text-xs opacity-60 uppercase mb-3 tracking-widest text-center">Intelligence Data (Reports)</h3>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {game.puzzleData.map((data, i) => (
                      <div key={i} className="bg-[#33ff33]/5 border border-[#33ff33]/20 py-1 text-center">
                        <div className="text-[9px] opacity-40 uppercase">#{i+1}</div>
                        <div className="text-base font-bold uppercase">{data.char}→{data.digit}</div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Interactive Workbench */}
                <section className="border-y border-[#33ff33]/20 py-6">
                  <h3 className="text-sm font-bold uppercase mb-4 text-[#33ff33] flex items-center gap-2">
                    <MoveHorizontal size={16} /> Decryption Workbench (Drag Letters)
                  </h3>
                  <Reorder.Group 
                    axis="x" 
                    values={workbenchLetters} 
                    onReorder={setWorkbenchLetters}
                    className="flex flex-wrap justify-center gap-3 mb-6"
                  >
                    {workbenchLetters.map((item) => (
                      <Reorder.Item 
                        key={item.id} 
                        value={item}
                        className="cursor-grab active:cursor-grabbing bg-[#33ff33]/20 border-2 border-[#33ff33] p-3 rounded min-w-[60px] text-center"
                      >
                        <div className="text-2xl font-black">{item.decoded}</div>
                        <div className="text-xs opacity-60 border-t border-[#33ff33]/30 mt-1">{item.digit}</div>
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                  
                  {workbenchLetters.length === 0 && (
                    <div className="text-center py-4 border-2 border-dashed border-[#33ff33]/20 rounded mb-6">
                      <p className="text-xs opacity-40 uppercase italic">
                        Click decoded letters in table above to add them here
                      </p>
                    </div>
                  )}
                </section>

                {/* Input Mirror */}
                <section className="bg-[#33ff33]/10 p-6 border border-[#33ff33]/30 rounded text-center">
                  <label htmlFor="helper-input" className="block text-sm mb-4 opacity-70 uppercase tracking-widest">
                    Enter Decoded Code
                  </label>
                  <div className="flex justify-center items-center gap-3">
                    <span className="text-3xl blink text-[#33ff33]">{">"}</span>
                    <input
                      id="helper-input"
                      type="text"
                      value={game.userInput}
                      autoComplete="off"
                      onChange={handleInputChange}
                      autoFocus
                      placeholder={"_".repeat(WORD_LENGTH)}
                      className="bg-transparent border-b-2 border-[#33ff33] text-4xl tracking-[0.4em] outline-none w-64 text-center pb-2"
                    />
                  </div>
                  <p className="mt-4 text-[10px] opacity-50 italic uppercase">
                    {WORD_LENGTH} digits required. Press ESC or X to return.
                  </p>
                </section>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="mt-4 pt-4 border-t border-[#33ff33]/20 flex justify-between text-xs opacity-50 z-40 shrink-0">
        <div>(C) 2077 ROBCO INDUSTRIES</div>
        <div className="flex gap-4">
          <span>MEM: 640KB</span>
          <span>CPU: 1.19MHZ</span>
        </div>
      </footer>

      {/* Hidden audio element for click sound */}
      <audio ref={clickSoundRef} src="/sounds/terminal_click.mp3" preload="auto" className="hidden">
        Your browser does not support the audio element.
      </audio>

      {/* Hidden audio elements for background music */}
      <audio ref={startupSoundRef} src="/sounds/startup.mp3" preload="auto" className="hidden">
        Your browser does not support the audio element.
      </audio>
      <audio ref={humm1Ref} src="/sounds/humm.mp3" preload="auto" className="hidden" />
      <audio ref={humm2Ref} src="/sounds/humm.mp3" preload="auto" className="hidden" />



      <style>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(51, 255, 51, 0.3) rgba(51, 255, 51, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(51, 255, 51, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(51, 255, 51, 0.3);
        }
        .grid-cols-13 {
          grid-template-columns: repeat(13, minmax(0, 1fr));
        }
      `}</style>
    </div>
  );
}