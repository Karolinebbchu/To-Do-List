const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // service role key — bypasses RLS to read all tasks
)

const TZ = process.env.USER_TIMEZONE || 'Asia/Hong_Kong'

// ── Helpers ───────────────────────────────────────────────────
function getNowInTZ() {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    hour:    '2-digit',
    minute:  '2-digit',
    hour12:  false,
  }).formatToParts(now)
  const get = type => parts.find(p => p.type === type)?.value || ''
  const hh = get('hour').padStart(2, '0')
  const mm = get('minute').padStart(2, '0')
  // formatToParts weekday gives 'Mon', 'Tue', etc.
  return { todayKey: get('weekday'), hhmm: `${hh}:${mm}` }
}

function getTimesForDay(reminderTimes, dayKey) {
  if (!reminderTimes) return []
  if (Array.isArray(reminderTimes)) return reminderTimes
  return reminderTimes[dayKey] || []
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const { todayKey, hhmm } = getNowInTZ()
  console.log(`⏰ Checking reminders — ${todayKey} ${hhmm} (${TZ})`)

  // Fetch all tasks using service role key
  const { data: tasks, error: tErr } = await supabase.from('tasks').select('*')
  if (tErr) { console.error('❌ Tasks fetch error:', tErr.message); return }

  console.log(`📦 Total tasks fetched: ${tasks.length}`)

  // Find reminders due right now
  const dueNow = []
  tasks.forEach(task => {
    const targetDays = task.target_days || []
    const hasToday = targetDays.includes(todayKey)
    const times = getTimesForDay(task.reminder_times, todayKey)
    console.log(`🔍 "${task.name}" | days=${JSON.stringify(targetDays)} | hasToday=${hasToday} | times=${JSON.stringify(times)} | persistent=${task.persistent_reminder}`)
    if (!hasToday) return

    const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: TZ })

    times.forEach(t => {
      // Compare times in HKT directly (both hhmm and t are already HKT strings)
      const [rh, rm] = t.split(':').map(Number)
      const [ch, cm] = hhmm.split(':').map(Number)
      const diffMinutes = (ch * 60 + cm) - (rh * 60 + rm)

      // Check if already completed
      const history = task.history || {}
      const val = history[dateStr]
      const isDone = val === true || (Array.isArray(val) && val.includes(t))
      if (isDone) return

      // Window = 2 min (matches cron-job.org interval) so non-persistent habits fire exactly once
      const inInitialWindow = diffMinutes >= 0 && diffMinutes < 2

      // Persistent reminder: keep firing every repeat_interval minutes for up to 60 mins
      const repeatInterval = task.repeat_interval || 2
      const inPersistentWindow = task.persistent_reminder
        && diffMinutes >= 0
        && diffMinutes < 60
        && (diffMinutes % repeatInterval) < 5

      if (inInitialWindow || inPersistentWindow) {
        dueNow.push({ name: task.name, time: t, id: task.id, persistent: !!task.persistent_reminder })
      }
    })
  })

  console.log(`📋 Due reminders: ${dueNow.length}`)

  // Send via ntfy.sh
  const topic = process.env.NTFY_TOPIC
  if (!topic) { console.error('❌ NTFY_TOPIC secret not set'); return }

  async function ntfySend(title, message, priority = 3) {
    const res = await fetch('https://ntfy.sh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, title, message, priority, tags: ['bell'] }),
    })
    return res.status
  }

  if (!dueNow.length) {
    console.log(`ℹ️  No due reminders at ${hhmm}`)
    return
  }

  for (const reminder of dueNow) {
    try {
      const status = await ntfySend('Habit Reminder', `[${reminder.time}] ${reminder.name} - time to do it!`, 4)
      console.log(`✅ ntfy sent "${reminder.name}" — status ${status}`)
    } catch (err) {
      console.error(`❌ ntfy failed:`, err.message)
    }
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
