import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Transaction, useTransactions } from "@/hooks/useTransactions";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";
import Charts from "@/components/Charts";
import WealthAnalysis from "@/components/WealthAnalysis";
import {
  ChevronDown, ChevronRight, MoreVertical, Plus, CalendarIcon, Headphones, Mic, Play, Pause,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface PulseTabProps {
  transactions: Transaction[];
  stats: {
    income: number;
    expenses: number;
    netWorth: number;
    savingsRate: number;
    assets: number;
    liabilities: number;
  };
}

const CURRENCY_OPTIONS = ["UGX", "USD", "EUR", "GBP", "KES"];
const ASSET_ACCOUNTS = ["Cash", "Bank", "Investments", "Crypto", "Property"];
const LIABILITY_TYPES = ["Loans", "Mortgages", "Credit Cards", "Payday Loans", "Other"];
const WEALTH_WIRE_STORAGE_KEY = "wealth_wire_briefings_v1";
const WIRE_PROXY_URL =
  (import.meta.env.VITE_WIRE_PROXY_URL as string | undefined)?.trim() ||
  "https://wealth-wire-proxy.jenwealthy.workers.dev";

type StoredBriefing = {
  dateKey: string;
  script: string;
  generatedAt: string;
};

const getDateKey = (date = new Date()) => format(date, "yyyy-MM-dd");
const ZARA_ELEVEN_VOICE_IDS = [
  "JBFqnCBsd6RMkjVDRZzb",
  "pFZP5JQG7iQjIQuC4Bku",
  "FGY2WhTYpPnrIDTdsKH5",
] as const;
type ZaraElevenVoiceId = (typeof ZARA_ELEVEN_VOICE_IDS)[number];
const WIRE_SELECTED_VOICE_KEY = "wealth_wire_voice_id";
const wireAudioStorageKey = (dateKey: string, voiceId: string) => `wealth_wire_audio_${dateKey}_${voiceId}`;

const formatGeneratedTime = (iso: string) =>
  `Generated at ${new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;

const splitSentences = (text: string) => {
  const parts = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [];
  let cursor = 0;
  return parts.map((raw) => {
    const sentence = raw;
    const start = cursor;
    const end = start + sentence.length;
    cursor = end;
    return { sentence, start, end };
  });
};

const WealthWireCard = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [script, setScript] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");
  const [error, setError] = useState("");
  const [selectedSpeed, setSelectedSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number | null>(null);
  const [briefings, setBriefings] = useState<StoredBriefing[]>([]);
  const [fallbackNotice, setFallbackNotice] = useState<string>("");
  const [selectedVoiceId, setSelectedVoiceId] = useState<ZaraElevenVoiceId>(() => {
    const saved = localStorage.getItem(WIRE_SELECTED_VOICE_KEY);
    if (saved && (ZARA_ELEVEN_VOICE_IDS as readonly string[]).includes(saved)) return saved as ZaraElevenVoiceId;
    return ZARA_ELEVEN_VOICE_IDS[0];
  });
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechQueueRef = useRef<{ idx: number; cancelled: boolean }>({ idx: 0, cancelled: false });
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const sentenceStartTimesRef = useRef<number[]>([]);

  const sentences = useMemo(() => splitSentences(script), [script]);
  const hasScript = script.trim().length > 0;

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [],
  );

  const stopPlayback = () => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setActiveSentenceIndex(null);
    utteranceRef.current = null;
    speechQueueRef.current = { idx: 0, cancelled: true };

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const cleanupAudioUrl = () => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  };

  const pruneOldWireAudioCache = () => {
    const today = getDateKey();
    const prefix = "wealth_wire_audio_";
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      // keys are wealth_wire_audio_${dateKey}_${voiceId}
      const rest = k.slice(prefix.length);
      const dateKey = rest.slice(0, 10);
      if (dateKey !== today) localStorage.removeItem(k);
    }
  };

  const startWebSpeechFallback = () => {
    if (!hasScript || typeof window === "undefined") return;
    const synth = window.speechSynthesis;

    // Voice ranking (best-effort, varies by OS/browser).
    const scoreVoice = (v: SpeechSynthesisVoice) => {
      let score = 0;
      const name = (v.name || "").toLowerCase();
      const lang = (v.lang || "").toLowerCase();
      const local = (v as unknown as { localService?: boolean }).localService;

      if (lang === "en-us") score += 50;
      else if (lang.startsWith("en-")) score += 30;

      if (local) score += 10;
      if (name.includes("google")) score += 8;
      if (name.includes("microsoft")) score += 6;
      if (name.includes("natural")) score += 6;

      const femaleHints = ["female", "samantha", "zira", "karen", "moira", "victoria"];
      if (femaleHints.some((h) => name.includes(h))) score += 12;

      return score;
    };

    const pickBestVoice = () => {
      const voices = synth.getVoices();
      if (!voices.length) return null;
      return [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || null;
    };

    selectedVoiceRef.current = pickBestVoice();
    speechQueueRef.current = { idx: 0, cancelled: false };

    const speakNext = () => {
      const q = speechQueueRef.current;
      if (q.cancelled) return;
      if (q.idx >= sentences.length) {
        setIsPlaying(false);
        setIsPaused(false);
        setActiveSentenceIndex(null);
        utteranceRef.current = null;
        return;
      }

      const currentIdx = q.idx;
      const text = sentences[currentIdx]?.sentence?.trim();
      if (!text) {
        q.idx += 1;
        speakNext();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.voice = selectedVoiceRef.current || undefined;
      utterance.rate = selectedSpeed;
      utterance.pitch = 1.05;
      utterance.volume = 1;

      utterance.onstart = () => {
        setIsPlaying(true);
        setIsPaused(false);
        setActiveSentenceIndex(currentIdx);
      };

      utterance.onend = () => {
        q.idx += 1;
        speakNext();
      };

      utterance.onerror = () => {
        setIsPlaying(false);
        setIsPaused(false);
        setActiveSentenceIndex(null);
        utteranceRef.current = null;
        setError("Playback failed on this browser.");
      };

      utteranceRef.current = utterance;
      synth.speak(utterance);
    };

    speakNext();
  };

  useEffect(() => {
    try {
      pruneOldWireAudioCache();
      const raw = localStorage.getItem(WEALTH_WIRE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredBriefing[];
      if (!Array.isArray(parsed)) return;
      const cleaned = parsed
        .filter((item) => item?.dateKey && item?.script && item?.generatedAt)
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
        .slice(0, 7);
      setBriefings(cleaned);

      const todaysEntry = cleaned.find((entry) => entry.dateKey === getDateKey());
      if (todaysEntry) {
        setScript(todaysEntry.script);
        setGeneratedAt(todaysEntry.generatedAt);
      }
    } catch {
      // Ignore storage parse failures and continue with empty state.
    }
  }, []);

  useEffect(() => {
    return () => {
      stopPlayback();
      cleanupAudioUrl();
    };
  }, []);

  useEffect(() => {
    stopPlayback();
    cleanupAudioUrl();
  }, [script]);

  useEffect(() => {
    localStorage.setItem(WIRE_SELECTED_VOICE_KEY, selectedVoiceId);
  }, [selectedVoiceId]);

  useEffect(() => {
    // If voice changes, stop playback and clear highlight; audio can be regenerated/cached per-voice.
    stopPlayback();
    cleanupAudioUrl();
    setFallbackNotice("");
  }, [selectedVoiceId]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = selectedSpeed;
    }
  }, [selectedSpeed]);

  const persistBriefing = (next: StoredBriefing) => {
    const merged = [next, ...briefings.filter((item) => item.dateKey !== next.dateKey)]
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
      .slice(0, 7);
    setBriefings(merged);
    localStorage.setItem(WEALTH_WIRE_STORAGE_KEY, JSON.stringify(merged));
  };

  const generateBriefing = async () => {
    setIsLoading(true);
    setError("");
    stopPlayback();
    try {
      if (!WIRE_PROXY_URL) {
        throw new Error("Wire proxy URL missing. Set VITE_WIRE_PROXY_URL in .env.");
      }
      const response = await fetch(WIRE_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateKey: getDateKey() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Wire proxy request failed.");
      }
      const nextScript = data.script || "";
      if (!nextScript.trim()) {
        throw new Error("No script was returned.");
      }
      const generatedAtIso = new Date().toISOString();
      setScript(nextScript);
      setGeneratedAt(generatedAtIso);
      persistBriefing({ dateKey: getDateKey(), script: nextScript, generatedAt: generatedAtIso });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate briefing.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (!hasScript || typeof window === "undefined") return;
    setFallbackNotice("");

    // Prefer ElevenLabs audio if available/loaded.
    const audio = audioRef.current;
    if (audio) {
      if (!audio.paused && isPlaying) {
        audio.pause();
        setIsPaused(true);
        return;
      }
      if (audio.paused && isPaused) {
        audio.play().catch(() => {});
        setIsPaused(false);
        return;
      }
    }

    const synth = window.speechSynthesis;
    if (synth.speaking && !synth.paused && isPlaying) {
      synth.pause();
      setIsPaused(true);
      return;
    }

    if (synth.paused && isPaused) {
      synth.resume();
      setIsPaused(false);
      return;
    }

    stopPlayback();
    // Fetch ElevenLabs audio + timestamps via Worker.
    (async () => {
      try {
        const todayKey = getDateKey();
        const cacheKey = wireAudioStorageKey(todayKey, selectedVoiceId);
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as {
            audio_base64?: string;
            alignment?: { character_start_times_seconds?: number[] };
            normalized_alignment?: { character_start_times_seconds?: number[] };
            createdAtISO?: string;
          };
          if (cached?.audio_base64) {
            cleanupAudioUrl();
            const bytes = Uint8Array.from(atob(String(cached.audio_base64)), (c) => c.charCodeAt(0));
            const blob = new Blob([bytes], { type: "audio/mpeg" });
            const url = URL.createObjectURL(blob);
            audioUrlRef.current = url;

            const audioEl = new Audio(url);
            audioEl.playbackRate = selectedSpeed;
            audioRef.current = audioEl;

            const startTimes = cached?.alignment?.character_start_times_seconds || cached?.normalized_alignment?.character_start_times_seconds || [];
            sentenceStartTimesRef.current = sentences.map((s) => startTimes[s.start] ?? 0);

            const updateHighlight = () => {
              const t = audioEl.currentTime;
              const starts = sentenceStartTimesRef.current;
              let idx = 0;
              for (let i = 0; i < starts.length; i += 1) {
                if (t >= starts[i]) idx = i;
                else break;
              }
              setActiveSentenceIndex(Number.isFinite(idx) ? idx : null);
            };

            audioEl.ontimeupdate = updateHighlight;
            audioEl.onplay = () => {
              setIsPlaying(true);
              setIsPaused(false);
            };
            audioEl.onpause = () => {
              if (audioEl.currentTime > 0 && audioEl.currentTime < audioEl.duration) setIsPaused(true);
            };
            audioEl.onended = () => {
              setIsPlaying(false);
              setIsPaused(false);
              setActiveSentenceIndex(null);
            };

            await audioEl.play();
            return;
          }
        }

        const ttsUrl = `${WIRE_PROXY_URL.replace(/\/$/, "")}/tts`;
        let data: {
          audio_base64?: string;
          alignment?: { character_start_times_seconds?: number[] };
          normalized_alignment?: { character_start_times_seconds?: number[] };
        } | null = null;
        let lastError: string | null = null;

        // If user selected a voice, try it first, then fall back to others.
        const voiceTryOrder = [selectedVoiceId, ...ZARA_ELEVEN_VOICE_IDS.filter((v) => v !== selectedVoiceId)];
        for (const voiceId of voiceTryOrder) {
          const response = await fetch(ttsUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: script,
              voice_id: voiceId,
              output_format: "mp3_44100_128",
              model_id: "eleven_multilingual_v2",
              voice_settings: {
                stability: 0.35,
                similarity_boost: 0.8,
                style: 0.35,
                use_speaker_boost: true,
              },
            }),
          });
          const maybe = (await response.json()) as {
            audio_base64?: string;
            alignment?: { character_start_times_seconds?: number[] };
            normalized_alignment?: { character_start_times_seconds?: number[] };
            error?: unknown;
          };
          if (response.ok && maybe?.audio_base64) {
            data = maybe;
            break;
          }
          lastError = typeof maybe?.error === "string" ? maybe.error : JSON.stringify(maybe?.error || maybe);
        }

        if (!data) {
          throw new Error(lastError || "ElevenLabs TTS failed.");
        }

        // Cache today's audio for the selected voice (replay won't spend credits).
        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({
              audio_base64: data.audio_base64,
              alignment: data.alignment,
              normalized_alignment: data.normalized_alignment,
              createdAtISO: new Date().toISOString(),
            }),
          );
        } catch {
          // If storage is full, we still allow playback; replay just won't be cached.
        }

        cleanupAudioUrl();

        const audioBase64 = String(data.audio_base64 || "");
        if (!audioBase64) throw new Error("No audio returned.");

        const bytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;

        const audioEl = new Audio(url);
        audioEl.playbackRate = selectedSpeed;
        audioRef.current = audioEl;

        // Map sentence start char index -> start time seconds using ElevenLabs alignment.
        const alignment = (data.alignment || data.normalized_alignment) as {
          character_start_times_seconds?: number[];
        } | null;
        const startTimes = alignment?.character_start_times_seconds || [];
        sentenceStartTimesRef.current = sentences.map((s) => startTimes[s.start] ?? 0);

        const updateHighlight = () => {
          const t = audioEl.currentTime;
          const starts = sentenceStartTimesRef.current;
          let idx = 0;
          for (let i = 0; i < starts.length; i += 1) {
            if (t >= starts[i]) idx = i;
            else break;
          }
          setActiveSentenceIndex(Number.isFinite(idx) ? idx : null);
        };

        audioEl.ontimeupdate = updateHighlight;
        audioEl.onplay = () => {
          setIsPlaying(true);
          setIsPaused(false);
        };
        audioEl.onpause = () => {
          if (audioEl.currentTime > 0 && audioEl.currentTime < audioEl.duration) setIsPaused(true);
        };
        audioEl.onended = () => {
          setIsPlaying(false);
          setIsPaused(false);
          setActiveSentenceIndex(null);
        };

        await audioEl.play();
      } catch (e) {
        setFallbackNotice("ElevenLabs voice unavailable — using device voice instead.");
        startWebSpeechFallback();
      }
    })();
  };

  const loadBriefing = (entry: StoredBriefing) => {
    stopPlayback();
    setScript(entry.script);
    setGeneratedAt(entry.generatedAt);
    setError("");
  };

  return (
    <section className="glass-card rounded-3xl p-5 space-y-4 border border-primary/20">
      <div>
        <h2 className="font-display text-2xl text-violet-hover">The Wealth Wire</h2>
        <p className="text-xs text-muted-foreground italic mt-1">Your daily financial briefing by Zara</p>
      </div>

      <button
        onClick={generateBriefing}
        disabled={isLoading}
        className={`w-full rounded-full py-3 px-5 text-sm font-semibold transition-all ${
          isLoading
            ? "bg-primary/80 text-primary-foreground animate-pulse"
            : "bg-primary text-primary-foreground hover:bg-violet-hover"
        }`}
      >
        {isLoading ? "Zara is reading the news..." : "Get today's briefing"}
      </button>

      {isLoading && (
        <div className="space-y-2 py-1">
          <div className="flex justify-center items-end gap-1.5 h-10">
            <span className="w-2 rounded-full bg-primary/70 animate-pulse h-4" />
            <span className="w-2 rounded-full bg-primary animate-pulse h-8 [animation-delay:120ms]" />
            <span className="w-2 rounded-full bg-primary/80 animate-pulse h-6 [animation-delay:220ms]" />
          </div>
          <p className="text-center text-xs text-muted-foreground italic">Zara is on it...</p>
        </div>
      )}

      {!isLoading && !hasScript && (
        <div className="glass-card rounded-2xl p-5 text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Mic className="w-6 h-6 text-violet-hover" />
          </div>
          <p className="text-sm text-muted-foreground italic">
            Zara hasn&apos;t read the news yet today. Tap to get your briefing.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {!isLoading && hasScript && (
        <>
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-violet-hover">Today&apos;s briefing</p>
            <div className="glass-card rounded-2xl p-4 border border-primary/15">
              <div className="text-[15px] leading-[1.8] font-display text-[#999999]">
                {sentences.map((item, index) => (
                  <span
                    key={`${item.start}-${index}`}
                    className={activeSentenceIndex === index ? "text-violet-hover transition-colors" : ""}
                  >
                    {item.sentence}
                  </span>
                ))}
              </div>
              {generatedAt && <p className="text-xs text-muted-foreground mt-4">{formatGeneratedTime(generatedAt)}</p>}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-3 border border-primary/20 flex items-center gap-3">
            <button
              onClick={handlePlayPause}
              className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-violet-hover transition-colors"
              aria-label={isPlaying && !isPaused ? "Pause briefing" : "Play briefing"}
            >
              {isPlaying && !isPaused ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground truncate">The Wealth Wire — {todayLabel}</p>
              {fallbackNotice && <p className="text-[11px] text-muted-foreground mt-0.5">{fallbackNotice}</p>}
            </div>
            <select
              value={selectedVoiceId}
              onChange={(e) => setSelectedVoiceId(e.target.value as (typeof ZARA_ELEVEN_VOICE_IDS)[number])}
              className="bg-card border border-border rounded-full px-2.5 py-1.5 text-xs text-muted-foreground focus:outline-none"
              aria-label="Select voice"
              title="Select voice"
            >
              <option value={ZARA_ELEVEN_VOICE_IDS[0]}>Voice 1 (Male)</option>
              <option value={ZARA_ELEVEN_VOICE_IDS[1]}>Voice 2 (British Female)</option>
              <option value={ZARA_ELEVEN_VOICE_IDS[2]}>Voice 3 (American Female)</option>
            </select>
            <select
              value={selectedSpeed}
              onChange={(e) => setSelectedSpeed(Number(e.target.value))}
              className="bg-card border border-border rounded-full px-2.5 py-1.5 text-xs text-violet-hover focus:outline-none"
            >
              <option value={0.75}>0.75x</option>
              <option value={1}>1x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
            </select>
          </div>
        </>
      )}

      {briefings.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Previous briefings</h3>
          <div className="flex flex-wrap gap-2">
            {briefings.map((entry) => (
              <button
                key={entry.dateKey}
                onClick={() => loadBriefing(entry)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                  generatedAt === entry.generatedAt
                    ? "bg-primary/20 border-primary/40 text-violet-hover"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {format(new Date(`${entry.dateKey}T00:00:00`), "MMM d")}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border pt-1" style={{ borderTopWidth: "0.5px" }}>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Wire</span>
        <Headphones className="w-4 h-4 text-violet-hover" />
      </div>
    </section>
  );
};

const PulseTab = ({ transactions, stats }: PulseTabProps) => {
  const { formatUGX, convertFromUGX } = useCurrency();

  const quickStats = [
    { label: "Total Assets", value: formatUGX(stats.assets) },
    { label: "Total Liabilities", value: formatUGX(stats.liabilities) },
    { label: "Total Income", value: formatUGX(stats.income) },
    { label: "Total Expenses", value: formatUGX(stats.expenses) },
  ];

  return (
    <div className="space-y-6 pt-2">
      <WealthWireCard />

      {/* Net Worth Chart */}
      <Charts transactions={transactions} />

      {/* Quick Stats Row */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {quickStats.map((s) => (
          <div key={s.label} className="flex-shrink-0 px-3 py-2 rounded-full bg-card border border-border">
            <span className="text-[10px] text-muted-foreground mr-1.5">{s.label}</span>
            <span className="text-xs font-semibold text-violet-hover">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Wealth Breakdown */}
      <WealthBreakdown transactions={transactions} />

      {/* Spending & Asset Donuts */}
      <SpendingBreakdown transactions={transactions} />
      <AssetAllocation transactions={transactions} />

      {/* Wealth Analysis */}
      <WealthAnalysis />
    </div>
  );
};

// ─── Wealth Breakdown ────────────────────────────────────────────

const WealthBreakdown = ({ transactions }: { transactions: Transaction[] }) => {
  const { formatUGX, convertFromUGX } = useCurrency();
  const { user } = useAuth();
  const { addTransactions, updateTransaction, deleteTransaction } = useTransactions();

  const [wealthTab, setWealthTab] = useState<"assets" | "liabilities">("assets");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [formDesc, setFormDesc] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCurrency, setFormCurrency] = useState("UGX");
  const [formAccount, setFormAccount] = useState("Cash");
  const [formDate, setFormDate] = useState<Date | undefined>(new Date());

  const assetTxns = useMemo(() => transactions.filter((t) => t.type === "asset"), [transactions]);
  const liabilityTxns = useMemo(() => transactions.filter((t) => t.type === "liability"), [transactions]);

  const totalAssets = useMemo(() => assetTxns.reduce((s, t) => s + t.ugx_amount, 0), [assetTxns]);
  const totalLiabilities = useMemo(() => liabilityTxns.reduce((s, t) => s + t.ugx_amount, 0), [liabilityTxns]);
  const netWorth = totalAssets - totalLiabilities;

  const groupByKey = (txns: Transaction[], keyFn: (t: Transaction) => string) => {
    const map: Record<string, { total: number; items: Transaction[] }> = {};
    txns.forEach((t) => {
      const key = keyFn(t);
      if (!map[key]) map[key] = { total: 0, items: [] };
      map[key].total += t.ugx_amount;
      map[key].items.push(t);
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  };

  const assetGroups = useMemo(() => groupByKey(assetTxns, (t) => t.account || "Other"), [assetTxns]);
  const liabilityGroups = useMemo(() => groupByKey(liabilityTxns, (t) => t.account || t.category || "Other"), [liabilityTxns]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const resetForm = () => {
    setFormDesc("");
    setFormAmount("");
    setFormCurrency("UGX");
    setFormAccount(wealthTab === "assets" ? "Cash" : "Loans");
    setFormDate(new Date());
  };

  const openAdd = () => {
    resetForm();
    setFormAccount(wealthTab === "assets" ? "Cash" : "Loans");
    setShowAddForm(true);
  };

  const handleAdd = () => {
    const amount = parseFloat(formAmount) || 0;
    if (!formDesc || amount <= 0) return;
    addTransactions.mutate([{
      id: crypto.randomUUID(),
      user_id: user!.id,
      description: formDesc,
      amount,
      currency: formCurrency,
      ugx_amount: formCurrency === "UGX" ? amount : amount * 3700,
      type: wealthTab === "assets" ? "asset" : "liability",
      category: wealthTab === "assets" ? "Investments" : "Other",
      account: formAccount,
      date: formDate ? format(formDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
    }]);
    setShowAddForm(false);
  };

  const openEdit = (t: Transaction) => {
    setEditingTx(t);
    setFormDesc(t.description);
    setFormAmount(String(t.amount));
    setFormCurrency(t.currency);
    setFormAccount(t.account);
    setFormDate(new Date(t.date));
  };

  const handleSaveEdit = () => {
    if (!editingTx) return;
    updateTransaction.mutate({
      id: editingTx.id,
      description: formDesc,
      amount: parseFloat(formAmount) || 0,
      currency: formCurrency,
      ugx_amount: formCurrency === "UGX" ? parseFloat(formAmount) || 0 : (parseFloat(formAmount) || 0) * 3700,
      account: formAccount,
      date: formDate ? format(formDate, "yyyy-MM-dd") : editingTx.date,
    });
    setEditingTx(null);
  };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteTransaction.mutate(deletingId);
    setDeletingId(null);
  };

  const currentGroups = wealthTab === "assets" ? assetGroups : liabilityGroups;
  const currentTotal = wealthTab === "assets" ? totalAssets : totalLiabilities;
  const accountOptions = wealthTab === "assets" ? ASSET_ACCOUNTS : LIABILITY_TYPES;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Wealth Breakdown</h3>

      {/* Sub-tabs */}
      <div className="flex gap-2">
        {(["assets", "liabilities"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setWealthTab(tab)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              wealthTab === tab
                ? "bg-primary/15 text-violet-hover border border-primary/30"
                : "text-muted-foreground border border-border hover:text-foreground"
            }`}
            style={{ borderWidth: "0.5px" }}
          >
            {tab === "assets" ? "Assets" : "Liabilities"}
          </button>
        ))}
      </div>

      {/* Groups */}
      <div className="space-y-1">
        {currentGroups.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No {wealthTab} yet. Add your first one below.
          </p>
        )}
        {currentGroups.map(([key, { total, items }]) => (
          <div key={key}>
            <button onClick={() => toggleGroup(key)} className="w-full flex justify-between items-center py-2 hover:bg-card/50 rounded transition-colors">
              <div className="flex items-center gap-1.5">
                {expandedGroups.has(key) ? (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span className="text-sm text-foreground">{key}</span>
              </div>
              <span className={`text-sm font-medium ${wealthTab === "assets" ? "text-violet-hover" : "text-destructive"}`}>
                {formatUGX(total)}
              </span>
            </button>
            {expandedGroups.has(key) && (
              <div className="ml-5 space-y-0">
                {items.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-muted-foreground truncate flex-1 mr-2">{t.description}</span>
                    <span className={`text-xs font-medium mr-2 ${wealthTab === "assets" ? "text-violet-hover" : "text-destructive"}`}>
                      {formatUGX(t.ugx_amount)}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-0.5 rounded hover:bg-card transition-colors">
                          <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border-border">
                        <DropdownMenuItem onClick={() => openEdit(t)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeletingId(t.id)} className="text-destructive">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex justify-between items-center py-2 border-t border-border" style={{ borderTopWidth: "0.5px" }}>
        <span className={`text-sm font-bold ${wealthTab === "assets" ? "text-violet-hover" : "text-destructive"}`}>
          Total {wealthTab === "assets" ? "Assets" : "Liabilities"}
        </span>
        <span className={`text-sm font-bold ${wealthTab === "assets" ? "text-violet-hover" : "text-destructive"}`}>
          {formatUGX(currentTotal)}
        </span>
      </div>

      {/* Add button */}
      <button
        onClick={openAdd}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-primary/10 text-violet-hover text-xs font-medium hover:bg-primary/20 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add {wealthTab === "assets" ? "Asset" : "Liability"}
      </button>

      {/* Net Worth Summary — always visible */}
      <div className="border-t border-border pt-4" style={{ borderTopWidth: "0.5px" }}>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Net Worth</p>
          <p className="text-2xl font-display font-bold text-violet-hover">{formatUGX(netWorth)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">≈ ${Math.round(convertFromUGX(netWorth)).toLocaleString()} USD</p>
        </div>
      </div>

      {/* Add Form Dialog */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="bg-card border-border max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Add {wealthTab === "assets" ? "Asset" : "Liability"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Description</label>
              <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="e.g. Savings account" className="bg-background border-border mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Amount</label>
                <Input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} className="bg-background border-border mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Currency</label>
                <Select value={formCurrency} onValueChange={setFormCurrency}>
                  <SelectTrigger className="bg-background border-border mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {CURRENCY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{wealthTab === "assets" ? "Account" : "Type"}</label>
                <Select value={formAccount} onValueChange={setFormAccount}>
                  <SelectTrigger className="bg-background border-border mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {accountOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-background border-border mt-1", !formDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formDate ? format(formDate, "PP") : "Pick"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
                    <Calendar mode="single" selected={formDate} onSelect={setFormDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddForm(false)} className="border-border">Cancel</Button>
            <Button onClick={handleAdd} className="bg-primary text-primary-foreground hover:bg-violet-hover">Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingTx} onOpenChange={(open) => !open && setEditingTx(null)}>
        <DialogContent className="bg-card border-border max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Description</label>
              <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="bg-background border-border mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Amount</label>
                <Input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} className="bg-background border-border mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Currency</label>
                <Select value={formCurrency} onValueChange={setFormCurrency}>
                  <SelectTrigger className="bg-background border-border mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {CURRENCY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Account</label>
                <Select value={formAccount} onValueChange={setFormAccount}>
                  <SelectTrigger className="bg-background border-border mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {accountOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-background border-border mt-1", !formDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formDate ? format(formDate, "PP") : "Pick"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
                    <Calendar mode="single" selected={formDate} onSelect={setFormDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingTx(null)} className="border-border">Cancel</Button>
            <Button onClick={handleSaveEdit} className="bg-primary text-primary-foreground hover:bg-violet-hover">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent className="bg-card border-border max-w-sm mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ─── Donut Charts ────────────────────────────────────────────────

const DONUT_COLORS = [
  "hsl(263, 83%, 58%)", "hsl(155, 52%, 55%)", "hsl(210, 52%, 55%)",
  "hsl(0, 52%, 55%)", "hsl(40, 60%, 55%)", "hsl(180, 45%, 50%)",
];

const SpendingBreakdown = ({ transactions }: { transactions: Transaction[] }) => {
  const { convertFromUGX } = useCurrency();

  const data = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter((t) => t.type === "expense").forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.ugx_amount;
    });
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({
        name, value: convertFromUGX(value),
        pct: total > 0 ? Math.round((value / total) * 100) : 0,
      }));
  }, [transactions, convertFromUGX]);

  if (data.length === 0) return null;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Spending</h3>
      <div className="flex items-center gap-4">
        <div className="w-32 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55} strokeWidth={0}>
                {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              <span className="text-xs text-foreground flex-1">{d.name}</span>
              <span className="text-xs font-semibold text-foreground">{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const AssetAllocation = ({ transactions }: { transactions: Transaction[] }) => {
  const { convertFromUGX } = useCurrency();

  const data = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter((t) => t.type === "asset").forEach((t) => {
      const bucket = t.account || t.category || "Other";
      map[bucket] = (map[bucket] || 0) + t.ugx_amount;
    });
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({
        name, value: convertFromUGX(value),
        pct: total > 0 ? Math.round((value / total) * 100) : 0,
      }));
  }, [transactions, convertFromUGX]);

  if (data.length === 0) return null;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assets</h3>
      <div className="flex items-center gap-4">
        <div className="w-32 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55} strokeWidth={0}>
                {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              <span className="text-xs text-foreground flex-1">{d.name}</span>
              <span className="text-xs font-semibold text-foreground">{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PulseTab;
