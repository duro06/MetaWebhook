const express = require('express')
const axios = require('axios')
const path = require('path')
const http = require('http') // Tambahan
const { Server } = require('socket.io') // Tambahan

const app = express()
const server = http.createServer(app) // 4. BUAT SERVER DULU (Penting!)
// PENTING: io harus dibangun dari 'server', bukan 'app'
const io = new Server(server, {
  cors: {
    origin: '*', // Biar nggak kena masalah akses
    methods: ['GET', 'POST'],
  },
})
app.use(express.json())

// Ambil variabel dari Environment (Docker)
const PORT = process.env.PORT || 3000
// server.listen(PORT, '0.0.0.0', () => { // Gunakan 'server', bukan 'app'
//   console.log(`🚀 Server & Socket.io running on port ${PORT}`);
// });
const VERIFY_TOKEN = process.env.VERIFY_TOKEN
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN
const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID

// 1. TAMPILAN DASHBOARD (Buka di browser: localhost:3000)
app.get('/', (req, res) => {
  // Jika ini request verifikasi dari Meta
  if (req.query['hub.mode']) {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    console.log('--- PERMINTAAN VERIFIKASI MASUK ---')
    console.log('Token dari Meta:', token)
    console.log('Token di Server:', VERIFY_TOKEN)

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('VERIFIKASI SUKSES! ✅')
      return res.status(200).send(challenge)
    } else {
      console.log('VERIFIKASI GAGAL! ❌ (Token tidak cocok)')
      return res.sendStatus(403)
    }
  }

  // Jika diakses biasa lewat browser
  res.sendFile(path.join(__dirname, 'views', 'index.html'))
})

// 2. LOGIKA MENERIMA & MEMBALAS PESAN
app.post('/', async (req, res) => {
  const body = req.body

  // Cek apakah ini event dari WhatsApp
  if (body.object === 'whatsapp_business_account') {
    try {
      const entry = body.entry?.[0]?.changes?.[0]?.value
      const message = entry?.messages?.[0]

      if (message) {
        const from = message.from // Nomor pengirim
        let text = ''

        // A. CEK JIKA PESAN BERUPA TEKS
        if (message.type === 'text') {
          text = message.text.body.toLowerCase()
          console.log(`Pesan Teks masuk: "${text}" dari ${from}`)

          const chatData = {
            from: message.from,
            text: message.text?.body || '(Pesan non-teks)',
            time: new Date().toLocaleTimeString(),
          }
          // KIRIM KE DASHBOARD WEB (Socket.io) 🚀
          io.emit('new_chat', chatData)

          // (Logika balas otomatis kamu yang pake axios tetap di sini)
          console.log('Pesan diteruskan ke view:', chatData.text)

          if (text === 'menu') {
            await sendMenu(from)
          } else {
            await sendText(from, `Halo! Kamu tadi bilang: "${text}". Ketik *menu* untuk pilihan.`)
          }
        }

        // B. CEK JIKA PESAN BERUPA KLIK TOMBOL (REPLY)
        else if (message.type === 'interactive') {
          const buttonId = message.interactive.button_reply?.id
          console.log(`Tombol diklik: ID ${buttonId}`)

          if (buttonId === 'btn_layanan') {
            await sendText(from, 'Layanan kami: Webhook, Docker, dan Chatbot AI.')
          } else if (buttonId === 'btn_lokasi') {
            await sendText(from, '📍 Lokasi kami ada di Cloud (Server Jakarta).')
          }
        }
      }
      if (entry.statuses) {
        const statusUpdate = entry.statuses[0]
        const statusData = {
          messageId: statusUpdate.id, // ID pesan yang kita kirim tadi
          status: statusUpdate.status, // sent, delivered, atau read
          recipient: statusUpdate.recipient_id,
        }

        console.log(`Status Update: ${statusData.status} untuk ${statusData.recipient}`)
        io.emit('status_update', statusData) // Kirim ke dashboard
      }
      res.sendStatus(200)
    } catch (error) {
      console.error('Gagal memproses pesan:', error.response?.data || error.message)
      res.sendStatus(500)
    }
  } else {
    res.sendStatus(404)
  }
})

// --- FUNGSI PEMBANTU (HELPERS) ---

// Fungsi Kirim Teks Biasa
async function sendText(to, messageText) {
  await axios({
    method: 'POST',
    url: `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
    data: {
      messaging_product: 'whatsapp',
      to: to,
      text: { body: messageText },
    },
    headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` },
  })
}

// Fungsi Kirim Menu Tombol
async function sendMenu(to) {
  await axios({
    method: 'POST',
    url: `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
    data: {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: 'Silakan pilih opsi di bawah ini:' },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'btn_layanan', title: 'Cek Layanan' } },
            { type: 'reply', reply: { id: 'btn_lokasi', title: 'Info Lokasi' } },
          ],
        },
      },
    },
    headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` },
  })
}

// --- LOGIKA SOCKET.IO (Untuk komunikasi Browser <-> Server) ---

io.on('connection', (socket) => {
  console.log('✅ Browser Dashboard Terhubung ke Socket.io')

  // Dengerin perintah "send_message" dari browser
  socket.on('send_message', async (data) => {
    const { to, text } = data
    console.log(`📩 Browser minta kirim WA ke ${to}: ${text}`)

    try {
      // Tembak ke API Meta (WhatsApp Business API)
      await axios({
        method: 'POST',
        url: `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
        data: {
          messaging_product: 'whatsapp',
          to: to,
          text: { body: text },
        },
        headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` },
      })
      console.log('🚀 Pesan sukses terkirim ke Meta API')
    } catch (err) {
      console.error('❌ Gagal kirim pesan lewat Meta API:', err.response?.data || err.message)
    }
  })

  socket.on('disconnect', () => {
    console.log('❌ Browser Dashboard Terputus')
  })
})
// --- JALANKAN SERVER ---
// PENTING: Gunakan server.listen, BUKAN app.listen
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  #########################################
  🚀 Server Webhook & Socket.io Aktif!
  📱 Port: ${PORT}
  🔗 Akses Dashboard: http://localhost:${PORT}
  #########################################
  `)
})
