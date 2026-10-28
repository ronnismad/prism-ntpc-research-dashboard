# Eight-quarter generation replay

Study prepared 29 October 2026. Scope: eight selected NTPC thermal stations. Period: Q1 FY25 through Q4 FY26. This is an availability-proxy retrospective replay, not a stock-return test or a verified first-seen historical data archive.

## Main result

At the fixed day-60 research cutoff, run-rate MAPE is **1.50%**, seasonal-profile MAPE is **2.20%**, and unchanged prior-year-total MAPE is **5.24%**. Run rate beats the seasonal profile in **5/8 quarters**.

Run-rate MAE is 0.581 BU versus 0.870 BU for the seasonal profile. Mean signed percentage error is 0.72%. Direction of year-on-year generation change is correct in 8/8 quarters. This measures generation direction, not share-price direction.

## Cutoff sensitivity

| Forecast cutoff | Observed days | Quarters | Run-rate MAPE | Seasonal-profile MAPE | Prior-year-total MAPE | Wins vs seasonal profile |
| --- | --- | --- | --- | --- | --- | --- |
| Day 45 | 40 | 8 | 2.66% | 2.89% | 5.24% | 5/8 |
| Day 60 | 55 | 8 | 1.50% | 2.20% | 5.24% | 5/8 |
| Day 75 | 70 | 8 | 0.66% | 0.88% | 5.24% | 5/8 |

These are repeated cutoffs across eight distinct quarters, not 24 independent test periods.

## Per-quarter day-60 results

| Quarter | Actual BU | Run-rate BU | Seasonal-profile BU | Run-rate APE | Seasonal APE |
| --- | --- | --- | --- | --- | --- |
| Q1 FY25 | 42.98 | 43.41 | 42.21 | 0.996% | 1.799% |
| Q2 FY25 | 39.04 | 39.31 | 40.44 | 0.692% | 3.586% |
| Q3 FY25 | 42.13 | 42.69 | 42.40 | 1.347% | 0.646% |
| Q4 FY25 | 42.60 | 42.60 | 43.88 | 0.007% | 3.019% |
| Q1 FY26 | 39.11 | 40.18 | 39.79 | 2.747% | 1.733% |
| Q2 FY26 | 35.69 | 36.80 | 36.55 | 3.107% | 2.399% |
| Q3 FY26 | 38.36 | 37.16 | 36.67 | 3.115% | 4.402% |
| Q4 FY26 | 39.81 | 39.81 | 39.81 | 0.004% | 0.010% |

All 48 planned reports were captured. No quarters are excluded for these three all-state comparisons. CSVs preserve full-precision values, source filenames and cutoffs.

## Interpretation

The unchanged prior-year baseline is weak when operations shift. The stronger seasonal profile uses the same current QTD observation, scaled by the prior year's full-quarter/QTD ratio. Run rate wins on average, but the seasonal profile wins in 3 of 8 quarters at day 60. Small differences between nearly equal estimates should not be treated as economically meaningful model skill.

The last studied quarter's sample generation changed by -6.54% year on year. This is historical operating evidence, not a conclusion about NTPC's current share valuation or its full consolidated business.

## Assumptions and limitations

- Captured reports on quarter days 40, 55 and 70 serve fixed research cutoffs on days 45, 60 and 75. The latest captured report passing the cutoff is used. This is not an exhaustive daily archive.
- Availability is one day after the PDF's printed generation date. It does not prove the report first became public then or preserve every subsequent revision. File hashes preserve the downloaded files.
- Quarter totals subtract fiscal cumulative endpoints. April quarters reset to zero. Revisions can alter cumulative differences.
- The same station IDs are retained throughout. Missing required baselines or outcomes explicitly exclude dependent comparisons.
- No coefficients are fitted and no horizon is selected to maximize performance. Day 60 is the main comparison; all three fixed cutoffs remain visible.
- Eight selected stations and eight quarters are a small, nonrandom sample. The observed part of the quarter is already known, and forecasts are correlated across cutoffs.
- No statistical significance, durable predictive edge, return backtest, valuation conclusion or whole-company inference is established.

## Investment research use

The decision view combines a separately dated consolidated financial snapshot with the operating research. Audited FY26, limited-review Q1 FY27 and an October 2026 NSE close support earnings, cash, debt and valuation analysis. These later financial inputs never enter historical generation predictions. A conditional price screen uses editable earnings haircuts, P/E and safety margins; its defaults are illustrative, not an investment-return model. See the README financial methodology for cash-interest classification, tax effects and remaining research questions.

## Reproduction

Run `npm test`, `npm run study:export`, and `npm run build`. Optional PDF recapture: install pypdf and run `python scripts/ingest_backtest.py`. Existing source files are reused to preserve the captured bytes.

## Remaining-period error

At day 60, 55 days of output are already observed. On only the remaining unobserved output, run-rate MAPE is **3.81%**, versus **5.54%** for the seasonal profile. The 1.50% headline measures full-quarter error, including the known part of the quarter. Neither measure is a probability of a correct investment decision.
