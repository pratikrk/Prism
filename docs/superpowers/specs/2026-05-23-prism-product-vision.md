# Prism — Product Vision

**Date:** 2026-05-23
**Status:** Approved north star
**Type:** Product vision spec (not a single sub-project — this is the full roadmap)

---

## The Mission

> **Get every Prism customer to position #1 — on Google and in AI.**

Not advise. Not report. Actually execute the full SEO strategy until they rank.

---

## What Prism Is

A product that completely replaces:
- An SEO agency ($3–10k/month)
- An in-house SEO team ($80–150k/year per person)
- A stack of disconnected SEO tools (Ahrefs, SEMrush, Surfer, GSC, GA4, etc.)

One product. Fully autonomous. Does everything an SEO department does — and measures whether it worked.

---

## Who It's For

**Complete non-experts.** People who have a website and want more visitors. They don't know what "canonical tags" or "domain rating" means. They just know they're not getting traffic.

This is not a tool for SEO professionals. It's a tool that makes SEO professionals unnecessary.

---

## How It Works

### Chat is the only front door

Every user interaction starts in plain English. The user doesn't navigate to features — they just say what they need:

- "I'm not getting any traffic" → Prism audits → shows findings → builds a plan → executes it
- "I want more backlinks" → Prism finds opportunities → drafts outreach → user approves → sends
- "Why did my traffic drop?" → Prism checks rankings, identifies the cause, explains it
- "Write me a blog post about X" → Prism checks what would rank, writes it, queues for approval
- "Fix my site" → Prism audits, prioritizes issues, generates fixes, queues for approval
- "What should I do this week?" → Prism reviews current state, recommends the highest-impact action

Prism figures out what the user needs. The user never has to know what to ask for.

### The workspace = your ongoing relationship

One workspace per site. Not a project, not a job — an ongoing relationship. Every time the user opens it, Prism knows:
- The full site history
- What was done last week
- What changed in rankings
- What's waiting for approval
- What to do next

### 1-click approval before anything goes live

Prism does the work and queues it. Nothing is published, sent, or applied without explicit user approval. Every item in the queue shows exactly what will happen before the user approves.

---

## What Prism Does

### 1. Audit
The starting point for every new workspace. Prism analyses the site across all dimensions and produces a health score with prioritized action items.

Covers:
- Technical health (robots.txt, sitemap, canonical, meta, Core Web Vitals, security headers, mobile)
- Content quality (E-E-A-T signals, thin content, readability, topical authority)
- AI/LLM visibility (llms.txt, AI crawler rules, passage citability, structured data for AI Overviews)
- Domain authority and backlink profile
- Current keyword rankings and traffic estimates

Re-runs automatically when Prism detects significant changes or when the user asks.

### 2. Technical Fixes
Prism generates the exact fix for every technical issue it finds — not a recommendation, the actual code or markup.

Covers:
- Schema markup (every type: Article, Product, FAQ, LocalBusiness, BreadcrumbList, HowTo, etc.)
- robots.txt (traditional crawlers + AI crawlers: GPTBot, ClaudeBot, PerplexityBot)
- XML sitemap generation and optimization
- Canonical tags, hreflang, meta tags
- Core Web Vitals improvements
- Security headers
- llms.txt (AI crawler discovery file)
- Any file or markup that affects how Google or AI systems read the site

Every fix goes into the approval queue. User approves → fix is applied (direct API if CMS integration exists, or copy-paste snippet if not).

