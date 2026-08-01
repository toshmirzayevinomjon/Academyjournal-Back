from calendar import monthrange
from datetime import date, timedelta
from typing import List

WEEKDAY_MAP = {
    "MON": 0,
    "TUE": 1,
    "WED": 2,
    "THU": 3,
    "FRI": 4,
    "SAT": 5,
    "SUN": 6,
}


def get_group_dates_for_month(group_days: List[str], year: int, month: int) -> List[date]:
    active_weekdays = {WEEKDAY_MAP[day.strip().upper()] for day in group_days if day.strip().upper() in WEEKDAY_MAP}
    if not active_weekdays:
        return []

    days_in_month = monthrange(year, month)[1]
    first_day = date(year, month, 1)

    return [
        first_day + timedelta(days=offset)
        for offset in range(days_in_month)
        if (first_day + timedelta(days=offset)).weekday() in active_weekdays
    ]
