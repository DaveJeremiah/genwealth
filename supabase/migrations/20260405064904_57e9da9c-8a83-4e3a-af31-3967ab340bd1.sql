CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nickname TEXT NOT NULL DEFAULT '',
  default_currency TEXT NOT NULL DEFAULT 'UGX',
  greeting_style TEXT NOT NULL DEFAULT 'casual',
  profile_accent TEXT NOT NULL DEFAULT '#7C3AED',
  financial_year_start INTEGER NOT NULL DEFAULT 1,
  default_account TEXT NOT NULL DEFAULT 'Bank',
  show_wealth_score BOOLEAN NOT NULL DEFAULT true,
  fourth_stat_card TEXT NOT NULL DEFAULT 'Total Assets',
  briefing_reminder BOOLEAN NOT NULL DEFAULT false,
  briefing_reminder_time TEXT NOT NULL DEFAULT '08:00',
  auto_generate_briefing BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings" ON public.user_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own settings" ON public.user_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own settings" ON public.user_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own settings" ON public.user_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);