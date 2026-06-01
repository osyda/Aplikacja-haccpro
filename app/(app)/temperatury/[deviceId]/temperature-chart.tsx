'use client'

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Legend,
} from 'recharts'
import { formatDateTime } from '@/lib/utils'

interface TemperatureLog {
  measured_at: string
  temperature: number
  min_ok: number
  max_ok: number
}

interface TemperatureChartProps {
  logs: TemperatureLog[]
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const ok = d.temperature >= d.min_ok && d.temperature <= d.max_ok
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="text-gray-500 text-xs">{formatDateTime(d.fullDate)}</p>
      <p className={`font-bold text-lg font-mono ${ok ? 'text-gray-900' : 'text-red-600'}`}>
        {d.temperature}°C
      </p>
      <p className="text-xs text-gray-400">Norma: {d.min_ok}–{d.max_ok}°C</p>
      {!ok && <p className="text-xs text-red-600 font-medium">⚠ ALARM</p>}
    </div>
  )
}

export function TemperatureChart({ logs }: TemperatureChartProps) {
  if (logs.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
        Za mało danych do wykresu (minimum 2 pomiary)
      </div>
    )
  }

  const data = [...logs].reverse().map((log) => ({
    time: new Date(log.measured_at).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    fullDate: log.measured_at,
    temperature: log.temperature,
    min_ok: log.min_ok,
    max_ok: log.max_ok,
  }))

  const minOk = logs[0].min_ok
  const maxOk = logs[0].max_ok
  const allTemps = data.map((d) => d.temperature)
  const yMin = Math.min(...allTemps, minOk) - 2
  const yMax = Math.max(...allTemps, maxOk) + 2

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}°`}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={minOk} stroke="#2ECC71" strokeDasharray="4 4" strokeWidth={1.5} />
          <ReferenceLine y={maxOk} stroke="#2ECC71" strokeDasharray="4 4" strokeWidth={1.5} />
          <Line
            type="monotone"
            dataKey="temperature"
            stroke="#1B2E4B"
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload } = props
              const ok = payload.temperature >= payload.min_ok && payload.temperature <= payload.max_ok
              return (
                <circle
                  key={`dot-${cx}-${cy}`}
                  cx={cx}
                  cy={cy}
                  r={4}
                  fill={ok ? '#2ECC71' : '#ef4444'}
                  stroke="white"
                  strokeWidth={1.5}
                />
              )
            }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
