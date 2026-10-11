#!/usr/bin/env python3
"""Sales trend + forecast for the Fool's Errand card, from the Sales sheet's Daily tab.

  python3 tools/fe_trend.py DAILY.json YYYY-MM-DD
      DAILY.json = [["2026-10-10", 5808.78], ...]  (date, net sales) — every row of the Daily tab
      date       = yesterday (the last day to count)
Prints {"trend": {...}, "forecast": {...}} for brief.fe_yesterday. Facts only:
  trend    = last 7 / 28 days vs the 7 / 28 before, and vs the same 28 days a year ago (weekday-aligned)
  forecast = each upcoming day = average of the last 4 same weekdays, scaled by how last year's
             same stretch compared with the 4 weeks before it (capped at ±25%); range = ±10% / ±12%.
"""
import datetime as dt, json, sys

D = lambda s: dt.date.fromisoformat(s)


def main(path, asof):
    rows = json.load(open(path))
    net = {}
    for d, v in rows:
        try:
            net[D(str(d)[:10])] = float(str(v).replace('$', '').replace(',', ''))
        except ValueError:
            pass
    a = D(asof)
    def tot(end, n):
        days = [end - dt.timedelta(i) for i in range(n)]
        have = [net[x] for x in days if x in net]
        return round(sum(have), 2), len(have)
    def pct(x, y):
        return round((x - y) / y * 100, 1) if y else None
    l7, _ = tot(a, 7); p7, _ = tot(a - dt.timedelta(7), 7)
    l28, _ = tot(a, 28); p28, _ = tot(a - dt.timedelta(28), 28)
    ly28, n_ly = tot(a - dt.timedelta(364), 28)
    trend = {'last7': l7, 'prior7': p7, 'pct7': pct(l7, p7), 'last28': l28, 'prior28': p28, 'pct28': pct(l28, p28),
             'yoy28_pct': pct(l28, ly28) if n_ly >= 20 else None, 'last_year28': ly28 if n_ly >= 20 else None}

    def base(day):
        past = [net[day - dt.timedelta(7 * k)] for k in range(1, 5) if day - dt.timedelta(7 * k) in net]
        past = [x for x in past if x > 0]
        return sum(past) / len(past) if past else 0.0
    def season(n):
        # last year's next-n days vs last year's trailing 28 days (per day), weekday-aligned
        ly_next = [net.get(a + dt.timedelta(i) - dt.timedelta(364)) for i in range(1, n + 1)]
        ly_prev = [net.get(a - dt.timedelta(i) - dt.timedelta(364)) for i in range(28)]
        ly_next = [x for x in ly_next if x is not None]; ly_prev = [x for x in ly_prev if x is not None]
        if len(ly_next) < n * 0.7 or len(ly_prev) < 20:
            return 1.0, False
        f = (sum(ly_next) / len(ly_next)) / (sum(ly_prev) / len(ly_prev))
        return max(0.75, min(1.25, f)), True
    def fc(n, band):
        days = [a + dt.timedelta(i) for i in range(1, n + 1)]
        raw = sum(base(x) for x in days)
        f, used = season(n)
        t = raw * f
        return {'from': str(days[0]), 'to': str(days[-1]), 'total': round(t), 'low': round(t * (1 - band)), 'high': round(t * (1 + band)),
                'seasonal_adj_pct': round((f - 1) * 100, 1) if used else None}
    forecast = {'next7': fc(7, .10), 'next30': fc(30, .12),
                'basis': 'Average of the last 4 same weekdays, adjusted by how the same weeks went last year.'}
    print(json.dumps({'trend': trend, 'forecast': forecast}, indent=1))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
