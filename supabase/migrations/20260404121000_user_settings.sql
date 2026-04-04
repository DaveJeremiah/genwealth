create table if not exists user_settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique,
  nickname text,
  default_currency text default 'UGX',
  greeting_style text default 'casual',
  profile_accent text default '#7C3AED',
  financial_year_start integer default 1,
  default_account text default 'Bank',
  show_wealth_score boolean default true,
  fourth_stat_card text default 'Total Assets',
  briefing_reminder boolean default false,
  briefing_reminder_time text default '08:00',
  auto_generate_briefing boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table user_settings enable row level security;

-- Create RLS policies
create policy "Users can view own settings" on user_settings
  for select using (auth.uid() = user_id);
  
create policy "Users can insert own settings" on user_settings
  for insert with check (auth.uid() = user_id);
  
create policy "Users can update own settings" on user_settings
  for update using (auth.uid() = user_id);
