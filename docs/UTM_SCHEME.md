# DealEcho UTM Tagging Scheme

Canonical URL tagging for all marketing links (LinkedIn posts, paid ads, email,
etc.). **Every** outbound link that should get attribution credit MUST carry
these params. Hermes agents should emit the tagged URL alongside each post/ad.

## Base URL

```
https://dealecho.io/?utm_source=...&utm_medium=...&utm_campaign=...&utm_content=...
```

The app captures these on landing (first-party cookie, 90 days) and, on signup,
writes first-touch + last-touch to the user record. The Admin > Marketing tab
rolls them up and exports CSV.

## Parameters

| Param          | Required | Meaning                              | Allowed values / convention |
|----------------|----------|--------------------------------------|-----------------------------|
| `utm_source`   | yes      | Platform the click came from         | `linkedin` (add `email`, `twitter`, etc. as needed) — lowercase, no spaces |
| `utm_medium`   | yes      | Paid vs organic                      | `organic` (normal posts) · `paid` (sponsored/ads) · `email` |
| `utm_campaign` | yes      | Theme + time bucket                  | `<pillar>-week<NN>`, e.g. `procurement-week29`, `lost-deals-week30` |
| `utm_content`  | yes      | Specific post / ad variant (A/B)     | `post-a`, `post-b`, `ad-hero`, `ad-carousel-1` — unique per creative |
| `utm_term`     | optional | Paid keyword / audience segment      | free text, lowercase-hyphenated |

### Conventions
- **Lowercase, hyphen-separated.** No spaces, no capitals, no underscores in values.
- **`utm_campaign` = `<pillar>-week<NN>`.** Pillars align to the content pillars:
  `procurement`, `lost-deals`, `transparency`, `sales-intelligence`.
- **`utm_content` is unique per creative** so A/B variants are separable in the report.
- Keep the campaign name **identical** across the post and any ad promoting it, so
  organic vs paid split cleanly on `utm_medium` while rolling up under one campaign.

## Examples

Organic LinkedIn post, procurement pillar, week 29, variant A:
```
https://dealecho.io/?utm_source=linkedin&utm_medium=organic&utm_campaign=procurement-week29&utm_content=post-a
```

Paid ad promoting the same theme, hero creative:
```
https://dealecho.io/?utm_source=linkedin&utm_medium=paid&utm_campaign=procurement-week29&utm_content=ad-hero
```

## Reading results

Admin panel → **Marketing** tab:
- **Campaign table** — signups + paid conversions + conversion % per first-touch campaign.
- **Campaign CSV** — the rollup above, for a quick performance sheet.
- **Raw CSV** — one row per user with first-touch + last-touch fields. Feed this
  back into Hermes for optimisation (which pillars/variants convert, organic vs paid).

## Attribution model

- **First-touch** (immutable): the campaign that first brought the visitor to the
  site. Best signal for top-of-funnel content that generates signups.
- **Last-touch** (refreshed each visit): the most recent campaign before signup.
  Best signal for what closes.

Both are stored per user, so Hermes can optimise for either.
