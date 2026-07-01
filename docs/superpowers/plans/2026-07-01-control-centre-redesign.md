# Control Centre Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify header navigation and reorganize the account page into a tab-based "Control Centre" with clear separation of Tracked Accounts, Reviews, and Billing/Account sections.

**Architecture:** Two-phase refactor:
1. **Phase 1:** Reduce header nav to 4 core items (Write Review, Control Centre, Team, Admin)
2. **Phase 2:** Refactor MyIntel.tsx to tab-based layout with three tabs managing state independently

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Firestore (existing)

---

## File Structure

**Modified files:**
- `src/components/Shell.tsx` — Remove 3 nav links from `navLinks` array
- `pages/MyIntel.tsx` — Refactor entire page to tab-based state management + component structure

**No new files created.** Existing `MySubmissions.tsx` is embedded without changes.

---

## Task 1: Simplify Header Navigation

**Files:**
- Modify: `src/components/Shell.tsx:25-37`

- [ ] **Step 1: Review current nav links**

Open `src/components/Shell.tsx` and examine the `navLinks` array (lines 25–31). Currently:
```
[
  { name: "Search", path: "/", icon: "fa-search" },
  { name: "Write Review", path: "/review/new", icon: "fa-pen-nib" },
  { name: "My Intel", path: "/my-intel", icon: "fa-user-circle" },
  { name: "Analytics", path: "/trends", icon: "fa-chart-line" },
  { name: "Pricing", path: "/pricing", icon: "fa-tags" },
]
```

- [ ] **Step 2: Update navLinks array**

Replace the `navLinks` array definition (lines 25–31) with:

```typescript
const navLinks = [
  { name: "Write Review", path: "/review/new", icon: "fa-pen-nib" },
  { name: "Control Centre", path: "/my-intel", icon: "fa-user-circle" },
];
if (isEnterprise) {
  navLinks.push({ name: "Team", path: "/settings/team", icon: "fa-users" });
}
if (isAdmin) {
  navLinks.push({ name: "Admin", path: "/admin", icon: "fa-shield-alt" });
}
```

**Explanation:** 
- Remove Search, Analytics, Pricing from authenticated nav
- Rename "My Intel" to "Control Centre"
- Conditionally add Team and Admin (order: Team, then Admin)
- Unauthenticated nav still shows Search + Pricing (unchanged, lines 55–59)

- [ ] **Step 3: Verify notification badge still works**

The notification badge for "Control Centre" (line 69) uses `link.path === "/my-intel"`. Verify this still matches after the rename. No change needed—path is unchanged.

- [ ] **Step 4: Test in browser**

Run `npm run dev`, navigate to app while logged in. Verify:
- Header shows: Write Review, Control Centre (no Search/Analytics/Pricing)
- Enterprise users see: Write Review, Control Centre, Team
- Admin users see: Write Review, Control Centre, Team (if enterprise), Admin
- Unauthenticated users see: Search, Pricing

- [ ] **Step 5: Commit**

```bash
git add src/components/Shell.tsx
git commit -m "refactor(nav): remove redundant header links (Search, Analytics, Pricing), rename My Intel to Control Centre"
```

---

## Task 2: Add Tab State & Structure to MyIntel.tsx

**Files:**
- Modify: `pages/MyIntel.tsx:1-50`

- [ ] **Step 1: Add tab state at top of component**

After the existing `useState` declarations (around line 49), add:

```typescript
const [activeTab, setActiveTab] = useState<'tracked' | 'reviews' | 'billing'>('tracked');
```

This goes right after the existing state declarations for `cancelling`, `cancelError`, `cancelSuccess`.

**Full context (lines 49–52 should now look like):**
```typescript
const [cancelling, setCancelling] = useState(false);
const [cancelError, setCancelError] = useState<string | null>(null);
const [cancelSuccess, setCancelSuccess] = useState(false);
const [activeTab, setActiveTab] = useState<'tracked' | 'reviews' | 'billing'>('tracked');
```

- [ ] **Step 2: Add tab navigation UI above main content**

After the profile header section (which ends at line 210), insert a new tab navigation component. Find the line `<div className="grid grid-cols-1 lg:grid-cols-3 gap-12">` (line 212) and replace it with:

