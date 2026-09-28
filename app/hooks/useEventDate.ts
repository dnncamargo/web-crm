// hooks/useEventDate.ts
import { useEffect, useState } from 'react'
import { getTodayISO, getNowTimeRounded, getTimePlusOneHour } from '../utils/dateHelpers'

export default function useEventDate(initial?: {
    allDay?: boolean
    startDate?: string
    endDate?: string
    startTime?: string
    endTime?: string
}) {
    const today = getTodayISO()
    const now = getNowTimeRounded()
    const timeZone = 'America/Sao_Paulo'

    const [allDay, setAllDay] = useState(initial?.allDay ?? false)
    const [startDate, setStartDate] = useState(initial?.startDate ?? today)
    const [endDate, setEndDate] = useState(initial?.endDate ?? today)
    const [startTime, setStartTime] = useState(initial?.startTime ?? now)
    const [endTime, setEndTime] = useState(initial?.endTime ?? getTimePlusOneHour(now))
    const [error, setError] = useState('')

    // 🔥 Efeito que garante consistência ao alternar allDay
    useEffect(() => {
        if (!allDay) {
            if (!startTime) {
                const now = getNowTimeRounded();
                setStartTime(now);
                setEndTime(getTimePlusOneHour(now));
            }
        }
    }, [allDay]);

    useEffect(() => {
        correctEnd()
    }, [startDate, endDate, startTime, endTime, allDay])

    function correctEnd() {
        if (allDay) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (end < start) {
                setEndDate(startDate);
            }
            setStartTime('');
            setEndTime('');
            setError('');
        } else {
            const start = new Date(`${startDate}T${startTime}`);
            const end = new Date(`${endDate}T${endTime}`);

            // Se end é anterior ao start no mesmo dia, OU se a data de término é antes da de início, ajusta.
            if (endDate < startDate || (startDate === endDate && start >= end)) {
                const newEnd = new Date(start.getTime() + 30 * 60000);
                setEndDate(newEnd.toISOString().split('T')[0]);
                setEndTime(newEnd.toTimeString().slice(0, 5));
            }
            setError('');
        }
    }

    function handleStartTimeChange(value: string) {
        setStartTime(value)

        const start = new Date(`${startDate}T${value}`)
        const currentEnd = new Date(`${endDate}T${endTime}`)

        if (!endTime || start > currentEnd) {
            const newEnd = new Date(start.getTime() + 30 * 60000)
            setEndDate(newEnd.toISOString().split('T')[0])
            setEndTime(newEnd.toTimeString().slice(0, 5))
        }
    }

    function getNextDay(dateStr: string): string {
        const date = new Date(dateStr)
        date.setDate(date.getDate() + 1)
        return date.toISOString().split('T')[0]
    }

    function getGoogleCalendarFormat() {
        const tzOffset = '-03:00'
        const pad = (t: string) => t.padStart(5, '0')

        if (allDay) {
            return {
                start: { date: startDate },
                end: { date: getNextDay(endDate) }, // Google Calendar usa endDate como "não incluso"
            }
        }

        return {
            start: {
                dateTime: `${startDate}T${pad(startTime)}${tzOffset}`,
                timeZone: timeZone
            },
            end: {
                dateTime: `${endDate}T${pad(endTime)}${tzOffset}`,
                timeZone: timeZone
            },
        }
    }

    return {
        allDay, setAllDay,
        startDate, setStartDate,
        endDate, setEndDate,
        startTime, setStartTime,
        endTime, setEndTime,
        timeZone,
        error, setError,
        handleStartTimeChange,
        correctEnd,
        getNextDay,
        getGoogleCalendarFormat,
    }
}
