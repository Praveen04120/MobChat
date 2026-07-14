# MobChat

MobChat is a simple real-time temporary group chatting application built for mobile-first user experience.

## Tech Stack
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Firebase Realtime Database
- Firebase Authentication (Anonymous)
- Vercel (Deployment)

## Local Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Copy `.env.example` to `.env.local` and add your Firebase configuration details:
   ```bash
   cp .env.example .env.local
   ```
   
   Ensure your `.env.local` includes the following:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
   NEXT_PUBLIC_FIREBASE_DATABASE_URL=
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
   NEXT_PUBLIC_FIREBASE_APP_ID=
   ```

3. **Firebase Requirements:**
   You must have a Firebase project with the following services enabled:
   - **Authentication:** Enable "Anonymous" sign-in provider.
   - **Realtime Database:** Create the database.
   
   **Database Rules:**
   Go to the Rules tab in your Firebase Realtime Database and apply the rules located in `database.rules.json` to properly secure your data.

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deployment

Deploy this project on [Vercel](https://vercel.com/new). Don't forget to add your `.env.local` variables into your Vercel project's Environment Variables settings before building.
