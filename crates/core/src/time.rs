//! Local calendar arithmetic with the semantics of JavaScript's `Date`
//! constructor (month and day overflow roll over), used by the query parser,
//! the date filters and the date grouping.

use chrono::{DateTime, Datelike, Duration, Local, LocalResult, NaiveDate, TimeZone};

/// Calendar fields of a local time. `month0` is zero based like in JavaScript.
#[derive(Clone, Copy, Debug)]
pub(crate) struct LocalParts {
    pub year: i32,
    pub month0: i32,
    pub day: i32,
    /// 0 = Sunday … 6 = Saturday.
    pub weekday: u32,
}

pub(crate) fn local_parts(ms: i64) -> LocalParts {
    let time: DateTime<Local> = Local.timestamp_millis_opt(ms).earliest().unwrap_or_else(|| Local.timestamp_millis_opt(0).unwrap());
    LocalParts { year: time.year(), month0: time.month0() as i32, day: time.day() as i32, weekday: time.weekday().num_days_from_sunday() }
}

/// Local midnight (epoch ms) of a date given like `new Date(year, month0, day)`:
/// months and days outside their range roll over into the neighbouring
/// months and years.
pub(crate) fn local_date(year: i32, month0: i32, day: i32) -> i64 {
    let year = year + month0.div_euclid(12);
    let month = month0.rem_euclid(12) as u32 + 1;
    let Some(first) = NaiveDate::from_ymd_opt(year, month, 1) else {
        return 0;
    };
    let Some(date) = first.checked_add_signed(Duration::days(i64::from(day) - 1)) else {
        return 0;
    };
    local_midnight(date)
}

fn local_midnight(date: NaiveDate) -> i64 {
    let midnight = date.and_hms_opt(0, 0, 0).expect("valid time");
    match Local.from_local_datetime(&midnight) {
        LocalResult::Single(t) => t.timestamp_millis(),
        LocalResult::Ambiguous(earliest, _) => earliest.timestamp_millis(),
        // Midnight skipped by a daylight saving change: the day starts an hour later.
        LocalResult::None => Local.from_local_datetime(&(midnight + Duration::hours(1))).earliest().map_or(0, |t| t.timestamp_millis()),
    }
}

/// Validated local date, None if the fields do not form a real date.
pub(crate) fn exact_local_date(year: i32, month: u32, day: u32) -> Option<i64> {
    NaiveDate::from_ymd_opt(year, month, day).map(local_midnight)
}

pub(crate) fn start_of_day(ms: i64) -> i64 {
    let p = local_parts(ms);
    local_date(p.year, p.month0, p.day)
}

/// The local midnight `days` days after the day of `ms`.
pub(crate) fn add_days(ms: i64, days: i32) -> i64 {
    let p = local_parts(ms);
    local_date(p.year, p.month0, p.day + days)
}

/// Converts a Windows FILETIME (100 ns intervals since 1601) to epoch ms.
/// Returns None for unset (zero) and clearly invalid values.
pub(crate) fn filetime_to_ms(filetime: i64) -> Option<i64> {
    const FILETIME_UNIX_EPOCH_MS: i64 = 11_644_473_600_000;
    let ms = filetime / 10_000 - FILETIME_UNIX_EPOCH_MS;
    (ms > 0 && ms < 8_000_000_000_000).then_some(ms)
}

/// ISO 8601 representation in UTC, as JavaScript's `toISOString()`.
pub(crate) fn iso_string(ms: i64) -> String {
    match chrono::Utc.timestamp_millis_opt(ms).single() {
        Some(t) => t.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string(),
        None => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rolls_over_like_javascript() {
        assert_eq!(local_date(2024, 12, 1), local_date(2025, 0, 1));
        assert_eq!(local_date(2024, 2, 0), local_date(2024, 1, 29));
        assert_eq!(local_date(2024, 0, -1), local_date(2023, 11, 30));
    }

    #[test]
    fn converts_filetime() {
        assert_eq!(filetime_to_ms(116_444_736_000_000_000 + 10_000), Some(1));
        assert_eq!(filetime_to_ms(0), None);
    }
}
