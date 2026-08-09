import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://cyhrbwvzuspedwyqnmyj.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_qsiVYI1KV-XGsZreLLj7nQ_KGI_VIPo";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
