'use client'

import useEventDate from '../../hooks/useEventDate'

type CalendarEventCreatorProps = ReturnType<typeof useEventDate>

export default function CalendarEventCreator({
  allDay,  setAllDay,
  startDate,  setStartDate,
  endDate,  setEndDate,
  startTime = '',  
  endTime = '',  setEndTime = () => {},
  handleStartTimeChange
}: CalendarEventCreatorProps) {
 
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
          className={`flex-1 p-2 border rounded `}
        />
        {!allDay && (
          <input
            type="time"
            step="300"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={`w-24 p-2 border rounded `}
          />
        )}
      </div>
    </div>
  )
}
