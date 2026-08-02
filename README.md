# WriteHuman - AI Text Humanizer

Transform AI-generated text into natural, human-like writing. Detect AI content and humanize it with advanced tools.

## Features

- **Humanize Text** - Convert AI-generated text into natural, human-like writing
- **AI Detection** - Analyze text to detect AI authorship with confidence scoring
- **Multi-pass Refinement** - Re-humanize text iteratively for better results
- **Customizable Settings** - Adjust readability, purpose, and bypass intensity
- **Document History** - Save and manage your humanized documents
- **Real-time Streaming** - See results as they generate

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI**: shadcn/ui (Radix UI), Tailwind CSS
- **State**: TanStack Query, React Context
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **AI**: OpenRouter API (Claude 3 Haiku)

## Getting Started

### Prerequisites

- Node.js 18+ / Bun
- Supabase account
- OpenRouter API key

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>
cd WriteHuman

# Install dependencies
bun install

# Copy environment variables
cp .env.example .env
# Edit .env with your credentials

# Start development server
bun run dev
```

### Environment Variables

Create a `.env` file with:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
OPENROUTER_API_KEY=your_openrouter_api_key
```

### Supabase Setup

1. Create a new Supabase project
2. Run migrations in `supabase/migrations/`
3. Deploy Edge Functions:
   ```sh
   supabase functions deploy humanize
   supabase functions deploy detect-ai
   ```
4. Set `OPENROUTER_API_KEY` in Supabase Dashboard > Settings > Edge Functions

## Project Structure

```
src/
├── components/       # React components
│   ├── ui/          # shadcn/ui components
│   ├── TextEditor.tsx    # Main editor with humanize/detect
│   ├── DocumentHistory.tsx
│   ├── Header.tsx, HeroSection.tsx, etc.
├── pages/           # Page components
│   ├── Index.tsx    # Landing page
│   ├── Dashboard.tsx      # Authenticated editor
│   ├── Login.tsx, Signup.tsx
├── contexts/        # React contexts (Auth)
├── hooks/           # Custom hooks
├── integrations/    # Supabase client & types
├── lib/             # Utilities
supabase/
├── functions/       # Edge Functions
│   ├── humanize/    # Text humanization
│   └── detect-ai/   # AI detection
└── migrations/      # Database schema
```

## Scripts

```sh
bun run dev       # Start dev server
bun run build     # Production build
bun run lint      # Run ESLint
bun run preview   # Preview production build
```

## Deployment

### Vercel (Frontend)
1. Connect repository to Vercel
2. Add environment variables
3. Deploy

### Supabase (Backend)
1. Link project: `supabase link --project-ref <ref>`
2. Deploy functions: `supabase functions deploy`
3. Set secrets: `supabase secrets set OPENROUTER_API_KEY=<key>`

## License

MIT