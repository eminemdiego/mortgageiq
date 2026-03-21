# Supabase Setup Guide

## Step 1: Create a Supabase Project

1. Go to https://supabase.com
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - **Name**: mortgageiq
   - **Database Password**: (create a strong password and save it)
   - **Region**: Select the region closest to you
5. Wait for the project to initialize (this takes a few minutes)

## Step 2: Get Your Credentials

Once your project is created:

1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** (NEXT_PUBLIC_SUPABASE_URL)
   - **Service Role Key** (SUPABASE_SERVICE_KEY) - keep this secret!

Add these to your `.env.local` file:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
```

## Step 3: Create Database Tables

Go to **SQL Editor** in your Supabase dashboard and run these SQL commands:

### Create Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  password_hash VARCHAR(255),
  auth_provider VARCHAR(50),
  auth_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
```

### Create Analyses Table

```sql
CREATE TABLE analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  outstanding_balance DECIMAL(15, 2),
  monthly_payment DECIMAL(15, 2),
  interest_rate DECIMAL(10, 4),
  remaining_years DECIMAL(10, 2),
  mortgage_type VARCHAR(50),
  rate_type VARCHAR(100),
  bank VARCHAR(255),
  analysis_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analyses_user_id ON analyses(user_id);
CREATE INDEX idx_analyses_created_at ON analyses(created_at);
```

## Step 4: Set Row-Level Security (RLS)

RLS ensures users can only see their own data:

### For Users Table

```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON users
  FOR SELECT
  USING (auth.uid()::text = id::text);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  USING (auth.uid()::text = id::text);
```

### For Analyses Table

```sql
-- Enable RLS
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- Users can view their own analyses
CREATE POLICY "Users can view own analyses"
  ON analyses
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can create analyses
CREATE POLICY "Users can create analyses"
  ON analyses
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own analyses
CREATE POLICY "Users can update own analyses"
  ON analyses
  FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own analyses
CREATE POLICY "Users can delete own analyses"
  ON analyses
  FOR DELETE
  USING (user_id = auth.uid());
```

## Step 5: Google OAuth Setup (Optional)

To enable Google sign-in:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable the "Google+ API"
4. Create OAuth 2.0 credentials:
   - Type: Web application
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (for development)
     - `https://your-domain.com/api/auth/callback/google` (for production)
5. Copy the **Client ID** and **Client Secret**

Add to `.env.local`:
```
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

## Step 6: NextAuth Secret

Generate a NextAuth secret:

```bash
openssl rand -base64 32
```

Add to `.env.local`:
```
NEXTAUTH_SECRET=your_generated_secret_here
NEXTAUTH_URL=http://localhost:3000
```

For production, update `NEXTAUTH_URL` to your deployed domain.

## Your .env.local should now look like:

```
ANTHROPIC_API_KEY=your_api_key_here
NEXTAUTH_SECRET=your_secret_here
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

## Verify Setup

Test by running:
```bash
npm run dev
```

Visit `http://localhost:3000` and try signing up with email/password or Google OAuth.
