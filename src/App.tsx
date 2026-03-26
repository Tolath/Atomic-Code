/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Terminal, ShieldAlert, ShieldCheck, RefreshCw, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import rawWords from './words.txt?raw';

// ======== CONFIGURATION ========
const WORD_LENGTH = 8;
const CONSISTENT_CODE_FOR_SAME_LETTER = true;
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

console.log(`[Terminal] Załadowano zewnętrzną bazę słów: ${EXTERNAL_WORDS.length} pozycji.`);

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
}

export default function App() {
  const [game, setGame] = useState<GameState>({
    targetWord: '',
    keyWord: '',
    puzzleData: [],
    correctCode: '',
    status: 'idle',
    userInput: '',
    cipherAlphabet: ''
  });

  const inputRef = useRef<HTMLInputElement>(null);

  const generateFullAlphabet = (key: string) => {
    const lowKey = key.toLowerCase();
    const uniqueKey = Array.from(new Set(lowKey)).join("");
    const remaining = ALPHABET.split("").filter(c => !uniqueKey.includes(c)).join("");
    return uniqueKey + remaining;
  };

  const initGame = () => {
    const combinedPool = [...FALLBACK_WORDS, ...EXTERNAL_WORDS];
    const wordsPool = combinedPool.filter(w => w.length === WORD_LENGTH);
    const keysPool = FALLBACK_WORDS.filter(w => w.length >= 4 && w.length <= 6);

    const targetWord = wordsPool[Math.floor(Math.random() * wordsPool.length)];
    
    if (!targetWord) {
      console.error(`Błąd: Brak słów o długości ${WORD_LENGTH} w puli FALLBACK_WORDS.`);
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

    // Shuffling puzzle data
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
      cipherAlphabet
    });
  };

  useEffect(() => {
    initGame();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (game.status !== 'playing') return;

    if (game.userInput === game.correctCode) {
      setGame(prev => ({ ...prev, status: 'success' }));
    } else {
      setGame(prev => ({ ...prev, status: 'failure' }));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, WORD_LENGTH);
    setGame(prev => ({ ...prev, userInput: val }));
  };

  const focusInput = () => {
    inputRef.current?.focus();
  };

  return (
    <div className="terminal-screen" onClick={focusInput}>
      <div className="scanlines"></div>
      <div className="flicker"></div>
      <div className="crt-overlay"></div>

      {/* Header */}
      <header className="border-b border-[#33ff33] pb-2 mb-6 flex justify-between items-center z-40">
        <div className="flex items-center gap-2">
          <Terminal size={20} />
          <span className="text-xl tracking-widest uppercase">RobCo Industries (TM) Termlink</span>
        </div>
        <div className="text-sm opacity-70">
          V7.0.1.2 - AUTHENTICATED AS: TOLATH
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col gap-6 z-40 max-w-3xl mx-auto w-full">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold tracking-tighter uppercase mb-1">
            Terminal Aktywacji Atomówki
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
              <div className="bg-[#33ff33]/10 p-4 border border-[#33ff33]/30 rounded">
                <p className="text-lg">
                  <span className="opacity-60">KLUCZ SZYFRU DNIA:</span>{" "}
                  <span className="font-bold underline decoration-double">{game.keyWord}</span>
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl flex items-center gap-2">
                  <Info size={18} /> DANE OD OFICERÓW TERENOWYCH:
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {game.puzzleData.map((data, i) => (
                    <motion.div
                      key={i}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="border border-[#33ff33]/20 p-3 flex justify-between items-center hover:bg-[#33ff33]/5 transition-colors"
                    >
                      <span className="opacity-60">Oficer {i + 1}:</span>
                      <span className="text-xl">
                        Litera '<span className="font-bold">{data.char}</span>', Kod: <span className="font-bold">{data.digit}</span>
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-[#33ff33]/20">
                <p className="text-sm opacity-70 mb-4 italic">
                  WSKAZÓWKA: Zbuduj alfabet (KLUCZ + reszta). Odkoduj litery oficerów, ułóż z nich słowo, a potem wpisz cyfry w kolejności liter tego słowa.
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <label className="text-lg">WPISZ {WORD_LENGTH}-CYFROWY KOD AKTYWACJI:</label>
                  <div className="flex items-center gap-2 text-2xl">
                    <span className="blink">{">"}</span>
                    <input
                      ref={inputRef}
                      type="text"
                      value={game.userInput}
                      onChange={handleInputChange}
                      className="terminal-input text-2xl tracking-[0.5em] w-48"
                      autoFocus
                      placeholder={"_".repeat(WORD_LENGTH)}
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
                <h2 className="text-4xl font-bold tracking-widest text-[#33ff33]">SUKCES</h2>
                <p className="text-xl uppercase">Kod poprawny. Procedura startowa rozpoczęta!</p>
                <p className="text-lg opacity-80">Odkodowane słowo: <span className="font-bold underline">{game.targetWord.toUpperCase()}</span></p>
              </div>
              <button
                onClick={initGame}
                className="mt-8 px-8 py-3 border-2 border-[#33ff33] hover:bg-[#33ff33] hover:text-[#050505] transition-all font-bold uppercase tracking-widest"
              >
                Restart Terminala
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
              <ShieldAlert size={80} className="text-red-500 animate-bounce" />
              <div className="space-y-2">
                <h2 className="text-4xl font-bold tracking-widest text-red-500">BŁĄD</h2>
                <p className="text-xl uppercase">Kod nieprawidłowy. Dostęp zablokowany.</p>
                <div className="bg-red-500/10 border border-red-500/30 p-4 mt-4 rounded">
                  <p className="text-lg">Prawidłowy kod: <span className="font-bold">{game.correctCode}</span></p>
                  <p className="text-lg">Słowo docelowe: <span className="font-bold">{game.targetWord.toUpperCase()}</span></p>
                </div>
              </div>
              <button
                onClick={initGame}
                className="mt-8 px-8 py-3 border-2 border-[#33ff33] hover:bg-[#33ff33] hover:text-[#050505] transition-all font-bold uppercase tracking-widest"
              >
                Ponów Próbę
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-6 pt-4 border-t border-[#33ff33]/20 flex justify-between text-xs opacity-50 z-40">
        <div>(C) 2077 ROBCO INDUSTRIES</div>
        <div className="flex gap-4">
          <span>MEM: 640KB</span>
          <span>CPU: 1.19MHZ</span>
        </div>
      </footer>
    </div>
  );
}