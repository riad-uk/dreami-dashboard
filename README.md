# Dreami Dashboard

A business management platform with multi-user authentication and YouCanBook.me (YCBM) integration.

## Features

- Multi-user authentication with Google OAuth (free)
- Protected dashboard with role-based access
- YCBM bookings integration with date filtering
- Modern, responsive UI with Tailwind CSS

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the `.env.example` file to `.env.local`:

```bash
cp .env.example .env.local
```

Then update the following variables in `.env.local`:

#### Authentication

1. Generate a secret key:
   ```bash
   openssl rand -base64 32
   ```
   Add this as `AUTH_SECRET`

2. Set your app URL:
   ```
   NEXTAUTH_URL=http://localhost:3000
   ```

#### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure OAuth consent screen if prompted
6. For Application type, select "Web application"
7. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - For production: `https://yourdomain.com/api/auth/callback/google`
8. Copy the Client ID and Client Secret to your `.env.local`:
   ```
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ```

#### YCBM API Setup

1. Log in to your [YouCanBook.me](https://youcanbook.me) account
2. Go to Settings → API & Integrations
3. Generate an API key
4. Copy your API key and User ID to `.env.local`:
   ```
   YCBM_API_KEY=your-ycbm-api-key
   YCBM_USER_ID=your-ycbm-user-id
   ```

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/          # NextAuth.js routes
│   │   └── ycbm/          # YCBM API integration
│   ├── auth/
│   │   └── signin/        # Sign-in page
│   ├── dashboard/         # Protected dashboard pages
│   │   ├── layout.tsx     # Dashboard layout with nav
│   │   ├── page.tsx       # Dashboard home
│   │   └── ycbm/          # YCBM bookings page
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
├── auth.ts                # NextAuth.js configuration
├── middleware.ts          # Route protection middleware
└── types/
    └── ycbm.ts            # TypeScript types for YCBM data
```

## Features in Detail

### Authentication
- Users sign in with their Google account (free, no cost)
- Protected routes automatically redirect unauthenticated users
- Session management handled by NextAuth.js

### YCBM Bookings
- View all bookings from your YouCanBook.me account
- Filter bookings by specific date
- Display customer information, booking times, and details
- Real-time data fetching from YCBM API

## Adding More Features

The dashboard is designed to be extensible. To add new features:

1. Create a new page in `/src/app/dashboard/[feature-name]/page.tsx`
2. Add a link to the navigation in `/src/app/dashboard/layout.tsx`
3. Create API routes if needed in `/src/app/api/[feature-name]/`
4. Add any necessary types in `/src/types/`

## Build for Production

```bash
npm run build
npm start
```

## Technologies Used

- Next.js 15 (App Router)
- React 19
- NextAuth.js v5 (Auth.js)
- TypeScript
- Tailwind CSS v4
- date-fns
