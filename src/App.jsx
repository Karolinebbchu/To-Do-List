// ============================================================
// 每日習慣追蹤器 - App.jsx
// 後端：Supabase (Auth + Database)
// 登入方式：Email + 密碼（個人專屬，信箱寫死）
// 資料表：public.tasks (user_id, name, description,
//          target_days, reminder_times, history, created_at)
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, Trash2, X, CheckCircle2, Circle,
  BarChart3, Settings, Bell, BellOff,
  Calendar, Target, TrendingUp, Award, Clock, LogOut, Loader2, Lock, KeyRound,
  ChevronRight, AlarmClock, Link2, Info, CalendarDays, NotebookPen, Save, CloudOff,
  Download, Upload, Mail, DatabaseBackup, RefreshCw, Send,
} from 'lucide-react'
import { supabase } from './supabaseClient'

// ─── 登入帳號（Supabase Auth 帳號） ─────────────────────────
const LOGIN_EMAIL = 'bb@bb.com'
// ─── 備份信件收件信箱 ────────────────────────────────────────
const MY_EMAIL = 'tsangbobo49@gmail.com'
// ─── Web Push VAPID 公鑰（公開，不需保密）────────────────────
const VAPID_PUBLIC_KEY = 'BJ9MNTgIbXGNB5_CyScg171ET4uGxyTqI01U8aiGgNX3oxY0iiyH97MY6D86eYGj1Ri2ebikjWlyqCTB7liafZM'

// ─── 常數 ────────────────────────────────────────────────────
const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAYS_ZH = { Mon: '一', Tue: '二', Wed: '三', Thu: '四', Fri: '五', Sat: '六', Sun: '日' }
const DAY_KEYS = DAYS_OF_WEEK
const DAY_LABELS = { Mon: '週一', Tue: '週二', Wed: '週三', Thu: '週四', Fri: '週五', Sat: '週六', Sun: '週日' }

function getTodayKey() {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()]
}
function getDateStr(date = new Date()) {
  // Use local (HKT) timezone so history keys match the notification script
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ─── 取得特定星期幾的提醒時間 ────────────────────────────────
// reminderTimes 可能是：
//   ['08:00','20:00']           → 舊格式，所有天相同
//   { Mon:['08:00'], Tue:['20:00'], ... } → 新格式，各天不同
function getTimesForDay(reminderTimes, dayKey) {
  if (!reminderTimes) return []
  if (Array.isArray(reminderTimes)) return reminderTimes
  return reminderTimes[dayKey] || []
}

// ─── 每個時間點獨立打卡 ───────────────────────────────────────
// history[date] 可能是：
//   true        → 舊格式，視為全部完成
//   ['08:00']   → 新格式，已完成的時間點陣列
//   undefined   → 未完成
function isTimeCompleted(task, date, time) {
  const val = task.history[date]
  if (val === true) return true
  if (Array.isArray(val)) return val.includes(time)
  return false
}
function isAllCompleted(task, date, dayKey) {
  const times = getTimesForDay(task.reminderTimes, dayKey)
  if (!times.length) return !!task.history[date]
  return times.every(t => isTimeCompleted(task, date, t))
}
function completedCount(task, date, dayKey) {
  return getTimesForDay(task.reminderTimes, dayKey).filter(t => isTimeCompleted(task, date, t)).length
}

// ─── Supabase row → App 內部格式（snake_case → camelCase） ──
function mapTask(row) {
  return {
    id:                row.id,
    name:              row.name,
    description:       row.description        || '',
    targetDays:        row.target_days        || [],
    reminderTimes:     row.reminder_times     || [],
    history:           row.history            || {},
    persistentReminder: row.persistent_reminder || false,
    repeatInterval:     row.repeat_interval     || 2,   // minutes between persistent reminders
  }
}

// ─── 超連結解析（偵測 http/https:// 或 www. 開頭的連結） ──────
const URL_REGEX = /((?:https?:\/\/|www\.)[^\s]+)/g

function LinkPill({ raw }) {
  const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  let label
  try { label = new URL(href).hostname } catch { label = raw }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 bg-violet-100 hover:bg-violet-200 active:scale-95 text-violet-700 font-medium text-xs px-3 py-1.5 rounded-full transition-all cursor-pointer my-0.5 mr-1 no-underline"
    >
      <Link2 size={11} />
      {label}
    </a>
  )
}

function parseLinks(text) {
  if (!text) return null
  const parts = text.split(URL_REGEX)
  return parts.map((part, i) => {
    const isUrl = /^(?:https?:\/\/|www\.)/i.test(part)
    if (isUrl) return <LinkPill key={i} raw={part} />
    return part
  })
}

