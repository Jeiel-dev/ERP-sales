import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pnjhixrpsippndwzgcrz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuamhpeHJwc2lwcG5kd3pnY3J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMTU3NDAsImV4cCI6MjA3OTU5MTc0MH0.Z24QXCvUIiNUjhC6BeOuSROs6fkyFCcL8MJHnzdXzgA';

export const supabase = createClient(supabaseUrl, supabaseKey);
