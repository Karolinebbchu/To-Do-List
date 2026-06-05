import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const TO_EMAIL       = 'tsangbobo49@gmail.com'
const FROM_EMAIL     = 'onboarding@resend.dev'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const reply = (body: object) =>
    new Response(JSON.stringify(body), {
      status: 200,                                          // always 200 so client sees the body
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {
    if (!RESEND_API_KEY) return reply({ error: 'RESEND_API_KEY secret is not set in Supabase' })

    const body = await req.json()

    // ── PIN reset mode ──────────────────────────────────────
    if (body.mode === 'pin-reset') {
      const { newPin, date } = body
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM_EMAIL, to: [TO_EMAIL],
          subject: `🔐 習慣追蹤 — 詳情密碼重設 ${date}`,
          html: `
            <h2 style="color:#7c3aed">詳情密碼已重設</h2>
            <p>您的新習慣詳情密碼為：</p>
            <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#7c3aed;background:#f5f3ff;padding:16px;border-radius:12px;text-align:center;margin:16px 0">${newPin}</div>
            <p style="color:#6b7280">請登入 App 後輸入此密碼查看私密習慣詳情。建議查看後自行更改為容易記住的密碼。</p>
            <hr/><p style="font-size:12px;color:#9ca3af">由每日習慣追蹤 App 自動產生</p>
          `,
        }),
      })
      const data = await res.json()
      if (!res.ok) return reply({ error: `Resend error: ${data?.message}` })
      return reply({ success: true })
    }

    // ── Backup mode (default) ───────────────────────────────
    const { backup, date } = body

    const taskLines = (backup.tasks ?? [])
      .map((t: { name: string }) => `• ${t.name}`)
      .join('\n') || '（無任務）'

    const jsonStr = JSON.stringify(backup, null, 2)
    const jsonB64 = btoa(unescape(encodeURIComponent(jsonStr)))

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      [TO_EMAIL],
        subject: `📋 習慣追蹤備份 ${date}`,
        html: `
          <h2 style="color:#7c3aed">習慣追蹤備份 — ${date}</h2>
          <h3>任務清單（${backup.tasks?.length ?? 0} 項）</h3>
          <pre style="background:#f5f3ff;padding:12px;border-radius:8px;font-size:14px">${taskLines}</pre>
          <h3>日記記錄（${backup.notes?.length ?? 0} 筆）</h3>
          <p style="color:#6b7280">備份 JSON 附件請見附件，下載後可從 App 還原。</p>
          <hr/><p style="font-size:12px;color:#9ca3af">由每日習慣追蹤 App 自動產生</p>
        `,
        attachments: [{ filename: `habit-backup-${date}.json`, content: jsonB64 }],
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      // Return the exact Resend error so the user can see it
      return reply({ error: `Resend error (${res.status}): ${data?.message ?? JSON.stringify(data)}` })
    }

    return reply({ success: true, id: data.id })

  } catch (err) {
    return reply({ error: String(err) })
  }
})
