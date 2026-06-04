# First Light Distribution Plan
## Updated: 2026-06-04

---

## Current State

| Asset | Status |
|---|---|
| Product | Live, working, payment confirmed |
| Languages | EN, ZH-TW, ZH-CN, JA, KO |
| Landing page | Beautiful, 17-surface carousel demo |
| Blog | ❌ Does not exist |
| SEO | Basic: sitemap, robots, OG tags, Google verified |
| Structured data (JSON-LD) | ❌ Missing |
| Analytics | Plausible (if configured), Clarity, GA4 slots |
| Newsletter system | ✅ Built (admin panel + Resend) |
| Social presence | ❌ None |
| Users | 2 (both YL) |
| MRR | ~$0 (1 test purchase) |

---

## Positioning

**Wrong:** "First Light is a productivity app"
**Right:** "First Light writes you a personal morning briefing that plans your day"

The Daily Edition is the differentiator no competitor has.
Everything else (tasks, calendar, habits) is table stakes.

**One-liner:** A calm daily planner that starts your morning with a personally written editorial — not a to-do list.

---

## Target Markets (Phased)

### Phase 1: EN global (US/EU/AU) — Primary
- Largest TAM, highest willingness to pay for indie SaaS
- Niche: taste-driven individuals who care about aesthetics + calm productivity
- Psychographic > geographic: Monocle readers, iA Writer users, Muji shoppers, Bear app fans
- Keywords to own: "AI morning briefing app", "editorial daily planner", "calm productivity app"

### Phase 1b: ZH-TW (Taiwan) — Simultaneous
- YL lives here, free distribution (PTT, Dcard, Inside/TechOrange press)
- Low competition: no local product matches this quality
- Lower ARPU but easy validation

### Phase 2: JA (Japan) — Month 3+
- High ARPU, aesthetics-sensitive market, underserved by English-first competitors
- Already localized. Needs cultural tuning + JP community seeding

### Phase 3: KO (Korea) — Month 6+
- Similar to JP opportunity. Already localized.

### Not now: China
- ICP filing, GFW, payment rebuild = full company. Not a side project move.

---

## 90-Day Execution Plan

### Week 1-2: Foundation (Nemo can do most of this)

**SEO infrastructure:**
- [ ] Add JSON-LD structured data to landing page (SoftwareApplication schema)
- [ ] Add JSON-LD to /pricing (Product schema with offers)
- [ ] Create /blog route with MDX or markdown support (simple: src/app/blog/[slug]/page.tsx + static .mdx files)
- [ ] Add blog to sitemap.xml
- [ ] Submit sitemap to Google Search Console (YL: manual step)
- [ ] Set up Plausible analytics if not already active (YL: check Vercel env)

**Content (3 launch articles, EN + ZH-TW):**
- [ ] "Why I built First Light" — founder story, personal, authentic
- [ ] "Your morning shouldn't start with a to-do list" — the Daily Edition concept piece
- [ ] "First Light vs Todoist vs Things vs TickTick — honest comparison" — SEO play

**Landing page optimization:**
- [ ] Add social proof section (even if it's just "Built by a solo maker in Taipei")
- [ ] Add a "See the Daily Edition" section with a real sample briefing
- [ ] FAQ section (helps SEO + reduces bounce)

### Week 3-4: Launch Prep

**Product Hunt:**
- [ ] Create upcoming page on producthunt.com (YL: needs PH account)
- [ ] Prepare 5-6 high-quality screenshots (Daily Edition, task views, calendar, mobile)
- [ ] Write PH tagline: "Your day starts with a personally written morning edition"
- [ ] Recruit 5-10 early hunters from PH community / Twitter
- [ ] Prepare maker's comment (personal story, not feature list)

**Community seeding:**
- [ ] r/productivity, r/getdisciplined — post "I built this" (be genuine, not spammy)
- [ ] Hacker News — "Show HN: First Light — AI morning briefing that plans your day"
- [ ] IndieHackers — post in product showcase + write about the build journey
- [ ] Twitter/X — create @firstlightapp account, post build-in-public content
- [ ] 台灣: PTT (Soft_Job, MAC, iOS), Dcard (3C板)

### Week 5-6: Product Hunt Launch

**Execution:**
- [ ] Launch on Tuesday/Wednesday (best PH days)
- [ ] Post to all seeded communities simultaneously
- [ ] Send newsletter to any collected emails
- [ ] Cross-post founder story to Medium, Dev.to, Hashnode (backlinks!)
- [ ] 台灣科技媒體 pitch: Inside (inside.com.tw), TechOrange, iThome

### Week 7-12: Content Engine + Iteration

**Blog cadence: 1 article/week (alternating EN/ZH-TW):**

EN topics (long-tail SEO):
- "How AI can plan your day without being annoying"
- "The case for reading your day, not listing it"
- "Why I left Todoist for something calmer"
- "Productivity for people who hate productivity apps"
- "Morning routine app for adults who don't want a hustle culture tool"

ZH-TW topics:
- "為什麼你的早晨不該從待辦清單開始"
- "AI 日報式生產力工具：First Light 完整介紹"
- "從 Todoist 搬家到 First Light 的理由"
- "一個人做的 SaaS 產品，從台灣出發"

**SEO compounding:**
- Each blog post targets 1 long-tail keyword
- Internal linking between posts + landing page
- Each post gets submitted to relevant subreddits / communities
- Track rankings weekly via Google Search Console

---

## Growth Channels Ranked by Effort/Impact

| Channel | Effort | Timeline | Expected Impact |
|---|---|---|---|
| Product Hunt | Medium (1 week prep) | One-time spike | 500-2000 visits, 20-50 signups |
| Hacker News (Show HN) | Low (1 post) | One-time spike | 200-5000 visits if it hits |
| Blog SEO | High (ongoing) | 3-6 months to compound | Sustainable 100-500 visits/month |
| Reddit communities | Low (authentic posts) | Quick | 50-200 visits per post |
| Twitter build-in-public | Medium (ongoing) | 2-3 months to build audience | Brand + discovery |
| PTT/Dcard | Low | Quick | 100-500 TW visits |
| TW tech press | Low (1 pitch) | 1-2 weeks | 500-2000 TW visits |
| JP communities | Medium (need JP content) | Month 3+ | Opens second market |

---

## Metrics to Track

**Week 1-4:**
- Site visits (Plausible)
- Signup rate (signups / visits)
- Activation rate (signed up → created 3+ tasks)

**Week 5-12:**
- Trial starts
- Trial → Paid conversion rate (target: 5-10%)
- Retention: D7, D14, D30
- Source attribution: which channel drives paying users?

**Success criteria at 90 days:**
- 100+ registered users
- 10+ paid subscribers
- $50+ MRR
- 1 channel showing organic growth signal

---

## What Nemo Can Build Right Now

1. Blog infrastructure (MDX route + first 3 articles)
2. JSON-LD structured data
3. Landing page FAQ section
4. SEO-optimized meta tags per page
5. Draft Product Hunt copy
6. Draft Reddit/HN posts
7. Sitemap updates

**What needs YL:**
- Product Hunt account + launch
- Social media accounts (Twitter, Reddit)
- Final approval on blog content voice
- Press pitches (personal story)
- Community engagement (needs to be human, not bot)

---

## Budget: $0

Everything above is free. No paid ads until PMF signal (10 strangers paying).
