-- Auth fields for users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text unique;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean default false;

-- Bootstrap instructions (run after creating auth user in Supabase Dashboard):
-- 1. Supabase Dashboard → Authentication → Users → "Add user" (your email + password)
-- 2. Run the UPDATE below, replacing the email and the id with the user you want as admin
-- UPDATE users SET email = 'admin@ejemplo.com', is_admin = true WHERE id = 'u1';