```typescript
{/* Tab Navigation */}
<div className="flex gap-8 border-b border-slate-200 mb-8 px-6">
  <button
    onClick={() => setActiveTab('tracked')}
    className={`pb-4 px-0 font-semibold text-sm transition-colors flex items-center gap-2 border-b-2 ${
      activeTab === 'tracked'
        ? 'text-accent border-accent'
        : 'text-slate-500 border-transparent hover:text-slate-700'
    }`}
  >
    <Icon name="fa-bookmark" size={16} />
    Tracked Accounts
  </button>
  <button
    onClick={() => setActiveTab('reviews')}
    className={`pb-4 px-0 font-semibold text-sm transition-colors flex items-center gap-2 border-b-2 ${
      activeTab === 'reviews'
        ? 'text-accent border-accent'
        : 'text-slate-500 border-transparent hover:text-slate-700'
    }`}
  >
    <Icon name="fa-history" size={16} />
    My Reviews
  </button>
  <button
    onClick={() => setActiveTab('billing')}
    className={`pb-4 px-0 font-semibold text-sm transition-colors flex items-center gap-2 border-b-2 ${
      activeTab === 'billing'
        ? 'text-accent border-accent'
        : 'text-slate-500 border-transparent hover:text-slate-700'
    }`}
  >
    <Icon name="fa-credit-card" size={16} />
    Billing & Account
  </button>
</div>

{/* Tab Content */}
<div className="max-w-7xl mx-auto px-6 pb-12">
```

- [ ] **Step 3: Wrap tab content areas**

Each tab's content will go into a conditional render. Keep the original max-width container but move it inside the tab content section. Update the container div to:

```typescript
{activeTab === 'tracked' && (
  <div className="space-y-8">
    {/* Tracked Accounts content here */}
  </div>
)}

{activeTab === 'reviews' && (
  <div className="space-y-8">
    {/* My Reviews content here */}
  </div>
)}

{activeTab === 'billing' && (
  <div className="space-y-8">
    {/* Billing & Account content here */}
  </div>
)}
```

- [ ] **Step 4: Delete old 3-column grid**

Remove the old grid layout line that was previously at line 212:
```typescript
// DELETE: <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
```

- [ ] **Step 5: Commit**

```bash
git add pages/MyIntel.tsx
git commit -m "refactor(MyIntel): add tab state management and navigation UI"
```

---

## Task 3: Populate Tracked Accounts Tab

**Files:**
- Modify: `pages/MyIntel.tsx:activeTab === 'tracked' section`

- [ ] **Step 1: Move Tracked Accounts section into tracked tab**

Copy the entire Tracked Accounts section from the current code (lines 214–305 in original). This includes:
- The "Tracked Accounts" heading with count
- Company cards loop (lines 225–269)
- Empty state (lines 270–283)
- Upgrade prompt (lines 285–304)

Insert all of this inside the `{activeTab === 'tracked' && (...)}` block.

