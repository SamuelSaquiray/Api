const express = require("express");
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Cargar credenciales desde el archivo JSON
const serviceAccountPath = JSON.parse(process.env.FIREBASE_CREDENTIALS);


if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ Archivo de credenciales no encontrado.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath)),
  databaseURL: "https://ppg-iot-default-rtdb.firebaseio.com/",
});

const db = admin.database();

app.get("/ppg_data_filtered", async (req, res) => {
  try {
    const snapshot = await db.ref("ppg_data_filtered").once("value");
    if (!snapshot.exists()) {
      return res.status(404).json({ message: "No data found" });
    }
    res.json(snapshot.val());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en el puerto ${PORT}`);
});
