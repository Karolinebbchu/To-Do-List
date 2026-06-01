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

  // Find reminders due right now
  const dueNow = []
  tasks.forEach(task => {
    const targetDays = task.target_days || []
    if (!targetDays.includes(todayKey)) return

    const times = getTimesForDay(task.reminder_times, todayKey)
    times.forEach(t => {
      if (t === hhmm) {
        // Check if already completed
        const history = task.history || {}
        const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: TZ }) // YYYY-MM-DD
        const val = history[dateStr]
        const isDone = val === true || (Array.isArray(val) && val.includes(t))
        if (!isDone) {
          dueNow.push({ name: task.name, time: t, id: task.id })
        }
      }
    })
  })

  console.log(`📋 Due reminders: ${dueNow.length}`)

  // Send via ntfy.sh
  const topic = process.env.NTFY_TOPIC
  if (!topic) { console.error('❌ NTFY_TOPIC secret not set'); return }

  // If no reminders due right now, send a test ping so we can verify ntfy works
  if (!dueNow.length) {
    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: { 'Title': '✅ 習慣提醒系統正常', 'Priority': 'default', 'Tags': 'white_check_mark' },
      body: `目前沒有到期提醒（${hhmm} HKT）。系統運作正常！`,
    })
    console.log('ℹ️  No due reminders — sent test ping')
    return
  }

  for (const reminder of dueNow) {
    try {
      const res = await fetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        headers: {
          'Title':    '📌 習慣提醒',
          'Priority': 'high',
          'Tags':     'bell',
        },
        body: `「${reminder.name}」${reminder.time} 的時間到了！`,
      })
      console.log(`✅ ntfy sent "${reminder.name}" — status ${res.status}`)
    } catch (err) {
      console.error(`❌ ntfy failed:`, err.message)
    }
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