```typescript
{activeTab === 'tracked' && (
  <div className="space-y-8">
    <div className="flex items-center justify-between">
      <h3 className="text-xl font-bold flex items-center">
        <Icon name="fa-bookmark" className="text-indigo-500 mr-3" size={18} />
        Tracked Accounts
      </h3>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        {trackedIds.length} / {isPaid ? "∞" : "3"}
      </span>
    </div>

    <div className="space-y-4">
      {trackedCompanies.length > 0 ? (
        trackedCompanies.map((c) => (
          <div
            key={c.id}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative group"
          >
            {notifications[c.id] && (
              <div className="absolute -top-2 -right-2 bg-rose-500 text-white text-[9px] font-black px-2 py-1 rounded-lg">
                NEW
              </div>
            )}
            <div className="flex justify-between items-start mb-4">
              <Link
                to={`/company/${c.id}`}
                className="flex items-center space-x-4 group-hover:text-indigo-600 transition-colors"
              >
                <CompanyLogo
                  name={c.name}
                  logoUrl={c.logoUrl}
                  size="md"
                />
                <div>
                  <h4 className="font-bold text-slate-900">{c.name}</h4>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    {c.industry}
                  </p>
                </div>
              </Link>
              <button
                onClick={() => onToggleTrack(c.id)}
                className="text-slate-200 hover:text-rose-500 flex items-center justify-center"
              >
                <Icon name="fa-times-circle" size={16} />
              </button>
            </div>
            <div className="pt-4 border-t border-slate-50 flex justify-between">
              <div className="text-[10px] font-bold text-slate-400 uppercase">
                {c.count} Reports
              </div>
              <div className="text-[10px] font-bold text-indigo-500 uppercase">
                Active tracking
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="bg-white p-12 rounded-[32px] border border-dashed border-slate-200 text-center space-y-4">
          <Icon name="fa-search" className="text-slate-200 mx-auto block" size={40} />
          <p className="text-slate-400 text-xs font-bold uppercase">
            No accounts tracked
          </p>
          <Link
            to="/"
            className="text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:underline"
          >
            Start Searching
          </Link>
        </div>
      )}

      {!isPaid && trackedIds.length >= 3 && (
        <div className="p-6 bg-indigo-50 rounded-[28px] border border-indigo-100 space-y-4">
          <div className="flex items-center space-x-3 text-indigo-600">
            <Icon name="fa-crown" size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Limit Reached
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Upgrade to Sales Pro to track unlimited accounts and get
            AI-powered persona intelligence.
          </p>
          <Link
            to="/pricing"
            className="block text-center bg-indigo-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
          >
            Upgrade Now
          </Link>
        </div>
      )}
    </div>

    {/* Email Notification Settings Card */}
    <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
      <h3 className="text-lg font-bold flex items-center text-slate-900">
        <Icon name="fa-envelope-open-text" className="text-indigo-500 mr-3" size={18} />
        Email Notifications
      </h3>
      
      <p className="text-xs text-slate-400 font-medium leading-relaxed">
        Customize how and when you receive intelligence reports on your tracked accounts.
      </p>

      <div className="space-y-4">
        <label className="flex items-start space-x-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={user.notificationPreferences?.realTimeAlerts !== false}
            onChange={async (e) => {
              try {
                const userDocRef = doc(db, "users", user.id);
                await setDoc(
                  userDocRef,
                  {
                    notificationPreferences: {
                      realTimeAlerts: e.target.checked,
                      weeklyDigest: user.notificationPreferences?.weeklyDigest !== false,
                    },
                  },
                  { merge: true }
                );
              } catch (err) {
                console.error("Failed to update notification settings", err);
              }
            }}
            className="mt-1 h-4.5 w-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
          <div>
            <span className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
              Real-time Alerts
            </span>
            <p className="text-[11px] text-slate-400 font-medium leading-normal mt-0.5">
              Instantly receive an email report when a new vetted review is created on any tracked account.
            </p>
          </div>
        </label>

        <label className="flex items-start space-x-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={user.notificationPreferences?.weeklyDigest !== false}
            onChange={async (e) => {
              try {
                const userDocRef = doc(db, "users", user.id);
                await setDoc(
                  userDocRef,
                  {
                    notificationPreferences: {
                      realTimeAlerts: user.notificationPreferences?.realTimeAlerts !== false,
                      weeklyDigest: e.target.checked,
                    },
                  },
                  { merge: true }
                );
              } catch (err) {
                console.error("Failed to update notification settings", err);
              }
            }}
            className="mt-1 h-4.5 w-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
          <div>
            <span className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
              Weekly Digest
            </span>
            <p className="text-[11px] text-slate-400 font-medium leading-normal mt-0.5">
              A summary of the week's key buyer activity, trends, and scorecard movements.
            </p>
          </div>
        </label>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 2: Test Tracked Accounts tab**

Run `npm run dev`, navigate to Control Centre, click Tracked Accounts tab. Verify:
- Tracked companies list displays correctly
- Email notification toggles work
- Upgrade prompt shows when at limit
- Empty state shows when no accounts tracked

- [ ] **Step 3: Commit**

```bash
git add pages/MyIntel.tsx
git commit -m "feat(Control Centre): populate Tracked Accounts tab with company list and email settings"
```

---

## Task 4: Populate My Reviews Tab

**Files:**
- Modify: `pages/MyIntel.tsx:activeTab === 'reviews' section`

- [ ] **Step 1: Add My Submissions section**

Insert the `<MySubmissions />` component at the top of the reviews tab:

```typescript
{activeTab === 'reviews' && (
  <div className="space-y-8">
    {user?.id && <MySubmissions userId={user.id} />}

    <div className="flex items-center justify-between">
      <h3 className="text-xl font-bold flex items-center">
        <Icon name="fa-history" className="text-indigo-500 mr-3" size={18} />
        Workspace History
      </h3>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        {userReviews.length} Reviews
      </span>
    </div>

    {userReviews.length > 0 ? (
      <div className="space-y-4">
        {/* Workspace History cards go here */}
      </div>
    ) : (
      <div className="bg-white rounded-[48px] p-12 border border-slate-100 flex flex-col items-center justify-center text-center space-y-6 shadow-sm">
        <div className="w-16 h-16 bg-slate-50 rounded-2xl shadow-inner flex items-center justify-center text-slate-200 text-3xl">
          <Icon name="fa-pen-nib" size={30} />
        </div>
        <div>
          <h4 className="text-2xl font-black text-slate-900 mb-2">
            No Reviews Yet
          </h4>
          <p className="text-slate-500 text-sm max-w-sm mx-auto font-medium leading-relaxed">
            Write your first review to start building your workplace
            intelligence history.
          </p>
        </div>
        <Link
          to="/review/new"
          className="bg-indigo-600 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-1.5"
        >
          <Icon name="fa-pen-nib" size={10} />Write Review
        </Link>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 2: Add Workspace History cards**

Copy the Workspace History review cards from the original code (lines 403–498). This is the large `.map()` that renders each user's review. Replace the `{/* Workspace History cards go here */}` comment above with:

```typescript
{userReviews.map((review) => {
  const domainGuess = guessDomainFromName(review.companyName);
  const logoUrl = companyLogoUrl({ name: review.companyName, domain: domainGuess });
  const avgScore = Math.round(
    ((review.communicationRating +
      review.negotiationLevel +
      review.timeWasterLevel +
      (review.clarityOfScope || 3)) /
      20) *
      100,
  );
  const timeAgo = getTimeAgo(review.createdAt);

  return (
    <div
      key={review.id}
      onClick={() =>
        navigate(
          `/company/${encodeURIComponent(review.companyId)}`,
          {
            state: {
              company: {
                id: review.companyId,
                name: review.companyName,
                industry: review.industry,
                country: review.country || review.location,
              },
            },
          },
        )
      }
      className="bg-white p-6 md:p-8 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-lg hover:border-indigo-200 hover:-translate-y-0.5 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-4">
          <CompanyLogo
            name={review.companyName}
            logoUrl={logoUrl}
            size="md"
            className="group-hover:scale-105 transition"
          />
          <div>
            <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
              {review.companyName}
            </h4>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              {review.industry} &bull;{" "}
              {review.country || review.location}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span
            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${
              review.status === "Won"
                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                : review.status === "Lost"
                  ? "bg-rose-50 text-rose-600 border border-rose-100"
                  : "bg-amber-50 text-amber-600 border border-amber-100"
            }`}
          >
            {review.status}
          </span>
          <div className="bg-slate-900 text-white px-3 py-1.5 rounded-xl text-center">
            <div className="text-[7px] font-black uppercase tracking-tighter opacity-60">
              Score
            </div>
            <div className="text-xs font-black text-indigo-400">
              {avgScore}%
            </div>
          </div>
        </div>
      </div>

      <p className="text-slate-600 text-sm leading-relaxed line-clamp-2 mb-4 font-medium">
        {review.content}
      </p>

      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
        <div className="flex items-center space-x-4">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center">
            <Icon name="fa-dollar-sign" className="mr-1" size={10} />
            {review.tcvBracket}
          </span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center">
            <Icon name="fa-clock" className="mr-1" size={10} />
            {review.cycleDuration}
          </span>
        </div>
        <span className="text-[9px] font-bold text-slate-300">
          {timeAgo}
        </span>
      </div>
    </div>
  );
})}
```

- [ ] **Step 3: Test My Reviews tab**

Run `npm run dev`, click My Reviews tab. Verify:
- My Submissions section displays (pending/rejected reviews)
- Workspace History displays published reviews
- Empty state shows when no reviews
- Review cards are clickable and navigate correctly
- Tab doesn't show profile/billing content

- [ ] **Step 4: Commit**

```bash
git add pages/MyIntel.tsx
git commit -m "feat(Control Centre): populate My Reviews tab with submissions and workspace history"
```

---

## Task 5: Populate Billing & Account Tab

**Files:**
- Modify: `pages/MyIntel.tsx:activeTab === 'billing' section`

- [ ] **Step 1: Create Billing & Account tab content**

Insert the following into the `{activeTab === 'billing' && (...)}` block:

```typescript
{activeTab === 'billing' && (
  <div className="space-y-8">
    {/* Profile Section */}
    <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-10 rounded-[40px] text-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-1/3 h-full bg-indigo-500/10 blur-[100px] rounded-full"></div>
      <div className="flex items-center space-x-6 relative z-10">
        <img
          src={user.avatar}
          className="w-20 h-20 rounded-[28px] border-4 border-white/10"
          alt="avatar"
        />
        <div>
          <h2 className="text-3xl font-black tracking-tight">{user.name}</h2>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">
            {user.email}
          </p>
        </div>
      </div>
    </div>

    {/* Plan & Subscription Section */}
    <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
      <h3 className="text-lg font-bold text-slate-900">Subscription & Plan</h3>
      
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Current Plan
          </p>
          <div
            className={`px-6 py-3 rounded-2xl text-center border inline-block ${isPaid ? "bg-indigo-600/20 border-indigo-400/30" : "bg-white/10 border-white/10"}`}
          >
            <div className="text-sm font-black">
              {isPaid ? "Sales Pro Member" : "Pioneer Plan"}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          {cancelSuccess && (
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
              Subscription cancelled successfully
            </span>
          )}
          {cancelError && (
            <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
              {cancelError}
            </span>
          )}
          {!isPaid && (
            <Link
              to="/pricing"
              className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/30 flex items-center space-x-2"
            >
              <Icon name="fa-crown" size={10} />
              <span>Upgrade to Sales Pro</span>
            </Link>
          )}
          {isPaid && (
            <button
              onClick={handleCancelSubscription}
              disabled={cancelling}
              className="px-6 py-3 bg-rose-600/20 border border-rose-500/30 text-rose-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600/40 transition-all flex items-center space-x-2 disabled:opacity-50 justify-center"
            >
              {cancelling ? (
                <>
                  <Loader2 className="animate-spin text-rose-400" size={10} />
                  <span>Cancelling…</span>
                </>
              ) : (
                <>
                  <Icon name="fa-times-circle" size={10} />
                  <span>Cancel Subscription</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>

    {/* Payment Details Section (Placeholder) */}
    <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
      <h3 className="text-lg font-bold text-slate-900">Payment Details</h3>
      <p className="text-sm text-slate-500 font-medium">
        Payment method and billing history will be available here. Integration with Stripe coming soon.
      </p>
    </div>

    {/* Account Security Section (Placeholder) */}
    <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
      <h3 className="text-lg font-bold text-slate-900">Account Security</h3>
      <p className="text-sm text-slate-500 font-medium">
        Password change and advanced account settings are coming soon.
      </p>
    </div>
  </div>
)}
```

**Explanation of sections:**
- **Profile:** Avatar, name, email (moved from header)
- **Subscription & Plan:** Current plan badge, upgrade/cancel buttons, status messages
- **Payment Details & Account Security:** Placeholders for future implementation

- [ ] **Step 2: Verify subscription logic is accessible**

Confirm that `handleCancelSubscription`, `cancelling`, `cancelError`, `cancelSuccess` state variables are all defined in the component (they should be from original code). These are at lines 49–77.

- [ ] **Step 3: Test Billing & Account tab**

Run `npm run dev`, click Billing & Account tab. Verify:
- Profile section shows user avatar, name, email
- Plan section shows current plan (Sales Pro or Pioneer)
- Upgrade button shows if unpaid
- Cancel button shows if paid
- Placeholder sections display
- Tab switching doesn't lose state
- Cancel subscription flow still works

- [ ] **Step 4: Commit**

```bash
git add pages/MyIntel.tsx
git commit -m "feat(Control Centre): populate Billing & Account tab with profile, plan, and payment placeholders"
```

---

## Task 6: Clean Up & Remove Old Code

**Files:**
- Modify: `pages/MyIntel.tsx`

- [ ] **Step 1: Remove old 3-column grid wrapper**

Delete the closing `</div>` from the old grid layout that was at line 523:
```typescript
// DELETE this line:
// </div> (closes the grid from line 212)
```

Also delete any leftover grid column dividers or old layout markup. The file should only have the tab navigation and three conditional tab blocks now.

- [ ] **Step 2: Remove profile header from main render**

The profile header section (lines 145–210 in original) should no longer be in the main return, since it's now inside the Billing & Account tab. Delete the entire `<div className="flex flex-col md:flex-row...">` block (the dark header with user avatar, plan badge, upgrade button).

**Search for and verify deletion of:**
```typescript
// DELETE lines 145–210 (the profile header with background gradient)
```

- [ ] **Step 3: Verify file structure is clean**

The MyIntel.tsx file should now have:
1. Imports (unchanged)
2. Helper function `getTimeAgo` (unchanged)
3. Component props type (unchanged)
4. Component function opening with hooks
5. State declarations including new `activeTab` state
6. Handler functions (`handleCancelSubscription`, etc.)
7. Memoized calculations (`trackedCompanies`, `userReviews`)
8. Early return for unauthenticated users (unchanged)
9. **Tab navigation UI**
10. **Three tab content blocks** (tracked, reviews, billing)
11. Component closing

- [ ] **Step 4: Check for dangling references**

Search the file for any remaining references to removed sections like the old "grid-cols-3" or "lg:col-span-1". There should be none.

- [ ] **Step 5: Commit**

```bash
git add pages/MyIntel.tsx
git commit -m "refactor(Control Centre): remove old 3-column layout and consolidate into tab structure"
```

---

## Task 7: Comprehensive Testing & Verification

**Files:**
- Test: Browser testing (dev server)

- [ ] **Step 1: Start dev server**

Run:
```bash
npm run dev
```

Wait for compilation to complete. Navigate to http://localhost:5173

- [ ] **Step 2: Test header navigation**

**Authenticated user (logged in):**
- Header shows: Write Review, Control Centre (no Search/Analytics/Pricing)
- Click Control Centre → navigates to `/my-intel`
- All header links are clickable and navigate correctly

**Unauthenticated user (logged out):**
- Header shows: Search, Pricing (Write Review and Control Centre hidden)
- Sign-in prompt visible

**Enterprise user (if testable):**
- Header shows: Write Review, Control Centre, Team
- Team link navigates to `/settings/team`

**Admin user (if testable):**
- Header shows: Write Review, Control Centre, Admin
- Admin link navigates to `/admin`

- [ ] **Step 3: Test Tracked Accounts tab**

1. Click Control Centre nav link
2. Verify Tracked Accounts tab is active by default
3. Verify tab shows:
   - Tracked companies list (or empty state if none)
   - Notification badge on company cards if pending reviews
   - Email notification toggles (Real-time, Weekly Digest)
   - Upgrade prompt if user is unpaid and at limit
4. Toggle email notification checkboxes → verify Firestore updates (check DevTools console for errors)
5. Click company card → should navigate to company profile page
6. Click X button on company card → should remove tracking
7. Click "Start Searching" if empty → should navigate to search page

- [ ] **Step 4: Test My Reviews tab**

1. Click My Reviews tab
2. Verify tab shows:
   - My Submissions section (if any pending/rejected reviews)
   - Workspace History section with published reviews (or empty state if none)
3. If submissions exist:
   - Rejected reviews show with moderation reason
   - Edit & Resubmit button is clickable
   - Cancel button works
4. If workspace history exists:
   - Review cards display company, status, score
   - Cards are clickable and navigate to company profile
   - Time ago ("3d ago") displays correctly
5. Empty state shows "No Reviews Yet" with "Write Review" CTA

- [ ] **Step 5: Test Billing & Account tab**

1. Click Billing & Account tab
2. Verify tab shows:
   - Profile section with user avatar, name, email
   - Subscription section with current plan badge
   - Upgrade button (if unpaid) or Cancel button (if paid)
   - Payment Details placeholder
   - Account Security placeholder
3. Test cancel subscription (if paid account):
   - Click Cancel Subscription button
   - Confirmation modal should appear
   - Click confirm → button shows "Cancelling…"
   - Upon success, success message displays
   - Plan badge changes to "Pioneer Plan"
4. Test upgrade link (if unpaid):
   - Click "Upgrade to Sales Pro" button
   - Navigates to `/pricing`

- [ ] **Step 6: Test tab state persistence**

1. Click Tracked Accounts tab
2. Scroll down on page (if content is tall)
3. Click My Reviews tab
4. Click back to Tracked Accounts → page should scroll to top of tab (normal React behavior)
5. Verify no errors in console

- [ ] **Step 7: Test mobile layout**

Open DevTools, set viewport to mobile (375px width):
1. Tab buttons should remain horizontal (not stack)
2. Tab content should be readable at mobile width
3. Cards should scale appropriately
4. No horizontal scroll

- [ ] **Step 8: Test footer links**

Verify footer "My intel" link still works:
1. Scroll to footer
2. Click "My intel" link under Contribute section
3. Should navigate to `/my-intel` and land on Control Centre

- [ ] **Step 9: Verify no console errors**

Open DevTools → Console tab while performing all tests above. Verify:
- No TypeScript/ESLint errors
- No React warnings about missing keys
- No Firestore errors
- No undefined variable errors

- [ ] **Step 10: Commit test confirmation**

```bash
git add .
git commit -m "test(Control Centre): verify all tabs, navigation, and functionality working correctly"
```

---

## Task 8: Final Review & Commit

**Files:**
- None (review only)

- [ ] **Step 1: Review all commits**

Run:
```bash
git log --oneline -10
```

Verify you see:
1. "test(Control Centre): verify all tabs..."
2. "refactor(Control Centre): remove old 3-column layout..."
3. "feat(Control Centre): populate Billing & Account tab..."
4. "feat(Control Centre): populate My Reviews tab..."
5. "feat(Control Centre): populate Tracked Accounts tab..."
6. "refactor(MyIntel): add tab state management..."
7. "refactor(nav): remove redundant header links..."

- [ ] **Step 2: Verify no untracked files**

Run:
```bash
git status
```

Should show: "working tree clean"

- [ ] **Step 3: Create final summary commit (optional)**

If desired, create a summary commit:
```bash
git commit --allow-empty -m "build(Control Centre): redesign complete — header cleanup + tab-based hub"
```

---

## Self-Review Against Spec

**Spec Coverage Check:**

✅ **Header Navigation Changes:**
- Task 1: Removes Search, Analytics, Pricing from authenticated nav
- Task 1: Renames "My Intel" to "Control Centre"
- Task 1: Keeps Team, Admin conditional

✅ **Control Centre Tab Structure:**
- Task 2: Adds tab state management
- Task 3: Implements Tracked Accounts tab with companies + email settings
- Task 4: Implements My Reviews tab with submissions + workspace history
- Task 5: Implements Billing & Account tab with profile + plan + placeholders

✅ **Routing & Navigation:**
- No route change (stays at `/my-intel`)
- Tabs managed via component state
- Notification badge preserved (Task 1: verified line 69)

✅ **Accessibility & Mobile:**
- Task 2: Tab buttons use semantic `<button>` with labels
- Task 2: Tabs remain horizontal on mobile
- Task 7: Mobile testing included

✅ **Testing:**
- Task 7: Comprehensive testing checklist covers all scenarios

**Placeholder Scan:**
- ✅ No TBD/TODO left in tasks
- ✅ Payment Details and Account Security marked as placeholders with explanation
- ✅ All code steps include complete, working code

**Type Consistency:**
- `activeTab` state: `'tracked' | 'reviews' | 'billing'` — used consistently
- Functions preserved from original: `handleCancelSubscription`, notification handlers — signatures unchanged

**No Gaps:** All spec requirements have corresponding tasks.

---

## Execution Options

Plan complete and saved to `docs/superpowers/plans/2026-07-01-control-centre-redesign.md`.

**Two execution approaches:**

**1. Subagent-Driven (Recommended)** — I dispatch a fresh subagent per task, you review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch with checkpoints for review

Which approach?
