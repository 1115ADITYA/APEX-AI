# Supabase Setup Guide

## How the Authentication Works

The signup flow is:
1. **Email** → User enters their email address
2. **Verify** → Supabase sends a 6-digit OTP code to the email. User enters the code.
3. **Password** → After email is verified, user creates a secure password.
4. **Done** → Account is created and user is redirected to the dashboard.

Returning users simply enter their email + password to log in.

**Everything runs through Supabase (free tier)**. No other third-party verification service is needed.

---

## Setup Steps

### 1. Create a Supabase Project
1. Go to [database.new](https://database.new) and create a new project.
2. Wait for the database to provision.

### 2. Get API Credentials
1. In your Supabase dashboard, go to **Project Settings** (gear icon).
2. Navigate to **API**.
3. Copy the **Project URL** and the **anon public key**.
4. Paste them into your `.env` file:
   ```
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   ```

### 3. Enable Email OTP
1. Go to **Authentication > Providers > Email**.
2. Ensure **Enable Email provider** is ON.
3. Ensure **Confirm email** is ON.
4. **Note:** Supabase free tier limits you to **3 emails per hour** without a custom SMTP. If you hit the limit, wait or add a free SMTP provider like [Resend](https://resend.com) in **Authentication > SMTP Settings**.

### 4. Testing Locally
Since the app uses a Vercel serverless function (`/api/env`) to securely load your keys:
```bash
npm i -g vercel
vercel dev
```
This reads your `.env` file and serves the app locally with the API route working.

### 5. Deploying to Vercel
1. Push your code to GitHub (the `.env` file is excluded via `.gitignore`).
2. Import the repo in [vercel.com](https://vercel.com).
3. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` as **Environment Variables** in the Vercel project settings.
4. Deploy!

### 6. Database Setup (user_profiles)
Run the following SQL in your Supabase SQL Editor to create the table and enable Row Level Security (RLS) so that users can only access their own profile data:

```sql
-- Create the table
create table public.user_profiles (
  "userId" uuid not null references auth.users(id) on delete cascade,
  age integer not null,
  gender text not null,
  weight numeric not null,
  height numeric not null,
  goal text not null,
  experience text not null,
  "onboardingCompleted" boolean default false,
  "createdAt" timestamp with time zone default timezone('utc'::text, now()) not null,
  "updatedAt" timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key ("userId")
);

-- Enable RLS
alter table public.user_profiles enable row level security;

-- Create Policies
create policy "Users can insert their own profile."
  on public.user_profiles for insert
  with check ( auth.uid() = "userId" );

create policy "Users can view own profile."
  on public.user_profiles for select
  using ( auth.uid() = "userId" );

create policy "Users can update own profile."
  on public.user_profiles for update
  using ( auth.uid() = "userId" );
```
