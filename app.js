const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());

const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN || "my_secret_token";

// Route untuk menampilkan View (Halaman Depan)
app.get('/', (req, res) => {
  // Jika ada query hub.mode, ini adalah request verifikasi dari Meta/Pihak ke-3
  if (req.query['hub.mode']) {
    const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;
    if (mode === 'subscribe' && token === verifyToken) {
      return res.status(200).send(challenge);
    }
    return res.status(403).end();
  }
  
  // Jika akses biasa lewat browser, tampilkan file HTML
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.post('/', (req, res) => {
  console.log("Data diterima:", JSON.stringify(req.body, null, 2));
  res.status(200).send('EVENT_RECEIVED');
});

app.listen(port, () => {
  console.log(`Server jalan di port ${port}`);
});