# LivePulse Context Engine Research

## Goal

Build a LivePulse context engine that learns from how readers actually use the public site:

- Which articles/cards were visible.
- Which cards were opened.
- How long article pages stayed active.
- How deep the reader scrolled.
- Which actions happened: bookmark, unbookmark, AI panel usage, likes/dislikes/shares/comments when those product surfaces exist.
- Which topic, source, tag, search, and feed context surrounded the event.

The first implementation should be reliable telemetry plus simple per-user ranking. More advanced candidate generation, neural ranking, and bandits can come after enough clean event data exists.

## Research Summary

Recommendation systems usually split the problem into stages:

1. Candidate generation: find a manageable set of possibly relevant items.
2. Ranking: order those candidates for the current user/session/context.
3. Re-ranking: apply freshness, diversity, quality, safety, and business/product constraints.

YouTube's deep recommendation paper describes this two-stage shape at large scale: candidate generation first, then a ranking model over a smaller set of candidates. Source: [Deep Neural Networks for YouTube Recommendations](https://research.google.com/pubs/archive/45530.pdf).

YouTube's later multitask ranking work says industrial recommenders face multiple competing objectives and feedback bias, so the system should not chase only one metric. Source: [Recommending What Video to Watch Next: A Multitask Ranking System](https://research.google/pubs/recommending-what-video-to-watch-next-a-multitask-ranking-system/).

YouTube's public recommendation explanation says recommendations use viewer behavior such as what people watch, what they do not watch, search history, likes/dislikes, and satisfaction signals. Source: [On YouTube's recommendation system](https://blog.youtube/inside-youtube/on-youtubes-recommendation-system/).

Meta's News Feed ranking engineering post frames ranking as real-time machine learning over thousands of candidates using many signals and multiple prediction models. Source: [News Feed ranking, powered by machine learning](https://engineering.fb.com/2021/01/26/core-infra/news-feed-ranking/).

The classic implicit-feedback paper by Hu, Koren, and Volinsky is important because it treats behavior as noisy preference with different confidence levels, not as perfect ratings. A click, a read, and a long dwell are not equal. Source: [Collaborative Filtering for Implicit Feedback Datasets](https://yifanhu.net/PUB/cf.pdf).

The dwell-time paper is important for LivePulse because news reading has many weak clicks. Dwell time gives a stronger relevance proxy than click alone, especially when normalized by context/device. Source: [Beyond Clicks: Dwell Time for Personalization](https://www.hongliangjie.com/publications/recsys2014.pdf).

News has fast-changing item pools, so contextual bandits are a good later-stage direction. The Yahoo! Today Module paper models personalized news recommendation as online exploration/exploitation and reports offline evaluation on tens of millions of events. Source: [A Contextual-Bandit Approach to Personalized News Article Recommendation](https://arxiv.org/abs/1003.0146).

For a future neural version, NRMS is a useful direction because it separately models news representations and user representations with self-attention. Source: [Neural News Recommendation with Multi-Head Self-Attention](https://aclanthology.org/D19-1671/).

## Design Decisions

### Track Events First

Store raw interaction events before building heavy ML. This protects us from changing the scoring formula later because the original behavior history remains available.

Core event types:

- `impression`: a card was actually visible long enough to matter.
- `click`: a card or article surface was opened.
- `read`: article engagement passed a threshold.
- `dwell`: active article-page time and scroll depth.
- `bookmark` / `unbookmark`: explicit save/unsave preference.
- `like` / `dislike` / `hide`: supported in the event model for future UI.
- `share` / `comment`: supported in the event model for future social surfaces.
- `ai_action`: AI panel usage, because asking AI about a topic is an intent signal.

### Separate Raw Events From Aggregates

The database uses:

- `UserArticleEvent`: append-only behavioral log.
- `UserArticleContext`: per-user/per-article summary for fast ranking.
- `UserInterestProfile`: topic/source/tag weights for user-level preference.

### Keep Anonymous Data Useful

Anonymous users still send events with a local anonymous ID. Signed-in users also get aggregate context. This means LivePulse can learn session behavior before requiring login, while stronger personalization stays tied to authenticated users.

### Rank Conservatively

The first ranking layer only reorders articles inside the existing fetched page. It does not replace freshness, cursor pagination, source quality, or editorial constraints.

Initial score uses:

- freshness
- topic/source interest weights
- per-article behavior score
- penalties for already-read, disliked, or hidden items
- boosts for bookmarked items

### Avoid Single-Metric Optimization

Do not optimize only clicks or only dwell time. The industry lesson from YouTube and Meta is that mature systems use multiple signals and guardrails: satisfaction, explicit feedback, quality, freshness, diversity, integrity, and exploration.

## Next Phases

1. Add visible "More like this", "Less like this", "Hide", and "Share" controls where they fit the product.
2. Add admin analytics for context events: top signals, topic interest drift, cold-start users, anonymous/session conversion.
3. Add candidate generation using followed topics, embeddings/RAG similarity, source affinity, and trending articles.
4. Add diversity re-ranking so one source/topic cannot dominate the feed.
5. Add contextual bandit experiments once enough clean impressions and clicks exist.
6. Add privacy controls: reset personalization, export/delete behavioral profile, and clear explanation text in settings.
