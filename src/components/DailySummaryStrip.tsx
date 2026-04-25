import { useState, useMemo, useRef, useCallback } from "react";
import { format, subDays, isBefore, startOfDay } from "date-fns";
import { ChevronDown } from "lucide-react";
import { Transaction } from "@/hooks/useTransactions";
import { useCurrency } from "@/contexts/CurrencyContext";

interface DailySummaryStripProps {
  transactions: Transaction[];
}

const MAX_HISTORY_DAYS = 90;

const DailySummaryStrip = ({ transactions }: DailySummaryStripProps) => {
  const { formatUGX } = useCurrency();
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [expanded, setExpanded] = useState(true);
  const touchStartX = useRef<number | null>(null);

  const minDate = useMemo(() => startOfDay(subDays(new Date(), MAX_HISTORY_DAYS)), []);
  const todayDate = useMemo(() => startOfDay(new Date()), []);

  const canGoBack = useMemo(
    () => !isBefore(selectedDate, subDays(minDate, -1)) && selectedDate > minDate,
    [selectedDate, minDate]
  );
  const canGoForward = useMemo(() => selectedDate < todayDate, [selectedDate, todayDate]);

  const goBack = useCallback(() => {
    if (canGoBack) setSelectedDate((d) => subDays(d, 1));
  }, [canGoBack]);

  const goForward = useCallback(() => {
    if (canGoForward) {
      setSelectedDate((d) => {
        const next = new Date(d);
        next.setDate(next.getDate() + 1);
        return next > todayDate ? todayDate : next;
      });
    }
  }, [canGoForward, todayDate]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const diff = e.changedTouches[0].clientX - touchStartX.current;
      touchStartX.current = null;
      if (Math.abs(diff) > 50) (diff > 0 ? goBack : goForward)();
    },
    [goBack, goForward]
  );

  const dateKey = format(selectedDate, "yyyy-MM-dd");

  const { earned, spent, earnedEntries, spentEntries } = useMemo(() => {
    let earned = 0;
    let spent = 0;
    const earnedEntries: Transaction[] = [];
    const spentEntries: Transaction[] = [];
    for (const t of transactions) {
      if (t.date !== dateKey) continue;
      if (t.type === "income") {
        earned += Math.abs(t.ugx_amount);
        earnedEntries.push(t);
      } else if (t.type === "expense") {
        spent += Math.abs(t.ugx_amount);
        spentEntries.push(t);
      }
    }
    return { earned, spent, earnedEntries, spentEntries };
  }, [transactions, dateKey]);

  const net = earned - spent;

  const verdict = useMemo(() => {
    if (earned === 0 && spent === 0) return "Nothing recorded yet today";
    if (net > 0) return "Good day — you earned more than you spent";
    if (net < 0) return "Tough day — spending exceeded income";
    return "Broke even today";
  }, [earned, spent, net]);

  const dateLabel = format(selectedDate, "EEEE, MMMM d").toUpperCase();
  const formatNet = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "") + formatUGX(Math.abs(v));

  const hasEntries = earnedEntries.length > 0 || spentEntries.length > 0;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative select-none"
      style={{ touchAction: "pan-y" }}
    >
      {/* Date with chevrons */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <button
          onClick={goBack}
          disabled={!canGoBack}
          aria-label="Previous day"
          className="text-muted-foreground disabled:opacity-30 px-2 text-base leading-none"
        >
          ‹
        </button>
        <p className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground">
          {dateLabel}
        </p>
        <button
          onClick={goForward}
          disabled={!canGoForward}
          aria-label="Next day"
          className="text-muted-foreground disabled:opacity-30 px-2 text-base leading-none"
        >
          ›
        </button>
      </div>

      {/* Totals row — inline, no wrap */}
      <div className="grid grid-cols-3 gap-3 text-center items-end">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground mb-1">Earned</p>
          <p className="font-display font-bold text-success text-base sm:text-lg whitespace-nowrap overflow-hidden text-ellipsis">
            {formatUGX(earned)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground mb-1">Spent</p>
          <p className="font-display font-bold text-destructive text-base sm:text-lg whitespace-nowrap overflow-hidden text-ellipsis">
            {formatUGX(spent)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground mb-1">Net</p>
          <p
            className={`font-display font-bold text-base sm:text-lg whitespace-nowrap overflow-hidden text-ellipsis ${
              net >= 0 ? "text-success" : "text-destructive"
            }`}
          >
            {formatNet(net)}
          </p>
        </div>
      </div>

      <p className="text-xs italic text-muted-foreground text-center mt-3">{verdict}</p>

      {hasEntries && (
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mx-auto mt-2 flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          {expanded ? "Hide details" : "Show details"}
          <ChevronDown
            className="w-3.5 h-3.5 transition-transform"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>
      )}

      {expanded && hasEntries && (
        <div className="mt-3 overflow-hidden">
          <table className="w-full text-xs">
            <tbody>
              {earnedEntries.map((t) => (
                <EntryRow key={t.id} t={t} accent="text-success" sign="+" formatUGX={formatUGX} />
              ))}
              {spentEntries.map((t) => (
                <EntryRow key={t.id} t={t} accent="text-destructive" sign="−" formatUGX={formatUGX} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const EntryRow = ({
  t,
  accent,
  sign,
  formatUGX,
}: {
  t: Transaction;
  accent: string;
  sign: string;
  formatUGX: (n: number) => string;
}) => (
  <tr className="border-b border-border/60" style={{ borderBottomWidth: "0.5px" }}>
    <td className="py-2 pr-2 align-top min-w-0">
      <p className="text-foreground truncate text-[12px]">{t.description}</p>
      <p className="text-[10px] text-muted-foreground">{t.category}</p>
    </td>
    <td className={`py-2 pl-2 text-right align-top font-medium whitespace-nowrap ${accent}`}>
      {sign}
      {formatUGX(Math.abs(t.ugx_amount))}
    </td>
  </tr>
);

export default DailySummaryStrip;
