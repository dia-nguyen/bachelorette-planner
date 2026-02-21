# Backlog — Deferred Features

Items below are out-of-scope for the MVP but documented for the next iteration.

---

## 🔐 Auth & Multi-User

- [ ] Supabase Auth (magic link + Google OAuth)
- [ ] Real user sessions (replace DEMO_USER_ID constant)
- [ ] Row-level security policies (see `docs/schema.sql`)
- [ ] Invite via shareable link with token

## 🗄️ Database Migration

- [ ] Provision Supabase project
- [ ] Run `docs/schema.sql` to create tables
- [ ] Implement `SupabaseRepository` conforming to `Repository` interface
- [ ] Swap `demoRepository` for `supabaseRepository` via env flag
- [ ] Migrate localStorage data → Supabase (optional script)

## 🔄 Real-Time

- [ ] Supabase Realtime subscriptions for live updates
- [ ] Optimistic UI with rollback on conflict
- [ ] Presence indicator (who's online)

## 📝 Forms & Validation

- [ ] Migrate all forms from `useState` to `react-hook-form` + `zod` schemas
- [ ] Inline field-level validation errors
- [ ] Toast notifications for success/error states

## 🎨 UI Polish

- [ ] Full Chakra UI component integration (replace raw HTML elements)
- [ ] Skeleton loading states for every data section
- [ ] Dark mode toggle (tokens already support it via CSS vars)
- [ ] Responsive / mobile layout (bottom tab bar instead of sidebar)
- [ ] Animations — Framer Motion page transitions
- [ ] Drag-and-drop task reordering (react-beautiful-dnd or dnd-kit)

## 📊 Dashboard Enhancements

- [ ] Timeline / Gantt view for events
- [ ] Budget trend line chart (spending over time)
- [ ] Export budget report as PDF / CSV
- [ ] Weather forecast widget for destination

## 👥 Guest Features

- [ ] RSVP email flow (sendgrid / resend)
- [ ] Dietary preferences / allergies field
- [ ] +1 / plus-guest management
- [ ] Guest-visible itinerary (read-only, no prices)

## 🗓️ Events

- [ ] Drag to reorder itinerary
- [ ] Google Maps embed for location
- [ ] Day-by-day grouping
- [ ] Voting / poll for activity preferences

## 📱 Mobile

- [ ] PWA manifest + service worker
- [ ] Push notifications for task reminders
- [ ] Camera integration for photo sharing

## 🧪 Testing

- [ ] Unit tests for `src/lib/domain/` pure functions (vitest)
- [ ] Component tests for dashboard cards (testing-library)
- [ ] E2E tests for CRUD flows (Playwright)
- [ ] Accessibility audit (axe-core)

## 🚀 Deployment

- [ ] Vercel deployment config
- [ ] Environment variable management
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Preview deployments for PRs
