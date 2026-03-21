# Mortgage AI Calc — Smart Mortgage Analyser

## Quick Deploy (5 minutes)

### Step 1: Push to GitHub

1. Create a new repository on [github.com/new](https://github.com/new) called `mortgageiq`
2. Open your terminal and run:

```bash
cd mortgageiq
git init
git add .
git commit -m "Initial commit — Mortgage AI Calc v1"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mortgageiq.git
git push -u origin main
```

### Step 2: Deploy on Vercel (free)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New Project"**
3. Import your `mortgageiq` repository
4. Click **Deploy** — that's it!

Your site will be live at `https://mortgageiq.vercel.app` (or similar).

### Step 3: Custom domain (optional)

In Vercel dashboard → Settings → Domains → Add `mortgageiq.co.uk` (or whatever domain you purchase).

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
mortgageiq/
├── app/
│   ├── layout.jsx      # Root layout with SEO metadata
│   ├── page.jsx         # Main app (landing, input, results)
│   └── globals.css      # Base styles
├── package.json
├── next.config.js
└── README.md
```

## Next Steps

- **Statement Parsing**: Add an API route (`app/api/parse/route.js`) that processes uploaded PDFs and extracts mortgage details.
- **User Accounts**: Add NextAuth.js for sign-in / save analyses
- **Database**: Add Supabase or PlanetScale to persist user data
- **Payments**: Add Stripe for premium features
- **Analytics**: Add Vercel Analytics or PostHog
