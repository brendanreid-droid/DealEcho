# DealEcho Architecture & AI Custom Instructions

This document provides critical guidelines for future development, particularly when using AI coding assistants like **Google AI Studio**. Following these rules ensures that new features do not overwrite or break existing systems (Firebase, Stripe, Auth).

---

## 🏗️ Core Architectural Principles

### 1. Centralized Infrastructure (Single Source of Truth)
Do **NOT** re-initialize Firebase or Stripe. Always import the existing instances:
- **Firebase Auth/DB**: Import from `src/firebase/config.ts`
- **Stripe Functions**: Use the `australia-southeast1` region when calling functions.

### 2. Business Logic vs. UI (Hook-First Pattern)
All business logic must reside in **Custom Hooks** located in `src/hooks/`. UI components should only consume these hooks.
- **Auth**: Use `useAuth()` for user data, roles, and tier checks.
- **Reviews**: Use `useReviews()` for fetching/adding Firestore reviews.
- **Tracking**: Use `useTracking()` for local and account tracking logic.

### 3. Strict Typing
Always use the interfaces defined in `types.ts`. Avoid using `any`.
- New entities should be added to `types.ts` before implementation.

### 4. Modular Firebase (SDK v9+)
Always use the modular SDK (`import { ... } from 'firebase/firestore'`). Do **not** use the legacy compat SDK.

---

## 🚫 Critical "Do Not Touch" List
The following logic should rarely be modified unless specifically requested, as they are core to the system's stability:
- `src/firebase/config.ts`: Core initialization.
- `src/hooks/useAuth.ts`: Auth persistence and RBAC logic.
- `firestore.rules`: Security configuration.
- `functions/src/webhook.ts`: Stripe verification and role-updating.

---

## 🚀 How to Extend

1. **Adding a new Firebase Collection**:
   - Update `types.ts` with the new data model.
   - Create a new hook in `src/hooks/` for interacting with that collection.
2. **Adding a new UI Component**:
   - Use standard Vanilla CSS (defined in `index.css`).
   - Consume existing hooks for data.
3. **Adding a Cloud Function**:
   - Ensure the function is deployed with `region('australia-southeast1')`.
   - Update `src/hooks/` to include a caller for the new function.

---

*This guide acts as a "Guardian" for the DealEcho ecosystem. If an AI suggests a change that violates these points, it is likely incorrect.*
