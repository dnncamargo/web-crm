'use client'

import { useEffect } from 'react'

type CalendarEventCreatorProps = {
  allDay: boolean
  setAllDay: (value: boolean) => void
  startDate: string
  setStartDate: (value: string) => void
  endDate: string
  setEndDate: (value: string) => void
  startTime?: string
  setStartTime?: (value: string) => void
  endTime?: string
  setEndTime?: (value: string) => void
  error?: string
  setError?: (value: string) => void
}

export default function CalendarEventCreator({
  allDay,
  setAllDay,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  startTime = '',
  setStartTime = () => {},
  endTime = '',
  setEndTime = () => {},
  error = '',
  setError = () => {},
}: CalendarEventCreatorProps) {
  useEffect(() => {
    validateTimes()
  }, [startDate, startTime, endDate, endTime, allDay])

  const validateTimes = () => {
    if (allDay) {
      if (endDate < startDate) {
        setEndDate(startDate)
      }
      setStartTime('')
      setEndTime('')
      setError('')
      return
    }

    const start = new Date(`${startDate}T${startTime}`)
    const end = new Date(`${endDate}T${endTime}`)

    if (start >= end) {
      const newEnd = new Date(start.getTime() + 30 * 60000)
      setEndDate(newEnd.toISOString().split('T')[0])
      setEndTime(newEnd.toTimeString().slice(0, 5))
      setError('')
    } else {
      setError('')
    }
  }

  const handleStartTimeChange = (value: string) => {
    setStartTime(value)

    const start = new Date(`${startDate}T${value}`)
    const currentEnd = new Date(`${endDate}T${endTime}`)

    if (!endTime || start >= currentEnd) {
      const newEnd = new Date(start.getTime() + 30 * 60000)
      setEndDate(newEnd.toISOString().split('T')[0])
      setEndTime(newEnd.toTimeString().slice(0, 5))
    }
  }

  return (
    <div className="space-y-2">
      {/* Switch All-Day */}
      <div className="flex justify-between items-center">
        <span>Dia inteiro</span>
        <button
          type="button"
          onClick={() => setAllDay(!allDay)}
          className={`w-12 h-6 rounded-full transition flex items-center p-1 ${allDay ? 'bg-blue-500' : 'bg-gray-300'}`}
        >
          <div
            className={`bg-white w-4 h-4 rounded-full shadow transform transition ${allDay ? 'translate-x-6' : 'translate-x-0'}`}
          />
        </button>
      </div>

      {/* Início */}
      <div className="flex items-center gap-2">
        <span className="w-20">Início</span>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="flex-1 p-2 border rounded"
        />
        {!allDay && (
          <input
            type="time"
            step="300"
            value={startTime}
            onChange={(e) => handleStartTimeChange(e.target.value)}
            className="w-24 p-2 border rounded"
          />
        )}
      </div>

      {/* Término */}
      <div className="flex items-center gap-2">
        <span className="w-20">Término</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className={`flex-1 p-2 border rounded ${error && 'border-red-500'}`}
        />
        {!allDay && (
          <input
            type="time"
            step="300"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={`w-24 p-2 border rounded ${error && 'border-red-500'}`}
          />
        )}
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  )
}
