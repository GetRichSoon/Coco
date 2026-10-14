# The Token Treasury

How Good Space spends its Claude plan: the strongest model only when the job needs it, nothing wasted.
Founder decision 2026-10-15. Engine: the Resource Governor in Coco HQ (`os/resources.json`, `scripts/os.mjs`).

## Plan
- **Now: Claude Pro.** One work cycle a day, at most 4 tasks, no Opus, one big job a day.
- **In a few days: Claude Max.** On the upgrade day the founder tells Coco "Max 5x" or "Max 20x";
  Coco runs `node scripts/os.mjs plan-set max5` (or `max20`) in Coco HQ and confirms the new budget.

## Rules
1. **The right model for each job**
   | Model | Who | For |
   |---|---|---|
   | Haiku (cheapest) | Lola, Lili, Kiki, Didi, Bibi | research, sorting, summaries, reports, reply drafts |
   | Sonnet (middle) | Vivi, Remy, Margot, Cleo, Elise | designing, building, writing, videos, checking |
   | Opus (strongest) | anyone, rarely | only hard builds or architecture, or when Sonnet already failed; never routine work; off on Pro |
2. **Budget per House every day**, with the 70 / 20 / 10 split: normal work / important work / emergency reserve.
3. **Small, exact tasks**: each helper gets only the files and facts it needs and a clear expected result.
4. **Reuse before redo**: templates, the Shared Shelf and saved research first; nothing is made twice.
5. **No loops**: the same task at most 3 times a day; a task using 3x its usual tokens is stopped and reported.
6. **Watch the limit**: when Claude shows a usage warning, only important work runs until the reset.
7. **Fewest helpers that can do the job**; a member works only when a House asks.
8. **Weekly token report by Bibi**: which House and member used what, and what to make cheaper next week.

## Rough daily budgets (starting points, tuned by Bibi's weekly report)
| Plan | Tokens a day | Opus | Houses active |
|---|---|---|---|
| Pro | about 400k | off | Gigi + Lulu, small tasks |
| Max 5x | about 2M | hard work only | 2 to 3 |
| Max 20x | about 8M | allowed for big builds | all 4 |
