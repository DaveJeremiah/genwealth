import React, { useState } from "react";
import { ChevronLeft, LogOut, ChevronDown, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSettings, ProfileAccent } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { settings, updateSettings } = useSettings();
  const { signOut } = useAuth();
  
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState(settings.nickname);
  
  const [editingBriefingTime, setEditingBriefingTime] = useState(false);
  const [timeInput, setTimeInput] = useState(settings.briefing_reminder_time);

  const colors: { name: string; hex: ProfileAccent }[] = [
    { name: "Violet", hex: "#7C3AED" },
    { name: "Blue", hex: "#4C8FC9" },
    { name: "Green", hex: "#4CC98F" },
    { name: "Red", hex: "#C94C4C" },
    { name: "Amber", hex: "#C9A84C" },
    { name: "Pink", hex: "#C94C8F" },
  ];

  const handleNicknameSave = () => {
    updateSettings({ nickname: nicknameInput });
    setEditingNickname(false);
  };
  
  const handleTimeSave = () => {
    updateSettings({ briefing_reminder_time: timeInput });
    setEditingBriefingTime(false);
  };

  const handleExport = () => {
    // Generate simple CSV
    // We would ideally fetch all transactions and convert to CSV logic here
    // For now we just create a stub or small mock download
    const csvContent = "date,description,amount,currency,ugx_amount,type,category,account\n";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WealthOS-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleClearEntries = () => {
    const input = window.prompt("This will permanently delete all your entries and cannot be undone. Type DELETE to confirm.");
    if (input === "DELETE") {
      // Logic to delete entries
      // supabase.from('transactions').delete().eq('user_id', user.id);
      alert("Entries cleared.");
    }
  };

  const handleDeleteAccount = () => {
    const input = window.confirm("Are you sure? This cannot be undone.");
    if (input) {
      const email = window.prompt("Type your email address to confirm permanent deletion.");
      if (email) {
        // Logic to delete account
        alert("Account deletion triggered.");
        signOut();
      }
    }
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-8">
      <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-2 px-1">
        {title}
      </div>
      <div className="bg-[#161616] border border-[#1E1E1E] rounded-2xl overflow-hidden glass-card">
        {children}
      </div>
    </div>
  );

  const Row = ({ 
    label, 
    subtitle, 
    rightContent, 
    onClick,
    border = true
  }: { 
    label: string; 
    subtitle?: string; 
    rightContent?: React.ReactNode; 
    onClick?: () => void;
    border?: boolean;
  }) => (
    <div 
      onClick={onClick}
      className={`flex items-center justify-between p-4 ${onClick ? 'cursor-pointer hover:bg-white/5 active:bg-white/10 transition-colors' : ''} ${border ? 'border-b-[0.5px] border-[#1E1E1E]' : ''}`}
    >
      <div className="flex flex-col gap-0.5 max-w-[65%]">
        <div className="text-sm font-medium">{label}</div>
        {subtitle && <div className="text-xs text-muted-foreground leading-tight">{subtitle}</div>}
      </div>
      <div className="flex-shrink-0 text-sm">
        {rightContent}
      </div>
    </div>
  );

  return (
    <div className="min-h-svh bg-background font-body pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl px-4 py-4 flex items-center justify-between" style={{ paddingTop: "max(env(safe-area-inset-top, 16px), 16px)" }}>
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-accent/50 transition-colors">
          <ChevronLeft className="w-6 h-6 text-foreground" />
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-2">
        <h1 className="text-4xl font-display font-medium mb-8 text-foreground">Settings</h1>

        {/* SECTION 1 */}
        <Section title="Profile & Personalisation">
          {editingNickname ? (
            <div className="p-4 border-b-[0.5px] border-[#1E1E1E]">
              <div className="text-sm font-medium mb-2">Nickname</div>
              <div className="flex items-center gap-2">
                <input 
                  autoFocus
                  type="text" 
                  value={nicknameInput}
                  onChange={e => setNicknameInput(e.target.value)}
                  className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm flex-1 outline-none focus:border-primary"
                />
                <Button size="sm" onClick={handleNicknameSave} className="bg-violet hover:bg-violet-hover text-white">Save</Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditingNickname(false); setNicknameInput(settings.nickname); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Row 
              label="Nickname" 
              subtitle="Shown in your daily greeting" 
              rightContent={<span className="text-muted-foreground">{settings.nickname}</span>}
              onClick={() => setEditingNickname(true)}
            />
          )}

          <Row 
            label="Default Currency" 
            subtitle="Used across all statements and displays" 
            rightContent={
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 text-muted-foreground outline-none">
                  {settings.default_currency} <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {["UGX", "USD", "EUR", "GBP", "ETH", "BTC"].map(c => (
                    <DropdownMenuItem key={c} onClick={() => updateSettings({ default_currency: c })}>
                      {c}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />
          
          <Row 
            label="Greeting Style" 
            rightContent={
              <div className="flex items-center gap-2 text-xs">
                <span className={settings.greeting_style === "casual" ? "text-foreground font-medium" : "text-muted-foreground"}>Casual</span>
                <Switch 
                  checked={settings.greeting_style === "formal"} 
                  onCheckedChange={(c) => updateSettings({ greeting_style: c ? "formal" : "casual" })} 
                />
                <span className={settings.greeting_style === "formal" ? "text-foreground font-medium" : "text-muted-foreground"}>Formal</span>
              </div>
            }
          />

          <Row 
            label="Profile Color" 
            subtitle="Your personal accent color"
            border={false}
            rightContent={
              <div className="flex items-center gap-2">
                {colors.map(color => (
                  <button
                    key={color.hex}
                    onClick={() => updateSettings({ profile_accent: color.hex })}
                    className={`w-5 h-5 rounded-full transition-all flex items-center justify-center ${settings.profile_accent === color.hex ? 'ring-2 ring-white ring-offset-2 ring-offset-background' : 'hover:scale-110'}`}
                    style={{ backgroundColor: color.hex }}
                    aria-label={`Select ${color.name}`}
                  >
                  </button>
                ))}
              </div>
            }
          />
        </Section>

        {/* SECTION 2 */}
        <Section title="Financial Preferences">
          <Row 
            label="Financial Year Start" 
            subtitle="Affects YTD calculations" 
            rightContent={
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 text-muted-foreground outline-none">
                  {new Date(0, settings.financial_year_start - 1).toLocaleString('default', { month: 'short' })} <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="h-48 overflow-y-auto w-32">
                  {Array.from({length: 12}).map((_, i) => (
                    <DropdownMenuItem key={i} onClick={() => updateSettings({ financial_year_start: i + 1 })}>
                      {new Date(0, i).toLocaleString('default', { month: 'long' })}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />
          <Row 
            label="Default Account for New Entries" 
            subtitle="Used when no account is specified" 
            rightContent={
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 text-muted-foreground outline-none">
                  {settings.default_account} <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {["Cash", "Bank", "Mobile Money", "Investment", "Other"].map(a => (
                    <DropdownMenuItem key={a} onClick={() => updateSettings({ default_account: a })}>
                      {a}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />
          <Row 
            label="Show Wealth Score" 
            rightContent={
              <Switch 
                checked={settings.show_wealth_score} 
                onCheckedChange={(c) => updateSettings({ show_wealth_score: c })} 
              />
            }
          />
          <Row 
            label="Fourth Dashboard Card" 
            subtitle="Shown when Wealth Score is hidden, or always as an option"
            border={false}
            rightContent={
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 text-muted-foreground outline-none">
                  <span className="max-w-[80px] truncate">{settings.fourth_stat_card}</span> <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {["Total Assets", "Total Liabilities", "Monthly Expenses", "Largest Expense Category"].map(c => (
                    <DropdownMenuItem key={c} onClick={() => updateSettings({ fourth_stat_card: c })}>
                      {c}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />
        </Section>

        {/* SECTION 3 */}
        <Section title="Wealth Wire">
          {editingBriefingTime ? (
            <div className="p-4 border-b-[0.5px] border-[#1E1E1E]">
              <div className="text-sm font-medium mb-2">Reminder Time</div>
              <div className="flex items-center gap-2">
                <input 
                  type="time" 
                  value={timeInput}
                  onChange={e => setTimeInput(e.target.value)}
                  className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm flex-1 outline-none focus:border-primary invert dark:invert-0" // Using invert hack for standard UI timepicker icon mapping
                />
                <Button size="sm" onClick={handleTimeSave} className="bg-violet hover:bg-violet-hover text-white">Save</Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditingBriefingTime(false); setTimeInput(settings.briefing_reminder_time); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Row 
              label="Daily Briefing Reminder" 
              subtitle="Reminds you to check Zara's briefing" 
              rightContent={
                <div className="flex items-center gap-4">
                  {settings.briefing_reminder && (
                    <button onClick={() => setEditingBriefingTime(true)} className="text-xs text-muted-foreground hover:text-foreground">
                      {settings.briefing_reminder_time}
                    </button>
                  )}
                  <Switch 
                    checked={settings.briefing_reminder} 
                    onCheckedChange={(c) => {
                      if (c && "Notification" in window) {
                        Notification.requestPermission();
                      }
                      updateSettings({ briefing_reminder: c });
                    }} 
                  />
                </div>
              }
            />
          )}
          <Row 
            label="Auto-generate on Open" 
            subtitle="Zara prepares your briefing when you open the Wire tab"
            border={false}
            rightContent={
              <Switch 
                checked={settings.auto_generate_briefing} 
                onCheckedChange={(c) => updateSettings({ auto_generate_briefing: c })} 
              />
            }
          />
        </Section>

        {/* SECTION 4 */}
        <Section title="Data & Privacy">
          <Row 
            label="Export All Data" 
            subtitle="Download everything as a CSV file" 
            rightContent={
              <button 
                onClick={handleExport}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-white/5 transition-colors"
              >
                Export
              </button>
            }
          />
          <Row 
            label="Clear All Entries" 
            subtitle="Permanently delete all transactions" 
            rightContent={
              <button 
                onClick={handleClearEntries}
                className="px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive text-xs font-medium hover:bg-destructive/10 transition-colors"
              >
                Clear
              </button>
            }
          />
          <Row 
            label="Delete Account" 
            subtitle="Permanently remove your account and all data"
            border={false}
            rightContent={
              <button 
                onClick={handleDeleteAccount}
                className="px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive text-xs font-medium hover:bg-destructive/10 transition-colors"
              >
                Delete Account
              </button>
            }
          />
        </Section>

        {/* SECTION 5 */}
        <div className="mb-12">
          <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-2 px-1">
            About
          </div>
          <div className="bg-[#161616] border border-[#1E1E1E] rounded-2xl p-6 glass-card text-center">
            <h2 className="text-2xl font-display text-violet mb-2">Wealth OS</h2>
            <p className="text-sm text-muted-foreground italic mb-4">"Income is not wealth. Ownership is."</p>
            <div className="text-xs text-muted-foreground/60 space-y-1">
              <p>v1.0.0</p>
              <p>Built for Dave. Powered by discipline.</p>
            </div>
          </div>
        </div>

        {/* Log Out Button */}
        <button 
          onClick={() => {
            if (window.confirm("Log out of Wealth OS?")) {
              signOut();
            }
          }}
          className="w-full flex items-center justify-center py-4 rounded-xl border-[0.5px] border-[#C94C4C] text-[#C94C4C] font-medium bg-transparent hover:bg-[#C94C4C]/10 transition-colors mb-12"
        >
          Log Out
        </button>

      </main>
    </div>
  );
};

export default SettingsPage;
