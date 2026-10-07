package de.kernich.pstviewer.util

import android.icu.text.DateFormat
import android.icu.text.MeasureFormat
import android.icu.text.NumberFormat
import android.icu.text.RelativeDateTimeFormatter
import android.icu.util.Measure
import android.icu.util.MeasureUnit
import android.icu.util.ULocale
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import java.util.Date
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToLong

/**
 * Locale aware formatting of dates, sizes and numbers, mirroring the desktop
 * app's lib/format.ts (ICU skeletons instead of Intl options).
 */
class Formatter(val locale: Locale, private val is24Hour: Boolean, private val zone: ZoneId = ZoneId.systemDefault()) {
    private val uLocale = ULocale.forLocale(locale)
    private val formats = HashMap<String, DateFormat>()
    private val relative by lazy { RelativeDateTimeFormatter.getInstance(uLocale) }
    private val numbers by lazy { NumberFormat.getIntegerInstance(locale) }
    private val timeSkeleton = if (is24Hour) "HHmm" else "hmm"

    private fun format(skeleton: String, time: Long): String {
        val format = formats.getOrPut(skeleton) { DateFormat.getInstanceForSkeleton(skeleton, locale) }
        return format.format(Date(time))
    }

    private fun localDate(time: Long): LocalDate = Instant.ofEpochMilli(time).atZone(zone).toLocalDate()

    /** Compact date for message lists: time today, weekday this week, date otherwise. */
    fun listDate(time: Long, now: Long = System.currentTimeMillis()): String {
        if (time == 0L) return ""
        val day = localDate(time)
        val today = localDate(now)
        val days = ChronoUnit.DAYS.between(day, today)
        return when {
            days == 0L -> time(time)
            days == 1L -> relative.format(RelativeDateTimeFormatter.Direction.LAST, RelativeDateTimeFormatter.AbsoluteUnit.DAY)
                .replaceFirstChar { it.titlecase(locale) }
            days in 2..6 -> format("EEEE", time)
            day.year == today.year -> format("dMMM", time)
            else -> format("ddMMyy", time)
        }
    }

    /** Full date and time, e.g. "Montag, 22. September 2025 um 08:27". */
    fun fullDate(time: Long?): String = if (time == null || time == 0L) "" else format("EEEEdMMMMy$timeSkeleton", time)

    fun date(time: Long?): String = if (time == null || time == 0L) "" else format("dMMMMy", time)

    fun shortDate(time: Long?): String = if (time == null || time == 0L) "" else format("ddMMy", time)

    fun time(time: Long?): String = if (time == null || time == 0L) "" else format(timeSkeleton, time)

    /** Month of a date group, with the year unless it is the current one. */
    fun month(year: Int, month: Int, now: Long = System.currentTimeMillis()): String {
        val first = LocalDate.of(year, month, 1).atStartOfDay(zone).toInstant().toEpochMilli()
        return if (year == localDate(now).year) format("MMMM", first) else format("MMMMy", first)
    }

    /** Appointment range, collapsing the date if start and end are on the same day. */
    fun range(start: Long?, end: Long?, allDay: Boolean): String {
        if (start == null || start == 0L) return ""
        if (allDay) {
            val last = if (end != null && end > 0) end - 1 else start
            if (end == null || localDate(start) == localDate(last)) return date(start)
            return "${date(start)} – ${date(last)}"
        }
        if (end == null || end == 0L) return fullDate(start)
        if (localDate(start) == localDate(end)) return "${fullDate(start)} – ${time(end)}"
        return "${fullDate(start)} – ${fullDate(end)}"
    }

    /** "vor 3 Tagen", "gestern", "now", … like Intl.RelativeTimeFormat with numeric: 'auto'. */
    fun relative(time: Long, now: Long = System.currentTimeMillis()): String {
        val seconds = (time - now) / 1000.0
        val amount = abs(seconds)
        val direction = if (seconds < 0) RelativeDateTimeFormatter.Direction.LAST else RelativeDateTimeFormatter.Direction.NEXT
        fun numeric(value: Double, unit: RelativeDateTimeFormatter.RelativeUnit) = relative.format(value.roundToLong().toDouble(), direction, unit)
        fun auto(value: Double, unit: RelativeDateTimeFormatter.RelativeUnit, absolute: RelativeDateTimeFormatter.AbsoluteUnit): String =
            if (value.roundToLong() == 1L) relative.format(direction, absolute) else numeric(value, unit)
        return when {
            amount < 60 -> relative.format(RelativeDateTimeFormatter.Direction.PLAIN, RelativeDateTimeFormatter.AbsoluteUnit.NOW)
            amount < 3600 -> numeric(amount / 60, RelativeDateTimeFormatter.RelativeUnit.MINUTES)
            amount < 86_400 -> numeric(amount / 3600, RelativeDateTimeFormatter.RelativeUnit.HOURS)
            amount < 86_400 * 30 -> auto(amount / 86_400, RelativeDateTimeFormatter.RelativeUnit.DAYS, RelativeDateTimeFormatter.AbsoluteUnit.DAY)
            amount < 86_400 * 365 -> auto(amount / (86_400 * 30), RelativeDateTimeFormatter.RelativeUnit.MONTHS, RelativeDateTimeFormatter.AbsoluteUnit.MONTH)
            else -> auto(amount / (86_400 * 365), RelativeDateTimeFormatter.RelativeUnit.YEARS, RelativeDateTimeFormatter.AbsoluteUnit.YEAR)
        }
    }

    fun size(bytes: Long): String {
        if (bytes < 0) return ""
        var value = bytes.toDouble()
        var unit = 0
        while (value >= 1024 && unit < SIZE_UNITS.size - 1) {
            value /= 1024
            unit++
        }
        val number = NumberFormat.getInstance(locale).apply {
            maximumFractionDigits = if (unit == 0 || value >= 100) 0 else 1
        }
        return MeasureFormat.getInstance(uLocale, MeasureFormat.FormatWidth.SHORT, number).format(Measure(value, SIZE_UNITS[unit]))
    }

    fun number(value: Long): String = numbers.format(value)

    private companion object {
        val SIZE_UNITS: List<MeasureUnit> = listOf(MeasureUnit.BYTE, MeasureUnit.KILOBYTE, MeasureUnit.MEGABYTE, MeasureUnit.GIGABYTE, MeasureUnit.TERABYTE)
    }
}
