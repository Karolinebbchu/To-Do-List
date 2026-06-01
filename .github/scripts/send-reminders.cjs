const webpush = require('web-push')
const { createClient } = require('@supabase/supabase-js')

// ── Setup ─────────────────────────────────────────────────────
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

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

  // Fetch all push subscriptions
  const { data: subs, error: sErr } = await supabase.from('push_subscriptions').select('*')
  if (sErr) { console.error('❌ Subscriptions fetch error:', sErr.message); return }
  if (!subs?.length) { console.log('ℹ️  No push subscriptions registered'); return }

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
  if (!dueNow.length) return

  // Send push to every registered device
  for (const sub of subs) {
    for (const reminder of dueNow) {
      const payload = JSON.stringify({
        title: '📌 習慣提醒',
        body:  `「${reminder.name}」${reminder.time} 的時間到了！`,
        tag:   `habit-${reminder.id}-${reminder.time}`,
      })
      try {
        await webpush.sendNotification(sub.subscription, payload)
        console.log(`✅ Sent "${reminder.name}" to device ${sub.id}`)
      } catch (err) {
        console.error(`❌ Push failed (${err.statusCode}):`, err.body)
        // Remove expired / invalid subscriptions automatically
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          console.log(`🗑️  Removed invalid subscription ${sub.id}`)
        }
      }
    }
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