// ============================================================
// 子組件：密碼鎖定畫面
// ============================================================
function LoginScreen({ onLogin, loading }) {
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!password) return
    setError('')
    const err = await onLogin(password)
    if (err) {
      setError(err.message || '密碼錯誤，請再試一次')
      setPassword('')
      inputRef.current?.focus()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-xs text-center">
        <div className="relative mx-auto mb-8 w-fit">
          <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto backdrop-blur-sm">
            <Lock size={34} className="text-white/80" />
          </div>
          <div className="absolute inset-0 rounded-full border border-white/5 scale-125" />
        </div>
        <h1 className="text-white text-xl font-semibold tracking-wide mb-1">每日習慣追蹤</h1>
        <p className="text-white/30 text-sm mb-10">輸入密碼以解鎖</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            placeholder="••••••••"
            className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 rounded-2xl px-5 py-4 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
            autoComplete="current-password"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-white text-gray-900 rounded-2xl py-4 font-semibold text-base hover:bg-white/90 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
            {loading ? '解鎖中...' : '解鎖'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// 子組件：Toast
// ============================================================
function ToastList({ toasts, onRemove }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="toast-enter bg-white border-l-4 border-orange-500 rounded-lg shadow-xl p-4 flex items-start gap-3 pointer-events-auto">
          <Bell className="text-orange-500 mt-0.5 shrink-0" size={18} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">習慣提醒</p>
            <p className="text-sm text-gray-600 mt-0.5">{t.message}</p>
          </div>
          <button onClick={() => onRemove(t.id)} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// 子組件：通知權限橫幅
// ============================================================
function NotificationBanner({ permission, onRequest }) {
  if (permission === 'granted' || permission === 'denied') return null
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3 mb-4">
      <Bell className="text-amber-500 shrink-0" size={18} />
      <p className="text-sm text-amber-700 flex-1">開啟瀏覽器通知以獲得提醒</p>
      <button onClick={onRequest} className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors shrink-0 font-medium">
        允許通知
      </button>
    </div>
  )
}

// ============================================================
// 子組件：任務詳情視窗
// ============================================================
function TaskDetailModal({ task, onClose, onToggle }) {
  const todayStr = getDateStr()
  const todayKey = getTodayKey()
  const done = isAllCompleted(task, todayStr, todayKey)
  const parsedDesc = parseLinks(task.description)
  const dayNames = { Mon:'週一', Tue:'週二', Wed:'週三', Thu:'週四', Fri:'週五', Sat:'週六', Sun:'週日' }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* 浮動關閉按鈕：永遠固定在右上角，無論內容多長 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 bg-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg text-gray-500 hover:text-gray-800 transition-colors"
      >
        <X size={20} />
      </button>

      <div className="modal-enter relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
        {/* 頂部色條 */}
        <div className={`h-1.5 w-full shrink-0 ${done ? 'bg-emerald-400' : 'bg-gradient-to-r from-violet-500 to-indigo-500'}`} />

        {/* 標題列（固定，不捲動） */}
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3 shrink-0">
          <h2 className={`text-xl font-bold leading-snug pr-2 ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
            {task.name}
          </h2>
        </div>

        {/* 捲動區域 */}
        <div className="overflow-y-auto flex-1 px-6 pb-4">
          {/* 描述 + 連結 */}
          {task.description ? (
            <div className="bg-gray-50 rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                <Info size={12} /> 說明 / 連結
              </div>
              <div className="text-sm text-gray-600 leading-relaxed break-words whitespace-pre-wrap">
                {parsedDesc}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-2xl p-4 mb-4 text-center">
              <p className="text-sm text-gray-300">尚無說明或連結</p>
            </div>
          )}

          {/* 執行資訊 */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-violet-50 rounded-xl p-3">
              <p className="text-xs text-violet-400 font-medium mb-1">執行日期</p>
              <p className="text-sm text-violet-700 font-semibold">
                {task.targetDays.map(d => dayNames[d]).join('・')}
              </p>
            </div>
            <div className="bg-indigo-50 rounded-xl p-3">
              <p className="text-xs text-indigo-400 font-medium mb-1">提醒時間</p>
              {Array.isArray(task.reminderTimes) ? (
                <p className="text-sm text-indigo-700 font-semibold">{task.reminderTimes.join('、')}</p>
              ) : (
                <div className="space-y-1">
                  {DAY_KEYS.filter(d => task.reminderTimes[d]?.length).map(d => (
                    <p key={d} className="text-xs text-indigo-700">
                      <span className="font-semibold">{DAY_LABELS[d]}：</span>{task.reminderTimes[d].join('、')}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 持續提醒標籤 */}
          {task.persistentReminder && (
            <div className="flex items-center gap-2 bg-orange-50 text-orange-600 rounded-xl px-3 py-2 mb-4 text-sm font-medium">
              <AlarmClock size={15} />
              持續提醒模式：每 2 分鐘提醒一次，直到完成
            </div>
          )}
        </div>

        {/* 完成 / 取消按鈕（固定在底部） */}
        <div className="px-6 pb-6 pt-2 shrink-0 border-t border-gray-50">
          <button
            onClick={() => { onToggle(task.id, done); onClose() }}
            className={`w-full py-3.5 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all active:scale-95 ${
              done
                ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-200 hover:opacity-90'
            }`}
          >
            {done
              ? <><Circle size={18} /> 取消完成</>
              : <><CheckCircle2 size={18} /> 標記為完成</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 子組件：每日清單
// ============================================================
function DailyChecklist({ tasks, onToggleSlot, onOpenDetail, currentDate: _ }) {
  const todayKey = getTodayKey()
  const todayStr = getDateStr()
  const todayTasks = tasks.filter(t => t.targetDays.includes(todayKey))
  const dayNames = { Mon:'星期一', Tue:'星期二', Wed:'星期三', Thu:'星期四', Fri:'星期五', Sat:'星期六', Sun:'星期日' }
  const now = new Date()
  const dateLabel = `${now.getFullYear()} 年 ${now.getMonth()+1} 月 ${now.getDate()} 日・${dayNames[todayKey]}`

  // 統計進度：以時間槽為單位（每個任務取今天的時間槽）
  const totalSlots     = todayTasks.reduce((s, t) => s + getTimesForDay(t.reminderTimes, todayKey).length, 0)
  const completedSlots = todayTasks.reduce((s, t) => s + completedCount(t, todayStr, todayKey), 0)
  const percent = totalSlots > 0 ? Math.round((completedSlots / totalSlots) * 100) : 0

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-violet-200 text-sm font-medium">今日任務</p>
            <h2 className="text-white text-lg font-bold mt-0.5">{dateLabel}</h2>
          </div>
          <div className="text-right">
            <p className="text-violet-200 text-xs">完成度</p>
            <p className="text-white text-2xl font-bold">{percent}%</p>
          </div>
        </div>
        <div className="mt-4 bg-violet-400/30 rounded-full h-2">
          <div className="bg-white rounded-full h-2 transition-all duration-500" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-violet-200 text-xs mt-1.5">{completedSlots} / {totalSlots} 項完成</p>
      </div>

      <div className="divide-y divide-gray-50">
        {todayTasks.length === 0 ? (
          <div className="py-12 text-center">
            <Calendar className="mx-auto text-gray-300 mb-3" size={40} />
            <p className="text-gray-400 font-medium">今天沒有排定任務</p>
            <p className="text-gray-300 text-sm mt-1">點擊「設定目標」新增習慣</p>
          </div>
        ) : (
          todayTasks.map(task => {
            const todaySlotTimes = getTimesForDay(task.reminderTimes, todayKey)
            const allDone = isAllCompleted(task, todayStr, todayKey)
            const doneCount = completedCount(task, todayStr, todayKey)
            const multiSlot = todaySlotTimes.length > 1
            return (
              <div key={task.id}
                className={`px-4 py-3 transition-all ${allDone ? 'bg-green-50/50' : 'hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-3">
                  {/* 整體完成圖示（僅視覺，不可點） */}
                  <div className={`shrink-0 ${allDone ? 'text-green-500' : 'text-gray-200'}`}>
                    {allDone ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                  </div>

                  {/* 任務名稱：點擊開啟詳情 */}
                  <button onClick={() => onOpenDetail(task)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium truncate ${allDone ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                        {task.name}
                      </p>
                      {task.persistentReminder && <AlarmClock size={12} className="shrink-0 text-orange-400" />}
                    </div>
                    {task.description && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {task.description.slice(0, 40)}{task.description.length > 40 ? '…' : ''}
                      </p>
                    )}
                  </button>

                  {/* 右側狀態 */}
                  {multiSlot
                    ? <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${allDone ? 'bg-green-100 text-green-600' : doneCount > 0 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
                        {doneCount}/{todaySlotTimes.length}
                      </span>
                    : allDone
                      ? <span className="shrink-0 text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-medium">完成</span>
                      : <ChevronRight size={15} className="shrink-0 text-gray-300" />
                  }
                </div>

                {/* 時間槽按鈕：今天的提醒時間點獨立打卡 */}
                <div className="flex flex-wrap gap-2 mt-2 ml-9">
                  {todaySlotTimes.map(time => {
                    const slotDone = isTimeCompleted(task, todayStr, time)
                    return (
                      <button
                        key={time}
                        onClick={() => onToggleSlot(task.id, todayStr, time)}
                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all active:scale-95 ${
                          slotDone
                            ? 'bg-green-100 border-green-200 text-green-700'
                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-violet-300 hover:text-violet-600'
                        }`}
                      >
                        {slotDone ? <CheckCircle2 size={11} /> : <Circle size={11} />}
                        {time}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ============================================================
// 子組件：設定目標 Modal
// ============================================================
// editTask = 傳入現有任務時為「編輯模式」；defaultDays = 從週計畫頁開啟時預先選好的日期
function GoalModal({ tasks, onClose, onSave, onUpdate, onDelete, editTask = null, defaultDays = null }) {
  // Convert stored reminderTimes → editing time slots: [{ time, days[] }]
  function rtToSlots(rt, targetDays) {
    const days = targetDays || ['Mon','Tue','Wed','Thu','Fri']
    if (!rt || (Array.isArray(rt) && rt.length === 0)) return [{ time: '', days: [...days] }]
    if (Array.isArray(rt)) return rt.map(t => ({ time: t, days: [...days] }))
    // per-day object: group by shared days
    const timeMap = {}
    Object.entries(rt).forEach(([day, times]) => {
      times.forEach(t => { if (!timeMap[t]) timeMap[t] = []; timeMap[t].push(day) })
    })
    return Object.entries(timeMap).sort(([a],[b]) => a.localeCompare(b)).map(([time, ds]) => ({ time, days: ds }))
  }

  const initTargetDays = editTask?.targetDays || defaultDays || ['Mon','Tue','Wed','Thu','Fri']

  const [editId, setEditId]           = useState(editTask?.id || null)
  const [name, setName]               = useState(editTask?.name || '')
  const [description, setDescription] = useState(editTask?.description || '')
  const [selectedDays, setSelectedDays] = useState(initTargetDays)
  // Time slots: [{ time: '08:00', days: ['Mon','Tue'] }, ...]
  const [timeSlots, setTimeSlots]     = useState(() => rtToSlots(editTask?.reminderTimes, initTargetDays))
  const [persistentReminder, setPersistentReminder] = useState(editTask?.persistentReminder || false)
  const [repeatInterval, setRepeatInterval]         = useState(editTask?.repeatInterval || 2)
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)

  const isEditing = !!editId

  // Convert time slots back to storage format (array if all days same, else per-day object)
  function buildReminderTimes() {
    const obj = {}
    timeSlots.forEach(slot => {
      if (!slot.time) return
      slot.days.forEach(day => {
        if (!obj[day]) obj[day] = []
        if (!obj[day].includes(slot.time)) obj[day].push(slot.time)
      })
    })
    Object.keys(obj).forEach(d => obj[d].sort())
    const activeDays = selectedDays.filter(d => obj[d]?.length)
    if (activeDays.length === 0) return []
    const firstJson = JSON.stringify(obj[activeDays[0]])
    if (activeDays.length === selectedDays.length && activeDays.every(d => JSON.stringify(obj[d]) === firstJson))
      return obj[activeDays[0]] // simplify to array
    return obj
  }

  function loadTaskIntoForm(task) {
    setEditId(task.id); setName(task.name); setDescription(task.description || '')
    setSelectedDays(task.targetDays)
    setTimeSlots(rtToSlots(task.reminderTimes, task.targetDays))
    setPersistentReminder(task.persistentReminder || false)
    setRepeatInterval(task.repeatInterval || 2)
    setError('')
    document.getElementById('goal-form-top')?.scrollIntoView({ behavior: 'smooth' })
  }

  function resetForm() {
    setEditId(null); setName(''); setDescription('')
    const days = defaultDays || ['Mon','Tue','Wed','Thu','Fri']
    setSelectedDays(days)
    setTimeSlots([{ time: '', days: [...days] }])
    setPersistentReminder(false); setRepeatInterval(2); setError('')
  }

  function toggleDay(day) {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  // Time-slot helpers
  function addSlot() { setTimeSlots(prev => [...prev, { time: '', days: [...selectedDays] }]) }
  function removeSlot(idx) { setTimeSlots(prev => prev.filter((_,i) => i !== idx)) }
  function updateSlotTime(idx, time) { setTimeSlots(prev => prev.map((s,i) => i === idx ? { ...s, time } : s)) }
  function toggleSlotDay(idx, day) {
    setTimeSlots(prev => prev.map((s,i) => {
      if (i !== idx) return s
      const days = s.days.includes(day) ? s.days.filter(d => d !== day) : [...s.days, day]
      return { ...s, days }
    }))
  }

  async function handleSave() {
    if (!name.trim()) { setError('請輸入任務名稱'); return }
    if (selectedDays.length === 0) { setError('請至少選擇一天'); return }
    const rt = buildReminderTimes()
    const hasTime = Array.isArray(rt) ? rt.length > 0 : Object.keys(rt).length > 0
    if (!hasTime) { setError('請至少設定一個有效的提醒時間'); return }

    setSaving(true)
    try {
      const payload = { name: name.trim(), description: description.trim(), targetDays: selectedDays, reminderTimes: rt, persistentReminder, repeatInterval: persistentReminder ? repeatInterval : 2 }
      if (isEditing) {
        const original = tasks.find(t => t.id === editId) || editTask
        await onUpdate({ ...payload, id: editId, history: original?.history || {} })
        resetForm()
      } else {
        await onSave(payload)
        resetForm()
      }
      setError('')
      if (editTask) onClose()
    } catch (err) {
      setError(`儲存失敗：${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-enter relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Target className="text-violet-600" size={22} />
            <h2 className="text-lg font-bold text-gray-800">{isEditing ? '編輯任務' : '設定目標'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-500"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          <section id="goal-form-top">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {isEditing ? '✏️ 編輯任務' : '新增習慣'}
              </h3>
              {isEditing && (
                <button onClick={resetForm} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 bg-gray-100 px-2.5 py-1 rounded-lg">
                  <X size={12} /> 取消編輯
                </button>
              )}
            </div>
            {isEditing && (
              <div className="text-xs bg-violet-50 text-violet-600 px-3 py-2 rounded-xl mb-3 font-medium">
                正在編輯：{tasks.find(t => t.id === editId)?.name || name}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">任務名稱</label>
              <input type="text" value={name} onChange={e => { setName(e.target.value); setError('') }}
                placeholder="例：每天冥想 10 分鐘"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 transition" />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                任務描述 / 連結
                <span className="ml-1.5 text-xs font-normal text-gray-400">（選填）</span>
              </label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="例：參考影片 https://youtube.com/..." rows={2}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 transition resize-none" />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">執行日期</label>
              <div className="flex gap-1.5 flex-wrap">
                {DAYS_OF_WEEK.map(day => (
                  <button key={day} onClick={() => toggleDay(day)}
                    className={`w-10 h-10 rounded-xl text-sm font-semibold transition-all ${selectedDays.includes(day) ? 'bg-violet-600 text-white shadow-md shadow-violet-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {DAYS_ZH[day]}
                  </button>
                ))}
              </div>
            </div>

            {/* ── 提醒時間（時間槽 + 勾選日期）── */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">提醒時間</label>
              {selectedDays.length === 0 && (
                <p className="text-xs text-gray-400 mb-2">請先選擇執行日期</p>
              )}
              <div className="space-y-2">
                {timeSlots.map((slot, idx) => (
                  <div key={idx} className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                    {/* 時間 + 刪除 */}
                    <div className="flex items-center gap-2 mb-2.5">
                      <Clock size={14} className="text-indigo-400 shrink-0" />
                      <input
                        type="time"
                        value={slot.time}
                        onChange={e => updateSlotTime(idx, e.target.value)}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                      />
                      {timeSlots.length > 1 && (
                        <button onClick={() => removeSlot(idx)} className="text-gray-300 hover:text-red-400 transition-colors">
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    {/* 日期勾選 */}
                    <div className="flex flex-wrap gap-1.5">
                      {DAY_KEYS.filter(d => selectedDays.includes(d)).map(day => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleSlotDay(idx, day)}
                          className={`w-8 h-8 rounded-full text-xs font-semibold transition-all ${
                            slot.days.includes(day)
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-white border border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-500'
                          }`}
                        >
                          {DAYS_ZH[day]}
                        </button>
                      ))}
                      {selectedDays.length === 0 && <p className="text-xs text-gray-300 italic">—</p>}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addSlot}
                className="mt-2 w-full flex items-center justify-center gap-1.5 text-sm text-indigo-500 hover:text-indigo-700 py-2 rounded-xl border border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all"
              >
                <Plus size={15} /> 新增時間
              </button>
            </div>

            {/* 持續提醒開關 */}
            <div className={`rounded-xl border mb-4 transition-colors ${persistentReminder ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-100'}`}>
              <div
                onClick={() => setPersistentReminder(p => !p)}
                className="flex items-center justify-between px-4 py-3 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <AlarmClock size={17} className={persistentReminder ? 'text-orange-500' : 'text-gray-400'} />
                  <div>
                    <p className={`text-sm font-medium ${persistentReminder ? 'text-orange-700' : 'text-gray-600'}`}>持續提醒模式</p>
                    <p className="text-xs text-gray-400">到達時間後持續提醒，直到完成為止</p>
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${persistentReminder ? 'bg-orange-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${persistentReminder ? 'left-5' : 'left-1'}`} />
                </div>
              </div>
              {/* 間隔設定（只在開啟時顯示） */}
              {persistentReminder && (
                <div className="flex items-center gap-3 px-4 pb-3" onClick={e => e.stopPropagation()}>
                  <p className="text-xs text-orange-600 shrink-0">每隔</p>
                  <div className="flex items-center gap-1">
                    {[2, 5, 10, 15, 30].map(min => (
                      <button
                        key={min}
                        type="button"
                        onClick={() => setRepeatInterval(min)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                          repeatInterval === min
                            ? 'bg-orange-500 text-white shadow-sm'
                            : 'bg-white border border-orange-200 text-orange-500 hover:bg-orange-100'
                        }`}
                      >{min} 分</button>
                    ))}
                  </div>
                  <p className="text-xs text-orange-600 shrink-0">提醒一次</p>
                </div>
              )}
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button onClick={handleSave} disabled={saving}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-md shadow-violet-200 flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              {saving ? '儲存中...' : isEditing ? '儲存修改' : '新增習慣'}
            </button>
          </section>

          {tasks.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">現有習慣（{tasks.length} 項）</h3>
              <div className="space-y-2">
                {tasks.map(task => (
                  <div key={task.id}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors ${editId === task.id ? 'bg-violet-50 border-violet-200' : 'bg-gray-50 border-transparent'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{task.name}</p>
                      {task.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{task.description}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {task.targetDays.map(d => `週${DAYS_ZH[d]}`).join('、')}・{Array.isArray(task.reminderTimes) ? task.reminderTimes.join('、') : '各天自訂'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => loadTaskIntoForm(task)}
                        className={`p-1.5 rounded-lg transition-colors ${editId === task.id ? 'bg-violet-200 text-violet-700' : 'text-gray-400 hover:text-violet-600 hover:bg-violet-50'}`}
                        title="編輯"
                      >
                        <Settings size={15} />
                      </button>
                      <button onClick={() => onDelete(task.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="刪除"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 子組件：貢獻格子圖
// ============================================================
function ContributionGrid({ task }) {
  const WEEKS = 14
  const today = new Date(); today.setHours(0,0,0,0)
  const startDay = new Date(today)
  startDay.setDate(today.getDate() - today.getDay() - (WEEKS-1)*7)
  const cells = []
  for (let w=0; w<WEEKS; w++) {
    const week = []
    for (let d=0; d<7; d++) {
      const date = new Date(startDay)
      date.setDate(startDay.getDate() + w*7 + d)
      const dateStr = getDateStr(date)
      const dayKey = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()]
      week.push({ date, dateStr, dayKey, isTarget: task.targetDays.includes(dayKey), isDone: !!task.history[dateStr], isFuture: date > today })
    }
    cells.push(week)
  }
  function cellColor({ isTarget, isDone, isFuture, date }) {
    if (isFuture || !isTarget) return 'bg-gray-100'
    if (isDone) return 'bg-emerald-500'
    const d = new Date(date); d.setHours(0,0,0,0)
    if (d.getTime() === today.getTime()) return 'bg-amber-300'
    return 'bg-red-200'
  }
  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-2">
        {cells.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((cell, di) => (
              <div key={di} title={`${cell.dateStr}${cell.isTarget ? (cell.isDone?' ✓':' ✗'):'(非執行日)'}`}
                className={`contribution-cell w-3.5 h-3.5 rounded-sm cursor-default ${cellColor(cell)}`} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block"/>已完成</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-200 inline-block"/>未完成</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-300 inline-block"/>今天</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gray-100 inline-block"/>非執行日</span>
      </div>
    </div>
  )
}

// ============================================================
// 子組件：每週計畫管理頁（Mon → Sun，可新增 / 編輯 / 刪除）
// ============================================================
function WeeklyModal({ tasks, onClose, onDelete, onAdd, onEdit }) {
  const todayKey = getTodayKey()
  const todayStr = getDateStr()
  const [confirmId, setConfirmId] = useState(null) // 等待確認刪除的任務 id

  const days = [
    { key: 'Mon', label: '星期一', short: 'M' },
    { key: 'Tue', label: '星期二', short: 'T' },
    { key: 'Wed', label: '星期三', short: 'W' },
    { key: 'Thu', label: '星期四', short: 'T' },
    { key: 'Fri', label: '星期五', short: 'F' },
    { key: 'Sat', label: '星期六', short: 'S' },
    { key: 'Sun', label: '星期日', short: 'S' },
  ]

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-enter relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* 標題列 */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <CalendarDays className="text-violet-600" size={22} />
            <div>
              <h2 className="text-lg font-bold text-gray-800">週計畫管理</h2>
              <p className="text-xs text-gray-400">點擊任務可編輯，＋ 新增任務</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
            <X size={20} />
          </button>
        </div>

        {/* 每日區塊 */}
        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-3">
          {days.map(({ key, label }) => {
            const dayTasks = tasks.filter(t => t.targetDays.includes(key))
            const isToday = key === todayKey

            return (
              <div key={key}
                className={`rounded-2xl border overflow-hidden transition-shadow ${isToday ? 'border-violet-300 shadow-md shadow-violet-100' : 'border-gray-100'}`}
              >
                {/* 日期標頭 + 新增按鈕 */}
                <div className={`flex items-center justify-between px-4 py-3 ${isToday ? 'bg-gradient-to-r from-violet-600 to-indigo-600' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${isToday ? 'text-white' : 'text-gray-700'}`}>{label}</span>
                    {isToday && <span className="text-xs bg-white/25 text-white px-2 py-0.5 rounded-full font-medium">今天</span>}
                    <span className={`text-xs ${isToday ? 'text-violet-200' : 'text-gray-400'}`}>
                      {dayTasks.length > 0 ? `${dayTasks.length} 項` : '無任務'}
                    </span>
                  </div>
                  {/* ＋ 新增 */}
                  <button
                    onClick={() => onAdd([key])}
                    className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                      isToday
                        ? 'bg-white/20 text-white hover:bg-white/30'
                        : 'bg-white border border-gray-200 text-violet-600 hover:bg-violet-50'
                    }`}
                  >
                    <Plus size={13} /> 新增
                  </button>
                </div>

                {/* 任務列表 */}
                <div className="divide-y divide-gray-50">
                  {dayTasks.length === 0 && (
                    <button
                      onClick={() => onAdd([key])}
                      className="w-full py-4 text-sm text-gray-300 hover:text-violet-400 hover:bg-violet-50/50 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus size={14} /> 點此新增任務
                    </button>
                  )}
                  {dayTasks.map(task => {
                    const doneToday = isToday && !!task.history[todayStr]
                    const isConfirming = confirmId === task.id

                    return (
                      <div key={task.id}
                        className={`flex items-center gap-3 px-4 py-3 group transition-colors ${doneToday ? 'bg-emerald-50/40' : 'hover:bg-gray-50'}`}
                      >
                        {/* 完成狀態點 */}
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          isToday
                            ? doneToday ? 'bg-emerald-400' : 'bg-gray-200'
                            : 'bg-violet-200'
                        }`} />

                        {/* 任務名稱（點擊編輯） */}
                        <button
                          onClick={() => onEdit(task)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <p className={`text-sm font-medium truncate ${doneToday ? 'text-gray-400 line-through' : 'text-gray-700 group-hover:text-violet-700'}`}>
                            {task.name}
                          </p>
                          <p className="text-xs text-gray-300 truncate mt-0.5">
                            {Array.isArray(task.reminderTimes) ? task.reminderTimes.join('、') : (task.reminderTimes[key]?.join('、') || '各天自訂')}
                            {task.persistentReminder && ' · 🔔 持續提醒'}
                          </p>
                        </button>

                        {/* 操作按鈕 */}
                        {isConfirming ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => { onDelete(task.id); setConfirmId(null) }}
                              className="text-xs bg-red-500 text-white px-2.5 py-1 rounded-lg font-semibold hover:bg-red-600"
                            >確定刪除</button>
                            <button
                              onClick={() => setConfirmId(null)}
                              className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-lg hover:bg-gray-200"
                            >取消</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => onEdit(task)}
                              className="p-1.5 rounded-lg hover:bg-violet-100 text-gray-400 hover:text-violet-600 transition-colors"
                              title="編輯"
                            >
                              <Settings size={14} />
                            </button>
                            <button
                              onClick={() => setConfirmId(task.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                              title="刪除"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* 底部留白 */}
          <div className="h-2" />
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 子組件：記事本 Modal（每日獨立記錄 + 日曆導覽）
// ============================================================
function NotepadModal({ onClose, supabase, userId }) {
  const todayStr = getDateStr()
  const [entries, setEntries]       = useState([])       // [{date, content}] sorted newest→oldest
  const [loading, setLoading]       = useState(true)
  const [statusMap, setStatusMap]   = useState({})       // date → 'saved'|'saving'|'error'
  const [showCal, setShowCal]       = useState(false)
  const [calMonth, setCalMonth]     = useState(new Date())
  const [errMsg, setErrMsg]         = useState('')
  const saveTimers                  = useRef({})
  const entryRefs                   = useRef({})          // date → div ref for scrolling
  const scrollBoxRef                = useRef(null)

  // 載入所有筆記
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('notes')
        .select('date, content')
        .eq('user_id', userId)
        .order('date', { ascending: false })
      const rows = data || []
      // 確保今天一定有一個空白 entry
      if (!rows.find(r => r.date === todayStr)) rows.unshift({ date: todayStr, content: '' })
      setEntries(rows)
      const init = {}
      rows.forEach(r => { init[r.date] = 'saved' })
      setStatusMap(init)
      setLoading(false)
    }
    load()
  }, [])

  function updateEntry(date, content) {
    setEntries(prev => prev.map(e => e.date === date ? { ...e, content } : e))
    setStatusMap(prev => ({ ...prev, [date]: 'saving' }))
    clearTimeout(saveTimers.current[date])
    saveTimers.current[date] = setTimeout(async () => {
      try {
        // Check if a row already exists for this user+date
        const { data: existing, error: selErr } = await supabase
          .from('notes')
          .select('id')
          .eq('user_id', userId)
          .eq('date', date)
          .maybeSingle()

        if (selErr) throw selErr

        let saveError
        if (existing) {
          // Row exists → UPDATE
          const { error } = await supabase
            .from('notes')
            .update({ content, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('date', date)
          saveError = error
        } else {
          // No row → INSERT
          const { error } = await supabase
            .from('notes')
            .insert({ user_id: userId, date, content, updated_at: new Date().toISOString() })
          saveError = error
        }

        if (saveError) throw saveError

        setStatusMap(prev => ({ ...prev, [date]: 'saved' }))
        setErrMsg('')
      } catch (err) {
        console.error('❌ 筆記儲存失敗：', err?.code, err?.message, err?.details)
        setStatusMap(prev => ({ ...prev, [date]: 'error' }))
        setErrMsg(err?.message || err?.code || '未知錯誤')
      }
    }, 1500)
  }

  // 日曆：有筆記的日期集合
  const noteDates = new Set(entries.filter(e => e.content.trim()).map(e => e.date))

  function jumpToDate(dateStr) {
    setShowCal(false)
    // 若該日沒有 entry，新增一個空白
    if (!entries.find(e => e.date === dateStr)) {
      setEntries(prev => {
        const next = [{ date: dateStr, content: '' }, ...prev]
          .sort((a, b) => b.date.localeCompare(a.date))
        return next
      })
    }
    setTimeout(() => {
      entryRefs.current[dateStr]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  // ── 日曆渲染 ─────────────────────────────────────────────
  function CalendarWidget() {
    const year  = calMonth.getFullYear()
    const month = calMonth.getMonth()
    const monthLabel = calMonth.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })
    const firstDow = new Date(year, month, 1).getDay()   // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < firstDow; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)

    return (
      <div className="absolute top-full left-0 right-0 z-50 mx-4 mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl p-4 select-none">
        {/* 月份導覽 */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setCalMonth(new Date(year, month - 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">‹</button>
          <span className="text-sm font-semibold text-gray-700">{monthLabel}</span>
          <button onClick={() => setCalMonth(new Date(year, month + 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">›</button>
        </div>
        {/* 星期標頭 */}
        <div className="grid grid-cols-7 mb-1">
          {['日','一','二','三','四','五','六'].map(d => (
            <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
          ))}
        </div>
        {/* 日期格 */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} />
            const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
            const isToday = ds === todayStr
            const hasNote = noteDates.has(ds)
            const isFuture = ds > todayStr
            return (
              <button key={ds} onClick={() => !isFuture && jumpToDate(ds)} disabled={isFuture}
                className={`relative flex flex-col items-center py-1.5 rounded-xl transition-colors text-xs font-medium
                  ${isToday ? 'bg-violet-600 text-white' : ''}
                  ${!isToday && hasNote ? 'text-violet-700 hover:bg-violet-50' : ''}
                  ${!isToday && !hasNote && !isFuture ? 'text-gray-500 hover:bg-gray-100' : ''}
                  ${isFuture ? 'text-gray-200 cursor-default' : 'cursor-pointer'}
                `}
              >
                {d}
                {hasNote && !isToday && <span className="absolute bottom-0.5 w-1 h-1 bg-violet-400 rounded-full" />}
              </button>
            )
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
          <span className="text-xs text-gray-400">紫點 = 有記錄的日期</span>
          <button onClick={() => jumpToDate(todayStr)}
            className="text-xs text-violet-600 font-semibold hover:underline">回到今天</button>
        </div>
      </div>
    )
  }

  // ── 日期格式化 ────────────────────────────────────────────
  function fmtDate(ds) {
    const d = new Date(ds + 'T00:00:00')
    const days = ['日','一','二','三','四','五','六']
    return `${d.getFullYear()} 年 ${d.getMonth()+1} 月 ${d.getDate()} 日（週${days[d.getDay()]}）`
  }

  const statusLabel = {
    saving: <span className="text-amber-400 text-xs flex items-center gap-1"><Loader2 size={11} className="animate-spin"/>儲存中</span>,
    saved:  <span className="text-emerald-400 text-xs flex items-center gap-1"><Save size={11}/>已儲存</span>,
    error:  <span className="text-red-400 text-xs flex items-center gap-1"><CloudOff size={11}/>失敗</span>,
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-enter relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col" style={{ height: '88vh' }}>

        {/* 標題列 */}
        <div className="relative flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <NotebookPen className="text-violet-600" size={20} />
            <h2 className="text-base font-bold text-gray-800">我的日記本</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCal(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${showCal ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              <Calendar size={15} /> 日曆
            </button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
              <X size={20} />
            </button>
          </div>
          {showCal && <CalendarWidget />}
        </div>

        {/* 錯誤提示列 */}
        {errMsg && (
          <div className="mx-4 mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">
            <CloudOff size={14} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">儲存失敗</p>
              <p className="text-red-500">{errMsg}</p>
              <p className="mt-1 text-red-400">請到瀏覽器 Console（F12）確認詳細錯誤，或檢查 Supabase 的 notes 資料表設定。</p>
            </div>
          </div>
        )}

        {/* 每日記錄列表 */}
        <div ref={scrollBoxRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
              <Loader2 size={20} className="animate-spin" /><span className="text-sm">載入中…</span>
            </div>
          ) : entries.map(entry => {
            const isToday = entry.date === todayStr
            return (
              <div key={entry.date} ref={el => { entryRefs.current[entry.date] = el }}
                className={`rounded-2xl border overflow-hidden ${isToday ? 'border-violet-300 shadow-md shadow-violet-100' : 'border-gray-100'}`}
              >
                {/* 日期標頭 */}
                <div className={`flex items-center justify-between px-4 py-2.5 ${isToday ? 'bg-gradient-to-r from-violet-600 to-indigo-600' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${isToday ? 'text-white' : 'text-gray-600'}`}>
                      {fmtDate(entry.date)}
                    </span>
                    {isToday && <span className="text-xs bg-white/25 text-white px-2 py-0.5 rounded-full">今天</span>}
                  </div>
                  {statusMap[entry.date] && statusLabel[statusMap[entry.date]]}
                </div>

                {/* 文字區 */}
                {isToday ? (
                  <textarea
                    value={entry.content}
                    onChange={e => updateEntry(entry.date, e.target.value)}
                    placeholder="寫下今天的想法…"
                    rows={5}
                    className="w-full px-4 py-3 text-sm text-gray-700 leading-relaxed resize-none focus:outline-none placeholder-gray-300"
                  />
                ) : (
                  entry.content.trim() ? (
                    <p className="px-4 py-3 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                      {entry.content}
                    </p>
                  ) : (
                    <p className="px-4 py-3 text-sm text-gray-300 italic">（空白）</p>
                  )
                )}

                {/* 字數（僅今天） */}
                {isToday && (
                  <div className="px-4 py-2 border-t border-gray-50 flex justify-between">
                    <span className="text-xs text-gray-300">{entry.content.length} 字</span>
                    <button
                      onClick={() => { if (window.confirm('確定清空今天的記錄嗎？')) updateEntry(todayStr, '') }}
                      className="text-xs text-gray-300 hover:text-red-400 transition-colors"
                    >清空今天</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 子組件：備份 & 還原 Modal
// ============================================================
function BackupModal({ onClose, tasks, supabase, userId }) {
  const [notes, setNotes]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [importing, setImporting] = useState(false)
  const [sending, setSending]   = useState(false)
  const [msg, setMsg]           = useState(null) // {type:'ok'|'err', text}
  const fileRef                 = useRef(null)

  useEffect(() => {
    supabase.from('notes').select('date,content').eq('user_id', userId)
      .order('date', { ascending: false })
      .then(({ data }) => { setNotes(data || []); setLoading(false) })
  }, [])

  // ── 匯出 JSON ──────────────────────────────────────────────
  function buildBackup() {
    return {
      appVersion: 1,
      exportedAt: new Date().toISOString(),
      tasks: tasks.map(t => ({
        id: t.id, name: t.name, description: t.description,
        targetDays: t.targetDays, reminderTimes: t.reminderTimes,
        history: t.history, persistentReminder: t.persistentReminder,
      })),
      notes: notes.map(n => ({ date: n.date, content: n.content })),
    }
  }

  function downloadBackup() {
    const backup = buildBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `habit-backup-${getDateStr()}.json`
    a.click()
    URL.revokeObjectURL(url)
    localStorage.setItem('lastBackupReminder', String(Date.now()))
  }

  // ── 自動寄送 .json 到信箱（Supabase Edge Function + Resend） ──
  async function sendEmail() {
    setSending(true); setMsg(null)
    try {
      const backup = buildBackup()
      const { data, error } = await supabase.functions.invoke('send-backup', {
        body: { backup, date: getDateStr() },
      })
      if (error || data?.error) throw new Error(error?.message || JSON.stringify(data?.error))
      localStorage.setItem('lastBackupReminder', String(Date.now()))
      setMsg({ type: 'ok', text: `✅ 備份已寄到 ${MY_EMAIL}！信件含 .json 附件。` })
    } catch (err) {
      setMsg({ type: 'err', text: `❌ 寄送失敗：${err.message}` })
    } finally {
      setSending(false)
    }
  }

  // ── 匯入 JSON 還原 ─────────────────────────────────────────
  async function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true); setMsg(null)
    try {
      const text   = await file.text()
      const backup = JSON.parse(text)
      if (!Array.isArray(backup.tasks) || !Array.isArray(backup.notes))
        throw new Error('檔案格式不正確')

      // 還原任務
      for (const t of backup.tasks) {
        await supabase.from('tasks').upsert({
          id: t.id, user_id: userId,
          name: t.name, description: t.description || '',
          target_days: t.targetDays, reminder_times: t.reminderTimes,
          history: t.history || {}, persistent_reminder: t.persistentReminder || false,
        }, { onConflict: 'id' })
      }
      // 還原筆記
      for (const n of backup.notes) {
        await supabase.from('notes').upsert({
          user_id: userId, date: n.date, content: n.content,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,date' })
      }
      setMsg({ type: 'ok', text: `✅ 成功還原 ${backup.tasks.length} 個任務、${backup.notes.length} 筆記錄！請重新整理頁面。` })
    } catch (err) {
      setMsg({ type: 'err', text: `❌ 匯入失敗：${err.message}` })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-enter relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">

        {/* 標題 */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <DatabaseBackup className="text-violet-600" size={21} />
            <h2 className="text-lg font-bold text-gray-800">備份 & 還原</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400"><X size={20}/></button>
        </div>

        <div className="p-6 space-y-5">

          {/* 摘要 */}
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 size={16} className="animate-spin"/>載入中…</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-violet-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-violet-600">{tasks.length}</p>
                <p className="text-xs text-violet-400 mt-0.5">習慣任務</p>
              </div>
              <div className="bg-indigo-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-indigo-600">{notes.length}</p>
                <p className="text-xs text-indigo-400 mt-0.5">日記記錄</p>
              </div>
            </div>
          )}

          {/* 匯出 */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">匯出備份</p>
            <button onClick={downloadBackup}
              className="w-full flex items-center gap-3 bg-gray-50 hover:bg-violet-50 border border-gray-200 hover:border-violet-300 rounded-xl px-4 py-3.5 transition-colors group">
              <div className="w-9 h-9 bg-violet-100 group-hover:bg-violet-200 rounded-xl flex items-center justify-center shrink-0 transition-colors">
                <Download size={17} className="text-violet-600"/>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-700">下載備份檔 (.json)</p>
                <p className="text-xs text-gray-400">包含所有任務與日記記錄</p>
              </div>
            </button>
            <button onClick={sendEmail} disabled={sending}
              className="w-full flex items-center gap-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl px-4 py-3.5 transition-colors group disabled:opacity-60">
              <div className="w-9 h-9 bg-blue-100 group-hover:bg-blue-200 rounded-xl flex items-center justify-center shrink-0 transition-colors">
                {sending ? <Loader2 size={17} className="text-blue-600 animate-spin"/> : <Send size={17} className="text-blue-600"/>}
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-700">{sending ? '寄送中…' : '自動寄送 .json 到信箱'}</p>
                <p className="text-xs text-gray-400">{MY_EMAIL}（需先完成 Resend 設定，見下方）</p>
              </div>
            </button>
          </div>

          {/* 匯入 */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">從備份還原</p>
            <button onClick={() => fileRef.current?.click()} disabled={importing}
              className="w-full flex items-center gap-3 bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-300 rounded-xl px-4 py-3.5 transition-colors group disabled:opacity-60">
              <div className="w-9 h-9 bg-emerald-100 group-hover:bg-emerald-200 rounded-xl flex items-center justify-center shrink-0 transition-colors">
                {importing ? <Loader2 size={17} className="text-emerald-600 animate-spin"/> : <Upload size={17} className="text-emerald-600"/>}
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-700">{importing ? '還原中…' : '載入備份檔'}</p>
                <p className="text-xs text-gray-400">選擇之前下載的 .json 檔案</p>
              </div>
            </button>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          </div>

          {/* 結果訊息 */}
          {msg && (
            <div className={`rounded-xl px-4 py-3 text-sm font-medium ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {msg.text}
              {msg.type === 'ok' && (
                <button onClick={() => window.location.reload()}
                  className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline">
                  <RefreshCw size={12}/> 立即重新整理
                </button>
              )}
            </div>
          )}

          {/* Resend 設定說明 */}
          <details className="bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 overflow-hidden">
            <summary className="px-4 py-3 font-semibold cursor-pointer select-none flex items-center gap-1.5">
              ⚙️ 首次設定說明（點此展開）
            </summary>
            <div className="px-4 pb-4 space-y-1.5 leading-relaxed">
              <p><strong>步驟一：</strong>前往 <strong>resend.com</strong> 用 <strong>bb@bb.com</strong> 免費註冊</p>
              <p><strong>步驟二：</strong>左側 API Keys → Create API Key → 複製 key（`re_xxx...`）</p>
              <p><strong>步驟三：</strong>前往 <strong>Supabase Dashboard → Settings → Edge Function Secrets</strong></p>
              <p className="pl-3">新增一個 Secret：Name = <code>RESEND_API_KEY</code>，Value = 剛才的 key</p>
              <p><strong>步驟四：</strong>前往 <strong>Supabase Dashboard → Edge Functions → New Function</strong></p>
              <p className="pl-3">名稱填 <code>send-backup</code>，把 supabase/functions/send-backup/index.ts 的內容貼入，部署</p>
              <p className="mt-2 text-amber-600 font-medium">完成後即可使用「自動寄送」按鈕，每封信都會附上 .json 附件 ✅</p>
            </div>
          </details>

          {/* 提醒 */}
          <p className="text-xs text-gray-300 text-center">建議每週備份一次，以防資料遺失</p>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 子組件：統計 Modal
// ============================================================
function StatsModal({ tasks, onClose }) {
  const [selectedId, setSelectedId] = useState(tasks[0]?.id || null)
  const selectedTask = tasks.find(t => t.id === selectedId)

  function calcStats(task) {
    const today = new Date(); today.setHours(0,0,0,0)
    const stats = {}
    DAYS_OF_WEEK.forEach(day => {
      if (!task.targetDays.includes(day)) return
      const jsDay = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(day)
      let total=0, done=0
      for (let w=0; w<12; w++) {
        const d = new Date(today)
        d.setDate(today.getDate() - (today.getDay()-jsDay+7)%7 - w*7)
        if (d > today) continue
        total++
        if (task.history[getDateStr(d)]) done++
      }
      stats[day] = { total, done, rate: total>0 ? Math.round(done/total*100) : 0 }
    })
    return stats
  }
  function calcOverall(task) {
    const today = new Date(); today.setHours(0,0,0,0)
    let total=0, done=0
    for (let i=0; i<30; i++) {
      const d = new Date(today); d.setDate(today.getDate()-i)
      const dayKey = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]
      if (!task.targetDays.includes(dayKey)) continue
      total++
      if (task.history[getDateStr(d)]) done++
    }
    return { total, done, rate: total>0 ? Math.round(done/total*100) : 0 }
  }
  function calcStreak(task) {
    const today = new Date(); today.setHours(0,0,0,0)
    let streak=0
    for (let i=0; i<365; i++) {
      const d = new Date(today); d.setDate(today.getDate()-i)
      const dayKey = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]
      if (!task.targetDays.includes(dayKey)) continue
      if (task.history[getDateStr(d)]) streak++
      else break
    }
    return streak
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-enter relative bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-violet-600" size={22} />
            <h2 className="text-lg font-bold text-gray-800">習慣統計</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-500"><X size={20} /></button>
        </div>
        {tasks.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <BarChart3 className="mx-auto mb-3 text-gray-300" size={48} /><p>尚無任務資料</p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 p-6 space-y-6">
            <div className="flex gap-2 flex-wrap">
              {tasks.map(t => (
                <button key={t.id} onClick={() => setSelectedId(t.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedId===t.id ? 'bg-violet-600 text-white shadow-md shadow-violet-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {t.name}
                </button>
              ))}
            </div>
            {selectedTask && (() => {
              const overall = calcOverall(selectedTask)
              const streak  = calcStreak(selectedTask)
              const dayStats = calcStats(selectedTask)
              return (
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { icon:<TrendingUp size={20}/>, label:'近30天完成率', value:`${overall.rate}%`, color:'text-violet-600', bg:'bg-violet-50' },
                      { icon:<Award size={20}/>, label:'連續完成天數', value:`${streak} 天`, color:'text-emerald-600', bg:'bg-emerald-50' },
                      { icon:<CheckCircle2 size={20}/>, label:'完成 / 目標', value:`${overall.done}/${overall.total}`, color:'text-indigo-600', bg:'bg-indigo-50' },
                    ].map(card => (
                      <div key={card.label} className={`${card.bg} rounded-2xl p-4 text-center`}>
                        <div className={`${card.color} flex justify-center mb-1`}>{card.icon}</div>
                        <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-5">
                    <h4 className="text-sm font-semibold text-gray-600 mb-4">近30天整體完成率</h4>
                    <div className="flex items-center gap-6">
                      <div className="relative shrink-0">
                        <svg width="100" height="100" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="10"/>
                          <circle cx="50" cy="50" r="42" fill="none" stroke="#7c3aed" strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={`${2*Math.PI*42}`}
                            strokeDashoffset={`${2*Math.PI*42*(1-overall.rate/100)}`}
                            transform="rotate(-90 50 50)" className="transition-all duration-700"/>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xl font-bold text-violet-700">{overall.rate}%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-gray-600 text-sm">
                          在過去 30 天的<strong className="text-gray-800 mx-1">{overall.total}</strong>個執行日中，完成了<strong className="text-emerald-600 mx-1">{overall.done}</strong>次
                        </p>
                        <p className="text-xs text-gray-400 mt-2">執行日：{selectedTask.targetDays.map(d=>`週${DAYS_ZH[d]}`).join('、')}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-5">
                    <h4 className="text-sm font-semibold text-gray-600 mb-4">各星期完成率（近12次）</h4>
                    <div className="space-y-2.5">
                      {selectedTask.targetDays.map(day => {
                        const s = dayStats[day]; if (!s) return null
                        return (
                          <div key={day} className="flex items-center gap-3">
                            <span className="text-xs font-medium text-gray-500 w-6 text-center">{DAYS_ZH[day]}</span>
                            <div className="flex-1 bg-gray-200 rounded-full h-5 overflow-hidden">
                              <div className="h-5 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-700 flex items-center justify-end pr-2"
                                style={{ width:`${Math.max(s.rate,4)}%` }}>
                                {s.rate>=20 && <span className="text-white text-xs font-semibold">{s.rate}%</span>}
                              </div>
                            </div>
                            <span className="text-xs text-gray-500 w-14 text-right shrink-0">{s.done}/{s.total} 次</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-5">
                    <h4 className="text-sm font-semibold text-gray-600 mb-4">近14週完成紀錄</h4>
                    <ContributionGrid task={selectedTask} />
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 主組件：App
// ============================================================
// ─── Web Push 工具函式 ────────────────────────────────────────
function urlBase64ToUint8Array(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4)
  const base64 = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export default function App() {
  const [user, setUser]               = useState(undefined) // undefined=初始化中
  const [loginLoading, setLoginLoading] = useState(false)
  const [tasks, setTasks]             = useState([])
  const [tasksLoading, setTasksLoading] = useState(false)
  // currentDate forces a re-render when the calendar day changes (e.g. app kept open overnight)
  const [currentDate, setCurrentDate] = useState(getDateStr())
  const [showGoalModal, setShowGoalModal]   = useState(false)
  const [showStatsModal, setShowStatsModal] = useState(false)
  const [showWeeklyModal, setShowWeeklyModal] = useState(false)
  const [showNotepad, setShowNotepad]         = useState(false)
  const [showBackup, setShowBackup]           = useState(false)
  const [editingTask, setEditingTask]         = useState(null)  // 週計畫點擊「編輯」開啟
  const [weeklyAddDays, setWeeklyAddDays]     = useState(null)  // 週計畫點擊「+」帶入的預設日期
  const [toasts, setToasts]           = useState([])
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )
  const firedRef = useRef(new Set())
  const persistentLastFireRef = useRef({}) // `taskId_date_time_p` → 上次觸發 timestamp
  const [detailTask, setDetailTask] = useState(null) // 目前開啟詳情的任務

  // ─── 定期自動備份：每月 7 / 14 / 21 / 28 日，且只在正式網站觸發 ──
  useEffect(() => {
    if (!user) return
    // 本地開發環境不自動寄送
    if (window.location.hostname === 'localhost') return

    const today      = new Date()
    const dayOfMonth = today.getDate()
    const backupDays = [7, 14, 21, 28]
    if (!backupDays.includes(dayOfMonth)) return

    // 每個備份日只寄一次（以「年-月-日」為 key）
    const LAST_KEY   = 'lastAutoBackupDate'
    const todayKey   = getDateStr()
    if (localStorage.getItem(LAST_KEY) === todayKey) return

    setTimeout(async () => {
      localStorage.setItem(LAST_KEY, todayKey)
      try {
        const { data: noteData } = await supabase
          .from('notes').select('date,content').eq('user_id', user.id)
        const noteRows = noteData || []
        const backup = {
          appVersion: 1, exportedAt: new Date().toISOString(),
          tasks: tasks.map(t => ({ id:t.id,name:t.name,description:t.description,
            targetDays:t.targetDays,reminderTimes:t.reminderTimes,
            history:t.history,persistentReminder:t.persistentReminder })),
          notes: noteRows.map(n => ({ date:n.date,content:n.content })),
        }
        const { data, error } = await supabase.functions.invoke('send-backup', {
          body: { backup, date: todayKey },
        })
        if (error || data?.error) throw new Error(error?.message || JSON.stringify(data?.error))
        addToast(`📧 每月定期備份已自動寄至 ${MY_EMAIL}！`)
      } catch {
        addToast('💾 自動備份寄送失敗，請手動點「備份」。')
      }
    }, 5000)
  }, [user, tasks])

  // ─── 監聽 Supabase Auth 狀態 ────────────────────────────────
  useEffect(() => {
    // 取得目前 session（頁面重整後恢復登入）
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    // 監聽登入/登出事件
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ─── 載入任務 + 即時訂閱 ────────────────────────────────────
  const loadTasks = useCallback(async () => {
    if (!user) return
    setTasksLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) {
      console.error('載入任務失敗：', error.message)
    } else {
      setTasks((data || []).map(mapTask))
    }
    setTasksLoading(false)
  }, [user])

  useEffect(() => {
    if (!user) { setTasks([]); return }
    loadTasks()
    // 即時訂閱：任何裝置的變更都會觸發重新載入
    const channel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, loadTasks)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user, loadTasks])

  // ─── 提醒計時器 ─────────────────────────────────────────────
  useEffect(() => {
    if (!user) return

    // catchUpMs：補發幾毫秒內遺漏的提醒（頁面解凍後補發用）
    function checkReminders(catchUpMs = 0) {
      const now = new Date()
      const nowTs = now.getTime()
      const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
      const todayKey = getTodayKey()
      const todayStr = getDateStr()

      tasks.forEach(task => {
        if (!task.targetDays.includes(todayKey)) return

        const todaySlotTimes = getTimesForDay(task.reminderTimes, todayKey)

        if (task.persistentReminder) {
          todaySlotTimes.forEach(t => {
            if (isTimeCompleted(task, todayStr, t)) return

            const [rh, rm] = t.split(':').map(Number)
            const slotStart = new Date(); slotStart.setHours(rh, rm, 0, 0)
            const slotEnd   = new Date(slotStart.getTime() + 60 * 60 * 1000)

            if (nowTs < slotStart.getTime()) return
            if (nowTs >= slotEnd.getTime())  return

            const fireKey = `${task.id}_${todayStr}_${t}_p`
            const lastFire = persistentLastFireRef.current[fireKey] || 0
            const intervalMs = (task.repeatInterval || 2) * 60 * 1000
            if (nowTs - lastFire >= intervalMs) {
              persistentLastFireRef.current[fireKey] = nowTs
              const msg = `提醒：「${task.name}」${t} 尚未完成！`
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification('📌 習慣提醒', { body: msg, icon: '/favicon.svg' })
              }
              addToast(msg)
            }
          })
        } else {
          todaySlotTimes.forEach(t => {
            if (isTimeCompleted(task, todayStr, t)) return
            const fireKey = `${task.id}_${todayStr}_${t}`
            if (firedRef.current.has(fireKey)) return

            const [rh, rm] = t.split(':').map(Number)
            const slotTs = new Date(); slotTs.setHours(rh, rm, 0, 0)
            const msSinceSlot = nowTs - slotTs.getTime()

            // 觸發條件：精確分鐘 OR 頁面解凍後補發（在 catchUpMs 視窗內）
            const isNow    = t === hhmm
            const isMissed = catchUpMs > 0 && msSinceSlot >= 0 && msSinceSlot <= catchUpMs

            if (isNow || isMissed) {
              firedRef.current.add(fireKey)
              const label = isMissed ? `（補發）${t}` : t
              const msg = `提醒：「${task.name}」${label} 的時間到了！`
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification('📌 習慣提醒', { body: msg, icon: '/favicon.svg' })
              }
              addToast(msg)
            }
          })
        }
      })
    }

    checkReminders()
    const timer = setInterval(() => {
      checkReminders()
      // Detect midnight: if date changed, refresh UI and clear yesterday's fired log
      const today = getDateStr()
      setCurrentDate(prev => {
        if (prev !== today) {
          firedRef.current = new Set()
          return today
        }
        return prev
      })
    }, 60000)

    // 頁面從背景恢復時，補發最近 30 分鐘內遺漏的提醒，並偵測跨日
    function handleVisible() {
      if (document.visibilityState === 'visible') {
        const today = getDateStr()
        setCurrentDate(prev => {
          if (prev !== today) { firedRef.current = new Set(); return today }
          return prev
        })
        checkReminders(30 * 60 * 1000)
      }
    }
    document.addEventListener('visibilitychange', handleVisible)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisible)
    }
  }, [tasks, user])

  // ─── Web Push 訂閱：登入後註冊 Service Worker 並儲存訂閱至 Supabase ───
  useEffect(() => {
    if (!user) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    async function registerPush() {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')
        await navigator.serviceWorker.ready

        // 只有在已授權的情況下才訂閱
        let permission = Notification.permission
        if (permission === 'default') permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })

        const subJson = sub.toJSON()
        // 以 endpoint 為唯一鍵，同一裝置不重複寫入
        await supabase.from('push_subscriptions').upsert(
          { user_id: user.id, endpoint: subJson.endpoint, subscription: subJson },
          { onConflict: 'endpoint' }
        )
        console.log('✅ Push subscription saved')
      } catch (err) {
        console.warn('Push registration failed:', err.message)
      }
    }

    registerPush()
  }, [user])

  // ─── Toast ──────────────────────────────────────────────────
  const addToast = useCallback((message) => {
    const id = Date.now().toString(36)
    setToasts(prev => [...prev, { id, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 8000)
  }, [])
  const removeToast = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), [])

  // ─── Auth 操作 ───────────────────────────────────────────────
  async function handleLogin(password) {
    setLoginLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: LOGIN_EMAIL, password })
      return error || null
    } catch (err) {
      return err
    } finally {
      setLoginLoading(false)
    }
  }
  async function handleLogout() {
    await supabase.auth.signOut()
  }

  // ─── 任務 CRUD ───────────────────────────────────────────────

  // 新增：INSERT INTO tasks
  async function addTask(newTask) {
    if (!user) { alert('尚未登入'); throw new Error('尚未登入') }
      const { error } = await supabase.from('tasks').insert({
        user_id:            user.id,
        name:               newTask.name,
        description:        newTask.description || '',
        target_days:        newTask.targetDays,
        reminder_times:     newTask.reminderTimes,
        history:            {},
        persistent_reminder: newTask.persistentReminder || false,
        repeat_interval:     newTask.repeatInterval    || 2,
      })
    if (error) {
      console.error('新增任務失敗：', error.message)
      alert(`儲存失敗！\n${error.message}`)
      throw error
    }
    await loadTasks() // 寫入後立即拉取最新資料
  }

  // 編輯：UPDATE tasks SET ... WHERE id = task.id
  async function updateTask(task) {
    const { error } = await supabase.from('tasks').update({
      name:               task.name,
      description:        task.description || '',
      target_days:        task.targetDays,
      reminder_times:     task.reminderTimes,
      persistent_reminder: task.persistentReminder || false,
      repeat_interval:     task.repeatInterval    || 2,
    }).eq('id', task.id)
    if (error) {
      console.error('更新任務失敗：', error.message)
      alert(`更新失敗！\n${error.message}`)
      throw error
    }
    await loadTasks()
  }

  // 刪除：DELETE FROM tasks WHERE id = taskId
  async function deleteTask(taskId) {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (error) {
      console.error('刪除任務失敗：', error.message)
      alert(`刪除失敗！\n${error.message}`)
      return
    }
    await loadTasks()
  }

  // 打卡/取消：UPDATE tasks SET history = ... WHERE id = taskId
  // 切換某個時間點的完成狀態（支援多時間點獨立打卡）
  async function toggleTimeSlot(taskId, date, time) {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const val = task.history[date]
    const dayKey = getTodayKey()
    // 轉成陣列（相容舊的 true 格式）
    let arr = Array.isArray(val) ? [...val]
            : val === true       ? [...getTimesForDay(task.reminderTimes, dayKey)]
            : []

    const done = arr.includes(time)
    if (done) arr = arr.filter(t => t !== time)
    else arr.push(time)

    const newHistory = { ...task.history }
    if (arr.length === 0) delete newHistory[date]
    else newHistory[date] = arr

    // 樂觀更新
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, history: newHistory } : t))

    const { error } = await supabase.from('tasks').update({ history: newHistory }).eq('id', taskId)
    if (error) {
      console.error('打卡失敗：', error.message)
      alert(`打卡失敗！\n${error.message}`)
      await loadTasks()
    }
  }

  // 舊介面：一鍵切換當天所有時間點（TaskDetailModal 用）
  function toggleToday(taskId, currentlyAllDone) {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    const todayStr = getDateStr()
    const todayDayKey = getTodayKey()
    const times = getTimesForDay(task.reminderTimes, todayDayKey)
    if (currentlyAllDone) {
      times.forEach(t => { if (isTimeCompleted(task, todayStr, t)) toggleTimeSlot(taskId, todayStr, t) })
    } else {
      times.forEach(t => { if (!isTimeCompleted(task, todayStr, t)) toggleTimeSlot(taskId, todayStr, t) })
    }
  }

  async function requestNotification() {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setNotifPermission(result)
    if (result === 'granted') addToast('已開啟瀏覽器通知！')
  }

  // ─── 今日統計 ───────────────────────────────────────────────
  const todayKey = getTodayKey()
  const todayStr = getDateStr()
  const todayTasks = tasks.filter(t => t.targetDays.includes(todayKey))
  const todayDone  = todayTasks.filter(t => t.history?.[todayStr]).length

  // ─── 初始化中 ───────────────────────────────────────────────
  if (user === undefined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-white/30" />
      </div>
    )
  }

  // ─── 未登入 ─────────────────────────────────────────────────
  if (!user) {
    return <LoginScreen onLogin={handleLogin} loading={loginLoading} />
  }

  // ─── 已登入主畫面 ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-indigo-50/50">
      <ToastList toasts={toasts} onRemove={removeToast} />

      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <Target size={14} className="text-white" />
            </div>
            <h1 className="font-bold text-gray-800 text-base">每日習慣追蹤</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={requestNotification} title={notifPermission==='granted'?'通知已開啟':'點擊開啟通知'}
              className={`p-2 rounded-xl transition-colors ${notifPermission==='granted'?'text-violet-600 bg-violet-50':'text-gray-400 hover:bg-gray-100'}`}>
              {notifPermission==='granted' ? <Bell size={18}/> : <BellOff size={18}/>}
            </button>
            <button onClick={() => setShowNotepad(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
              <NotebookPen size={16}/><span className="hidden sm:inline">記事本</span>
            </button>
            <button onClick={() => setShowBackup(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
              <DatabaseBackup size={16}/><span className="hidden sm:inline">備份</span>
            </button>
            <button onClick={() => setShowWeeklyModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
              <CalendarDays size={16}/><span className="hidden sm:inline">週計畫</span>
            </button>
            <button onClick={() => setShowStatsModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
              <BarChart3 size={16}/><span className="hidden sm:inline">統計</span>
            </button>
            <button onClick={() => setShowGoalModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl hover:opacity-90 shadow-sm">
              <Settings size={16}/><span className="hidden sm:inline">設定目標</span>
            </button>
            <button onClick={handleLogout} title="鎖定"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
              <LogOut size={16}/>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <NotificationBanner permission={notifPermission} onRequest={requestNotification} />

        {tasks.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label:'今日任務', value:todayTasks.length, color:'text-violet-600' },
              { label:'已完成',   value:todayDone,          color:'text-emerald-600' },
              { label:'待完成',   value:todayTasks.length-todayDone, color:'text-amber-600' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>
        )}

        {tasksLoading ? (
          <div className="flex items-center justify-center py-12 gap-3 text-gray-400">
            <Loader2 size={20} className="animate-spin"/><span className="text-sm">從雲端載入...</span>
          </div>
        ) : (
          <DailyChecklist tasks={tasks} onToggleSlot={toggleTimeSlot} onOpenDetail={task => setDetailTask(task)} currentDate={currentDate} />
        )}

        {!tasksLoading && tasks.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="text-violet-500" size={28}/>
            </div>
            <h3 className="text-gray-700 font-semibold text-lg">開始建立你的習慣</h3>
            <p className="text-gray-400 text-sm mt-2 mb-5">點擊「設定目標」來新增第一個習慣</p>
            <button onClick={() => setShowGoalModal(true)}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 shadow-md shadow-violet-200 inline-flex items-center gap-2">
              <Plus size={18}/>設定我的第一個目標
            </button>
          </div>
        )}

        <p className="text-center text-xs text-gray-300 pb-4 pt-2">
          資料同步至 Supabase 雲端・跨裝置即時同步
        </p>
      </main>

      {showGoalModal && (
        <GoalModal
          tasks={tasks}
          onClose={() => {
            setShowGoalModal(false)
            // 若是從週計畫進入，關閉後回到週計畫
            if (editingTask || weeklyAddDays) setShowWeeklyModal(true)
            setEditingTask(null)
            setWeeklyAddDays(null)
          }}
          onSave={addTask}
          onUpdate={updateTask}
          onDelete={deleteTask}
          editTask={editingTask}
          defaultDays={weeklyAddDays}
        />
      )}
      {showWeeklyModal && (
        <WeeklyModal
          tasks={tasks}
          onClose={() => setShowWeeklyModal(false)}
          onDelete={deleteTask}
          onAdd={days => { setWeeklyAddDays(days); setShowWeeklyModal(false); setShowGoalModal(true) }}
          onEdit={task => { setEditingTask(task); setShowWeeklyModal(false); setShowGoalModal(true) }}
        />
      )}
      {showStatsModal && (
        <StatsModal tasks={tasks} onClose={() => setShowStatsModal(false)} />
      )}
      {detailTask && (
        <TaskDetailModal
          task={tasks.find(t => t.id === detailTask.id) || detailTask}
          onClose={() => setDetailTask(null)}
          onToggle={(id, done) => { toggleToday(id, done); setDetailTask(null) }}
        />
      )}
      {showNotepad && (
        <NotepadModal
          onClose={() => setShowNotepad(false)}
          supabase={supabase}
          userId={user.id}
        />
      )}
      {showBackup && (
        <BackupModal
          onClose={() => setShowBackup(false)}
          tasks={tasks}
          supabase={supabase}
          userId={user.id}
        />
      )}
    </div>
  )
}
