const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());

// Crear usuario
app.post("/usuarios", async (req, res) => {
    try {
      const { nombre = "", email = "", genero = "" } = req.body;
      
      if (!nombre || !email) {
        return res.status(400).json({ error: "Nombre y email son obligatorios" });
      }
      
      // Verificar si el email ya está registrado
      const snapshot = await db.collection("usuarios").where("email", "==", email).get();
      if (!snapshot.empty) {
        return res.status(400).json({ error: "El email ya está registrado" });
      }
      
      const newUser = await db.collection("usuarios").add({
        nombre,
        email,
        genero,
      });
      res.status(201).json({ id: newUser.id, message: "Usuario creado con éxito" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

// Obtener usuarios
app.get("/usuarios", async (req, res) => {
  try {
    const snapshot = await db.collection("usuarios").get();
    const usuarios = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear un registro de PPG para un usuario
app.post("/usuarios/:id/registros", async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha, frecuencia_cardiaca, ppg_datos, estado, comentario, modelo_prediccion, umbral_alerta } = req.body;
    
    const newRegistro = await db.collection("usuarios").doc(id).collection("registros").add({
      fecha,
      frecuencia_cardiaca,
      ppg_datos,
      estado,
      comentario,
      modelo_prediccion,
      umbral_alerta,
    });
    res.status(201).json({ id: newRegistro.id, message: "Registro creado con éxito" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener registros de un usuario
app.get("/usuarios/:id/registros", async (req, res) => {
  try {
    const { id } = req.params;
    const snapshot = await db.collection("usuarios").doc(id).collection("registros").get();
    const registros = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
