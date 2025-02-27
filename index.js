const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const twilio = require('twilio');
const nodemailer = require("nodemailer");
const ExcelJS = require("exceljs");


dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || "secreto_super_seguro"; // Clave secreta para JWT


const accountSid = process.env.accountSid;
const authToken = process.env.authToken;
const client = twilio(accountSid, authToken);


const sender_email = "samuel.saquiray@utec.edu.pe";
const sender_password = "qnqf akoa voxh gpxz";
const receiver_email = "samuel.saquiray@utec.edu.pe";


app.use(express.json());
app.use(cors());

// Cargar credenciales de Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://ppg-iot-default-rtdb.firebaseio.com/",
});

const db = admin.database();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: sender_email,
    pass: sender_password,
  },
});

const fetchLast200PPGData = async () => {
  try {
    const snapshot = await admin.database().ref("anomalias").orderByKey().limitToLast(200).once("value");
    const data = snapshot.val();
    return Object.values(data || {});
  } catch (error) {
    console.error("Error al obtener datos de PPG:", error);
    return [];
  }
};

// Función para generar el archivo Excel
const generatePPGExcel = async (userId) => {
  const data = await fetchLast200PPGData(userId);
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("PPG Data");

  worksheet.columns = [
    { header: "Timestamp", key: "timestamp", width: 20 },
    { header: "PPG Value", key: "ppgValue", width: 15 },
  ];

  data.forEach((item) => worksheet.addRow(item));

  const filePath = path.join(__dirname, "PPG_Data.xlsx");
  await workbook.xlsx.writeFile(filePath);
  return filePath;
};


// 📌 Registro de usuario (Signup)
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Todos los campos son obligatorios" });
    }

    // Verificar si el usuario ya existe
    const usersSnapshot = await db.ref("users").orderByChild("email").equalTo(email).once("value");
    if (usersSnapshot.exists()) {
      return res.status(400).json({ message: "El usuario ya está registrado" });
    }

    // Hashear la contraseña antes de guardarla
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario en Firebase
    const newUserRef = db.ref("users").push();
    const userData = {
      id: newUserRef.key,
      name,
      email,
      password: hashedPassword, // Guardamos la contraseña encriptada
      contact_emergency: [],
      heart_rate_data:[],
      ppg_data_filtered:[],
      createdAt: new Date().toISOString(),
    };

    await newUserRef.set(userData);
    res.status(201).json({ message: "Usuario registrado exitosamente", user: { id: userData.id, name, email } });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📌 Inicio de sesión (Login)
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Correo y contraseña son obligatorios" });
    }

    // Buscar usuario por email
    const usersSnapshot = await db.ref("users").orderByChild("email").equalTo(email).once("value");

    if (!usersSnapshot.exists()) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const userData = Object.values(usersSnapshot.val())[0]; // Tomar el primer usuario encontrado

    // Verificar contraseña
    const passwordMatch = await bcrypt.compare(password, userData.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Contraseña incorrecta" });
    }

    // Crear token JWT
    const token = jwt.sign({ id: userData.id, email: userData.email }, SECRET_KEY, { expiresIn: "7d" });

    res.json({ message: "Inicio de sesión exitoso", token, user: { id: userData.id, name: userData.name, email } });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📌 Obtener todos los usuarios
app.get("/users", async (req, res) => {
  try {
    const snapshot = await db.ref("users").once("value");
    if (!snapshot.exists()) {
      return res.status(404).json({ message: "No users found" });
    }
    res.json(snapshot.val());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📌 Obtener un usuario por ID
app.get("/user/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const snapshot = await db.ref(`users/${id}`).once("value");

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const userData = snapshot.val();
    delete userData.password; // No devolver la contraseña

    res.json(userData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📌 Actualizar usuario
app.put("/user/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, age, email, peso } = req.body;

    const userRef = db.ref(`users/${id}`);
    const snapshot = await userRef.once("value");

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    await userRef.update({ name, age, email, peso });
    res.json({ message: "Usuario actualizado correctamente" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📌 Eliminar usuario
app.delete("/user/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userRef = db.ref(`users/${id}`);
    const snapshot = await userRef.once("value");

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    await userRef.remove();
    res.json({ message: "Usuario eliminado correctamente" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📌 Obtener datos filtrados de PPG por usuario
app.get("/ppg_data_filtered/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const snapshot = await db.ref(`users/${userId}/ppg_data_filtered`).once("value");

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "No PPG data found" });
    }

    res.json(snapshot.val());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📌 Obtener datos de frecuencia cardiaca por usuario
app.get("/heart_rate_data/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const snapshot = await db.ref(`users/${userId}/heart_rate_data`).once("value");

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "No heart rate data found" });
    }

    res.json(snapshot.val());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/alerta-whatsapp', async (req, res) => {
  const { contact_emergency, mensaje } = req.body;

  if (!contact_emergency || contact_emergency.length === 0) {
    return res.status(400).json({ error: 'No hay contactos de emergencia' });
  }

  try {
    console.log(contact_emergency);
    for (let numero of contact_emergency) {
      await client.messages.create({

        body: mensaje,
        from: 'whatsapp:14155238886',
        to: `whatsapp:${numero}`
      });
    }

    res.json({ success: true, message: 'Mensajes de WhatsApp enviados' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/completar-perfil/:userId", async (req, res) => {
  try {
      const { userId } = req.params;
      const { fechaNacimiento, doc_email, peso, contact_emergency,altura } = req.body; 
      const calories=3;
      if (!fechaNacimiento || !doc_email || !peso || !contact_emergency) {
          return res.status(400).json({ error: "Todos los campos son obligatorios" });
      }

      await db.ref(`users/${userId}`).update({
          fechaNacimiento,
          doc_email,
          peso,
          altura,
          contact_emergency,
          calories:{
            kcal:calories
          }
      });

      res.json({ mensaje: "Perfil actualizado correctamente" });

  } catch (error) {
      res.status(500).json({ error: "Error al actualizar perfil" });
  }
});


app.post("/enviar-correo", async (req, res) => {
  const { email, userId, subject, message } = req.body;

  if (!email || !userId || !subject || !message) {
    return res.status(400).json({ error: "Faltan datos en la solicitud" });
  }

  try {
    // Generar archivo Excel con los últimos 200 datos del PPG
    const filePath = await generatePPGExcel(userId);

    const mailOptions = {
      from: `"Sistema de Alertas PPG" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      text: message,
      attachments: [{ filename: "PPG_Data.xlsx", path: filePath }],
    };

    await transporter.sendMail(mailOptions);
    console.log("📩 Correo con Excel enviado con éxito");

    // Eliminar el archivo después de enviarlo
    fs.unlinkSync(filePath);

    res.status(200).json({ message: "Correo enviado con éxito" });
  } catch (error) {
    console.error("❌ Error al enviar el correo:", error);
    res.status(500).json({ error: "Error al enviar el correo" });
  }
});

// 🚀 Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en el puerto ${PORT}`);
});

