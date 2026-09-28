// utils/dateHelpers.ts

/** Retorna a data de hoje em formato YYYY-MM-DD (ISO) */
export function getTodayISO(): string {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

/** Retorna a hora atual em formato HH:MM */
export function getNowTime(): string {
  const now = new Date()
  return now.toTimeString().slice(0, 5) // ex: '14:30'
}

export function getNowTimeRounded() {
    const now = new Date()
    const hours = now.getHours().toString().padStart(2, '0')
    return `${hours}:00`
}

/** Retorna uma string HH:MM representando uma hora após o horário passado (HH:MM) */
export function getTimePlusOneHour(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const date = new Date()
  date.setHours(hours)
  date.setMinutes(minutes)
  date.setSeconds(0)
  date.setMilliseconds(0)
  date.setTime(date.getTime() + 60 * 60 * 1000) // +1h
  return date.toTimeString().slice(0, 5)
}
