const express = require("express");
const admin = require("firebase-admin");

const app = express();
const PORT = process.env.PORT || 3000;

// 🔹 Verificar que la variable de entorno exista
if (!process.env.FIREBASE_CREDENTIALS) {
  console.error("❌ ERROR: La variable de entorno FIREBASE_CREDENTIALS no está definida.");
  process.exit(1);
}

let firebaseCredentials;

try {
  firebaseCredentials = JSON.parse(process.env.FIREBASE_CREDENTIALS);
} catch (error) {
  console.error("❌ ERROR: No se pudo parsear FIREBASE_CREDENTIALS. Verifica el formato JSON.");
  process.exit(1);
}

// 🔹 Inicializar Firebase
admin.initializeApp({
  credential: admin.credential.cert(firebaseCredentials),
  databaseURL: "https://ppg-iot-default-rtdb.firebaseio.com/",
});

const db = admin.database();

// 🔹 Endpoint para obtener datos de Firebase
app.get("/ppg_data_filtered", async (req, res) => {
  try {
    const snapshot = await db.ref("ppg_data_filtered").once("value");
    if (!snapshot.exists()) {
      return res.status(404).json({ message: "No data found" });
    }
    res.json(snapshot.val());
  } catch (error) {
    console.error("❌ ERROR en /ppg_data_filtered:", error);
    res.status(500).json({ error: error.message });
  }
});

// 🔹 Iniciar el servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en el puerto ${PORT}`);
});