### 3. Content
Prism identifies content gaps (keywords the site should rank for but doesn't) and writes the content to fill them.

Covers:
- Blog posts, landing pages, product pages
- Optimizing existing pages that are underperforming
- Content structured for both Google ranking and AI Overview citation
- Passage-level writing that maximizes AI citability
- Internal linking recommendations

Content goes into the approval queue as a draft. User reviews, requests changes, or approves. On approval, Prism publishes to the CMS (WordPress, Webflow, etc.) or delivers the file for manual publishing.

### 4. Links
Prism finds where the site should have backlinks and does the outreach.

Covers:
- Identifying link-building opportunities (sites that link to competitors but not to the user)
- Finding guest post and resource page opportunities
- Drafting personalized outreach emails
- Tracking which outreach was sent and what responded

Outreach drafts go into the approval queue. User approves → emails sent (with email integration) or delivered as drafts to send manually.

### 5. AI & LLM Visibility
Prism optimizes for being cited in AI-generated answers — Google AI Overviews, ChatGPT, Perplexity, Bing Copilot.

Covers:
- llms.txt file creation and maintenance
- Structured data signals that increase AI citation likelihood
- Passage-level content optimization for citability scoring
- Brand mention signals and authority building
- Monitoring where the brand is (and isn't) mentioned in AI responses
- Platform-specific optimization for each AI search engine

This is the layer that traditional SEO agencies cannot provide. It is a core Prism differentiator.

### 6. Data Integrations (the closed loop)
Without real data, Prism is working with estimates. With integrations, Prism knows exactly what is working.

| Integration | What it provides |
|---|---|
| **Google Search Console** | Real rankings, impressions, CTR, indexation status, crawl errors |
| **Google Analytics 4** | Real traffic, conversions, revenue — connects SEO actions to business outcomes |
| **DataForSEO** | Keyword volumes, competitor data, SERP analysis, backlink profiles |
| **Rank tracking** | Daily/weekly keyword position monitoring |
| **Competitor monitoring** | When competitors publish new content, earn new links, or outrank you on target keywords |

With GA4 + GSC + DataForSEO combined, Prism can say:
> "We fixed your schema in week 1, published 3 articles in weeks 2–4. Your traffic went from 847 to 2,300 visitors. GSC shows 14 new first-page rankings. Here's exactly what drove it."

---

## The Product Interface

### Chat thread
The primary interface. Conversational, plain English. All results, cards, and outputs surface here. The user can always ask follow-up questions on anything Prism produces.

### Dashboard
The site's current state at a glance:
- Overall health score (technical / content / AI visibility)
- Organic traffic trend (from GA4)
- Keyword rankings summary (from GSC + rank tracker)
- Top wins and losses this week
- Pending items in the approval queue

### Sprint
What Prism is actively working on — a live view of in-progress and queued tasks across all pillars (technical, content, links, AI visibility). Shows status, priority, and expected impact.

### Content
All content Prism has written or is working on — drafts, queued for approval, approved, published. Each piece shows its target keyword, current ranking, and traffic attribution.

### Calendar
The content publishing schedule. What is planned, when it publishes, and the gap it fills in the keyword strategy. Prism proposes the calendar; the user can adjust dates.

### Visualizations
Charts and diagrams for users who want to go deeper:
- Traffic trend over time (GA4)
- Ranking distribution (number of keywords in positions 1–3, 4–10, 11–20)
- Competitor ranking overlap
- Keyword opportunity map
- AI visibility score trend

---

## The Intelligence Layer

Every Prism agent is powered by the `vendor/claude-seo/` skill bundle. This is the SEO knowledge layer — 23 specialist skills covering every aspect of modern SEO and AI visibility.

The architecture:
```
User (plain English)
  → IntentRouterAgent (classifies intent, selects workflow)
  → Specialist agents (each backed by a claude-seo skill)
  → DataForSEO / GA4 / GSC (real data)
  → Results surface in chat + structured views
  → Approval queue for actions
  → Execution on approval
```

The skills are not features — they are the knowledge that makes each agent expert-level:

| Skill | Powers |
|---|---|
| `seo-technical` | Technical audit, fix generation |
| `seo-schema` | Schema markup for all types |
| `seo-geo` | llms.txt, AI Overview, LLM visibility |
| `seo-content` | E-E-A-T, content quality, citability |
| `seo-dataforseo` | Keyword research, SERP analysis, rank tracking |
| `seo-backlinks` | Link profile analysis, opportunity finding |
| `seo-sitemap` | Sitemap generation and validation |
| `seo-cluster` | Topic clustering, content architecture |
| `seo-page` | Single-page deep analysis |
| `seo-local` | Local SEO, GBP, citations |
| `seo-performance` | Core Web Vitals, page speed |

---

## Build Sequence (Sub-projects)

This is a multi-sub-project product. Each sub-project delivers standalone user value.

| # | Sub-project | Core deliverable | Foundation dependency |
|---|---|---|---|
| 1 | **Foundation** (current) | Pipeline, agents, chat layer, quick audit | — |
| 2 | **Product UX redesign** | Chat-first workspace, Dashboard shell, Sprint view | #1 |
| 3 | **Technical pillar** | Full technical audit + fix generation + apply mechanism | #2 |
| 4 | **Content pillar** | Content gap analysis + write + CMS publish | #2 |
| 5 | **Data integrations** | GA4 + GSC + rank tracking closed loop | #2 |
| 6 | **Links pillar** | Link opportunity finder + outreach workflow | #3, #5 |
| 7 | **AI/LLM visibility** | llms.txt, GEO optimization, AI monitoring | #3, #4 |
| 8 | **Competitor monitoring** | Ongoing competitor intelligence + alerts | #5 |
| 9 | **Billing + launch** | Pricing, payments, onboarding | #3–#8 |

---

## What Makes Prism Different

| Capability | Traditional SEO agency | SEO tools (Ahrefs, SEMrush) | Prism |
|---|---|---|---|
| Understands plain English | Yes (human) | No | Yes |
| Real data about your site | Yes | Yes | Yes |
| Actually does the work | Yes (humans) | No (reports only) | Yes (AI) |
| Remembers your history | Sometimes | No | Yes |
| AI/LLM visibility | Rarely | No | Yes |
| Available 24/7 | No | Yes | Yes |
| Cost | $3–10k/month | $100–500/month | — |
| Non-expert friendly | Partially | No | Yes |

---

## What Is NOT In Scope (for any sub-project)

- Paid advertising (Google Ads, Meta Ads) — SEO only
- Social media management
- Email marketing
- PR / brand management beyond link building
- Multi-language site management (hreflang is supported technically, but strategy is out of scope)
- Video SEO (YouTube) — web SEO only for now
