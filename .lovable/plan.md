

## Plan: Four Targeted Changes

### 1. Full-Screen Entries Page with "See all" Link

**New file: `src/pages/EntriesPage.tsx`**
- Full-screen page with a back arrow (ArrowLeft) top-left that navigates back to `/`
- Month selector at top: left/right chevron arrows, center shows "March 2026" etc.
- Two rows of filter pills:
  - Row 1: Type (single-select): All, Income, Expense, Transfer, Asset, Liability
  - Row 2: Category (horizontally scrollable, multi-select): All + 15 categories
- Filtered transaction list: emoji icon, bold description, date/category subtitle, original amount + currency top-right, UGX equivalent muted below it. Amount colored by type.
- Three-dot menu (MoreVertical icon) on each row opening a DropdownMenu with Edit and Delete.
- **Edit**: Opens a Dialog/sheet with pre-filled form (Description, Amount, Currency dropdown, Type dropdown, Category dropdown, Account dropdown, Date picker). Save calls `updateTransaction`, Cancel dismisses.
- **Delete**: AlertDialog confirmation. Confirmed calls `deleteTransaction`.
- Summary row at bottom: total income, total expenses, net for selected month.

**Edit `src/components/HomeTab.tsx`**
- Add a "See all" violet text link below the RecentEntries list that navigates to `/entries` via `useNavigate`.

**Edit `src/App.tsx`**
- Add route: `<Route path="/entries" element={<EntriesPage />} />`

**Edit `src/pages/Index.tsx`**
- Pass `transactions` and relevant mutations down or let EntriesPage use `useTransactions` directly (it already can via the hook).

### 2. P&L Collapsible Category Headers

**Edit `src/components/FinancialStatements.tsx`**
- In the P&L section, replace flat category rows with collapsible sections.
- Track `expandedCategories` state (a Set of category names).
- Each category header row shows category name + chevron + category total. Clicking toggles expansion.
- When expanded, show individual transactions under that category (indented, muted style, description left, amount right).
- All categories collapsed by default.
- Total Income, Total Expenses, Net Profit/Loss rows remain always visible at bottom.
- Need to pass the raw filtered transactions into the P&L computation (already available via `filtered`), and group them by category to show individual rows.

### 3. Wealth Breakdown Section on Pulse Tab

**Edit `src/components/PulseTab.tsx`**
- Add a new `WealthBreakdown` component inserted between Quick Stats and Spending Breakdown.
- Two sub-tabs: "Assets" and "Liabilities" (pill-style toggle).
- **Assets sub-tab**: Groups asset transactions by account (Cash, Bank, Investments, Crypto, Property). Each account is a collapsible header with total. Individual entries underneath with description, amount, three-dot menu (Edit/Delete — same modal pattern as Entries page). "Total Assets" row at bottom. "Add Asset" button opens a form dialog (Description, Amount, Currency, Account dropdown, Date picker) that calls `addTransactions`.
- **Liabilities sub-tab**: Same structure, grouped by account/category (Loans, Mortgages, Credit Cards, etc.). "Total Liabilities" at bottom. "Add Liability" button with form.
- Below both sub-tabs: always-visible Net Worth summary row (Total Assets − Total Liabilities) in large Playfair Display serif, violet, with USD equivalent.
- The existing net worth chart (`Charts`) stays below this section.

**Edit `src/components/HomeTab.tsx`**
- Remove any net worth input forms if present (currently Home tab only displays StatsCards which is display-only, so likely no changes needed here — the Net Worth card in StatsCards is already display-only).

**Note**: The existing `NetWorthTracker.tsx` component with its full input forms will no longer be rendered from the Home tab. Its functionality (adding assets/liabilities, saving snapshots) moves into the new `WealthBreakdown` component on Pulse. The `NetWorthTracker` component can be removed or kept unused.

### 4. No Other Changes

Pill input, AI assistant, currency toggle, offline mode, sync logic, tab navigation, Balance Sheet, Cash Flow statement — all untouched.

---

### Technical Details

**Files created:**
- `src/pages/EntriesPage.tsx`

**Files modified:**
- `src/App.tsx` — add `/entries` route
- `src/components/HomeTab.tsx` — add "See all" link with navigation
- `src/components/FinancialStatements.tsx` — P&L collapsible categories with individual transaction rows
- `src/components/PulseTab.tsx` — add WealthBreakdown section with Assets/Liabilities sub-tabs, add/edit/delete, net worth summary

**Dependencies used (already installed):**
- `lucide-react` (ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, MoreVertical)
- `date-fns` for month navigation
- Shadcn UI: Dialog, DropdownMenu, AlertDialog, Calendar, Popover, Select, Input, Button
- `useTransactions` hook for all CRUD operations
- `useCurrency` for formatting

