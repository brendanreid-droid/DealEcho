# DealEcho.io — Claude Code Project Guide

## Overview

DealEcho is a B2B SaaS platform for deal and company intelligence. Built with React 19 + Firebase, deployed via GitHub Actions.

**Live:** dealecho.io  
**GitHub:** https://github.com/brendanreid-droid/DealEcho  
**Repo Owner:** Brendan Reid (@brendanreid-droid)

## Tech Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind
- **Backend:** Firebase Cloud Functions v2 (Node 22), Firestore
- **Auth:** Firebase Auth + custom claims (role, tier)
- **Payments:** Stripe
- **AI:** Gemini (server-side only)
- **Email:** Resend
- **Deployment:** GitHub Actions → Firebase

## How to Work Here

### Git Workflow

Use **terminal** for all commits and pushes.

```bash
git add <files>
git commit -m "message"
git push origin main
```

GitHub Actions automatically deploys on push (if `functions/` or `.github/workflows/` changed).

### Code Changes

- Edits go directly to files — no PR process yet
- Commits deploy to Firebase automatically
- Test locally before pushing: `npm run dev` (frontend), `npm run serve` (functions emulator)

### File Locations

- **Frontend:** `src/`, `pages/`
- **Cloud Functions:** `functions/src/`
- **Security Rules:** `firestore.rules`
- **Shared Constants:** `src/constants/dealData.ts`
- **CI/CD:** `.github/workflows/deploy-functions.yml`

## Key Decisions

1. **Firebase-only backend** — no separate server, uses Cloud Functions for business logic
2. **Firestore security rules** — field-level write restrictions on `/users` to prevent data leakage
3. **Server-side AI only** — Gemini API key never in frontend code
4. **Admin-locked endpoints** — webhook debug logs require Bearer token + admin role
5. **Constants centralized** — DEPARTMENTS, TCV_BRACKETS, DURATION_BRACKETS in single source of truth

## Recent Work (June 2026)

Production code review completed. 7 security & quality fixes implemented and deployed:

1. ✅ Webhook endpoint locked to admins
2. ✅ Firestore user writes restricted to allowlist
3. ✅ Client-side Gemini API key removed
4. ✅ firebase-admin removed from frontend devDependencies
5. ✅ Constants centralized
6. ✅ Type safety improved (user: MappedUser | null)
7. ✅ User tracking no longer leaks email/name to Firestore

## Useful Commands

**Frontend (from repo root):**
```bash
npm install        # Install dependencies
npm run dev        # Start dev server on localhost:5173
npm run build      # TypeScript check + Vite build
npm run type-check # Type checking only
```

**Cloud Functions (from repo root):**
```bash
npm run build -w functions        # Build functions
npm run serve -w functions        # Local emulator
npm run deploy -w functions       # Deploy to Firebase
```

**Git + Deploy:**
- Use terminal: `git add`, `git commit -m "msg"`, `git push origin main`
- Push triggers GitHub Actions automatically
- Logs viewable at: https://github.com/brendanreid-droid/DealEcho/actions

## Next Steps

- [ ] Frontend UX analysis (accessibility, design patterns, user flows)
- [ ] Performance audit (bundle size, function cold starts)
- [ ] Feature work (TBD based on roadmap)

---

**Questions?** Check the memory index in `.claude/memory/MEMORY.md` for architecture decisions and workflow preferences.
