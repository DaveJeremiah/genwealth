import { useState, useMemo, useRef, useCallback } from "react";
import { format, subDays, isToday, isBefore, startOfDay } from "date-fns";
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
  const [expanded, setExpanded] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const minDate = useMemo(() => startOfDay(subDays(new Date(), MAX_HISTORY_DAYS)), []);
  const todayDate = useMemo(() => startOfDay(new Date()), []);

  const canGoBack = useMemo(
    () => !isBefore(selectedDate, subDays(minDate, -1)) && selectedDate > minDate,
    [selectedDate, minDate]
  );
  const canGoForward = useMemo(
    () => selectedDate < todayDate,
    [selectedDate, todayDate]
  );

  const goBack = useCallback(() => {
    if (canGoBack) {
      setSelectedDate((d) => subDays(d, 1));
    }
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

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const diff = e.changedTouches[0].clientX - touchStartX.current;
      touchStartX.current = null;
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          // Swiped right → previous day
          goBack();
        } else {
          // Swiped left → next day
          goForward();
        }
      }
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

  const formatNet = (value: number) => {
    const prefix = value > 0 ? "+" : value < 0 ? "−" : "";
    return prefix + formatUGX(Math.abs(value));
  };

  return (
    <div
      ref={cardRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        background: "#161616",
        borderRadius: 16,
        border: "0.5px solid #1E1E1E",
        padding: 16,
        position: "relative",
        userSelect: "none",
        touchAction: "pan-y",
        overflow: "hidden",
      }}
    >
      {/* Left chevron */}
      {canGoBack && (
        <button
          onClick={goBack}
          aria-label="Previous day"
          style={{
            position: "absolute",
            left: 4,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            color: "#555",
            fontSize: 18,
            cursor: "pointer",
            padding: "8px 4px",
            lineHeight: 1,
            zIndex: 2,
          }}
        >
          ‹
        </button>
      )}

      {/* Right chevron */}
      {canGoForward && (
        <button
          onClick={goForward}
          aria-label="Next day"
          style={{
            position: "absolute",
            right: 4,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            color: "#555",
            fontSize: 18,
            cursor: "pointer",
            padding: "8px 4px",
            lineHeight: 1,
            zIndex: 2,
          }}
        >
          ›
        </button>
      )}

      {/* Date */}
      <p
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: "#666",
          marginBottom: 12,
          textAlign: "center",
        }}
      >
        {dateLabel}
      </p>

      {/* Three columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          textAlign: "center",
        }}
      >
        {/* Earned */}
        <div>
          <p style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Earned</p>
          <p
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 18,
              fontWeight: 700,
              color: "#4CC98F",
              lineHeight: 1.2,
              wordBreak: "break-all",
            }}
          >
            {formatUGX(earned)}
          </p>
        </div>

        {/* Spent */}
        <div>
          <p style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Spent</p>
          <p
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 18,
              fontWeight: 700,
              color: "#C94C4C",
              lineHeight: 1.2,
              wordBreak: "break-all",
            }}
          >
            {formatUGX(spent)}
          </p>
        </div>

        {/* Net */}
        <div>
          <p style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Net</p>
          <p
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 18,
              fontWeight: 700,
              color: net >= 0 ? "#4CC98F" : "#C94C4C",
              lineHeight: 1.2,
              wordBreak: "break-all",
            }}
          >
            {formatNet(net)}
          </p>
        </div>
      </div>

      {/* Verdict */}
      <p
        style={{
          fontSize: 12,
          fontStyle: "italic",
          color: "#555",
          textAlign: "center",
          marginTop: 12,
        }}
      >
        {verdict}
      </p>

      {/* Collapsible toggle */}
      {(earnedEntries.length > 0 || spentEntries.length > 0) && (
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Hide details" : "Show details"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            margin: "10px auto 0",
            background: "none",
            border: "none",
            color: "#888",
            fontSize: 11,
            fontWeight: 500,
            cursor: "pointer",
            padding: "4px 8px",
          }}
        >
          {expanded ? "Hide details" : "Show details"}
          <ChevronDown
            className="w-3.5 h-3.5"
            style={{
              transition: "transform 200ms ease",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </button>
      )}

      {/* Collapsible content — entries card */}
      {expanded && (earnedEntries.length > 0 || spentEntries.length > 0) && (
        <div
          style={{
            marginTop: 10,
            background: "#0F0F0F",
            border: "0.5px solid #1E1E1E",
            borderRadius: 12,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {earnedEntries.length > 0 && (
            <EntryGroup
              title="Earned"
              accent="#4CC98F"
              entries={earnedEntries}
              formatUGX={formatUGX}
            />
          )}
          {spentEntries.length > 0 && (
            <EntryGroup
              title="Spent"
              accent="#C94C4C"
              entries={spentEntries}
              formatUGX={formatUGX}
              negative
            />
          )}
        </div>
      )}
    </div>
  );
};

const EntryGroup = ({
  title,
  accent,
  entries,
  formatUGX,
  negative,
}: {
  title: string;
  accent: string;
  entries: Transaction[];
  formatUGX: (n: number) => string;
  negative?: boolean;
}) => (
  <div>
    <p
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.08em",
        color: accent,
        marginBottom: 6,
        textTransform: "uppercase",
      }}
    >
      {title}
    </p>
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {entries.map((t) => (
        <div
          key={t.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              style={{
                fontSize: 12,
                color: "#D0D0D0",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {t.description}
            </p>
            <p style={{ fontSize: 10, color: "#666" }}>{t.category}</p>
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: accent,
              flexShrink: 0,
            }}
          >
            {negative ? "−" : "+"}
            {formatUGX(Math.abs(t.ugx_amount))}
          </span>
        </div>
      ))}
    </div>
  </div>
);

export default DailySummaryStrip;
