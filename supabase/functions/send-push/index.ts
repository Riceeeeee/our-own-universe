import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import webpush from "npm:web-push"

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

serve(async (req) => {
  try {
    const payload = await req.json()
    const { record, table, type } = payload

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Lấy tất cả subscriptions trừ người gửi (nếu có thông tin người gửi)
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
    
    if (!subscriptions) return new Response('No subscriptions found', { status: 200 })

    let title = 'Our Own Universe'
    let body = 'Có cập nhật mới!'
    let url = '/'

    if (table === 'memories') {
      title = 'Kỷ niệm mới từ ' + record.created_by
      body = record.title
      url = '/#museum'
    } else if (table === 'mood_logs') {
      title = record.user_name + ' vừa cập nhật'
      body = record.content
      url = '/'
    }

    const notificationPayload = JSON.stringify({
      title,
      body,
      url
    })

    const sendPromises = subscriptions.map((sub: any) => {
      // Không gửi cho chính mình nếu biết user_name (tùy chọn)
      if (record.created_by === sub.user_name || record.user_name === sub.user_name) {
         // return Promise.resolve(); 
      }
      
      return webpush.sendNotification(sub.subscription, notificationPayload)
        .catch((err: any) => {
          console.error('Error sending push:', err)
          if (err.statusCode === 410) {
            // Subscription has expired or is no longer valid
            return supabase.from('push_subscriptions').delete().eq('id', sub.id)
          }
        })
    })

    await Promise.all(sendPromises)

    return new Response('Notifications sent', { status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
