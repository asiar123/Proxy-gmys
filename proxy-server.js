const express = require("express");
const axios = require("axios");
const cors = require("cors");
const qs = require("qs");
const https = require("https");
const NodeCache = require("node-cache");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();

// Caching for reverse-geocode requests
const addressCache = new NodeCache({ stdTTL: 86400 }); // TTL: 24 horas

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // 100 solicitudes por minuto por IP
  message: { error: "Too many requests, please slow down." },
  keyGenerator: (req) => req.ip, // Genera claves basadas en la IP del cliente
});


app.use(limiter); // Apply the limiter globally


// HTTPS agent for secure connections
const agent = new https.Agent({
  rejectUnauthorized: false,
  secureProtocol: "TLSv1_2_method",
});

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1); // Enable trust for proxies

// Helper for API Base URLs (stored in .env file)
const API_BASE_URL = process.env.API_BASE_URL || "https://ws.gmys.com.co";
const NOMINATIM_API = process.env.NOMINATIM_API || "https://nominatim.openstreetmap.org";

// Centralized error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});


// ===================================
// ROUTES
// ===================================

// Login Route
app.post("/login", async (req, res, next) => {
  try {
    const { usuario, passwd } = req.body;
    console.log("Datos enviados al backend:", usuario, passwd);

    const response = await axios.post(
      `${API_BASE_URL}/login`,
      qs.stringify({ usuario, passwd }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        httpsAgent: agent,
      }
    );

    console.log("Respuesta del backend:", response.data);
    res.json(response.data);
  } catch (error) {
    console.error("Error en la solicitud:", error.message);
    res.status(500).json({ error: "Error al conectarse con el backend" });
  }
});

// Vehículos del Usuario
app.get("/vehiculos_user", async (req, res, next) => {
  try {
    const { usuario_id } = req.query;
    console.log("Datos del usuario recibidos:", usuario_id);

    const response = await axios.get(
      `${API_BASE_URL}/vehiculos_user?usuario_id=${usuario_id}`,
      { httpsAgent: agent }
    );

    res.json(response.data);
  } catch (error) {
    next(error);
  }
});

// Vehículo Recorrido
app.get("/vehiculo_recorrido", async (req, res, next) => {
  try {
    const { vehi_id, fecha_i, fecha_f } = req.query;
    console.log("Datos del recorrido recibidos:", vehi_id, fecha_i, fecha_f);

    const response = await axios.get(
      `${API_BASE_URL}/vehiculo_recorrido?vehi_id=${vehi_id}&fecha_i=${fecha_i}&fecha_f=${fecha_f}`,
      { httpsAgent: agent }
    );

    res.json(response.data);
  } catch (error) {
    next(error);
  }
});

// Eventos por Placa
app.get("/eventos_placa", async (req, res, next) => {
  try {
    const { vehi_id, fecha_i, fecha_f } = req.query;
    console.log("Datos de eventos recibidos:", vehi_id, fecha_i, fecha_f);

    const response = await axios.get(
      `${API_BASE_URL}/eventos_placa?vehi_id=${vehi_id}&fecha_i=${fecha_i}&fecha_f=${fecha_f}`,
      { httpsAgent: agent }
    );

    res.json(response.data);
  } catch (error) {
    next(error);
  }
});

// Geocercas por Placa
app.get("/geocerca_placa", async (req, res, next) => {
  try {
    const { vehi_id } = req.query;
    console.log("Datos de geocerca recibidos:", vehi_id);

    const response = await axios.get(
      `${API_BASE_URL}/geocerca_placa?vehi_id=${vehi_id}`,
      { httpsAgent: agent }
    );

    res.json(response.data);
  } catch (error) {
    next(error);
  }
});

// Consumo de Vehículo
app.get("/consumo_vehiculo", async (req, res, next) => {
  try {
    const { vehi_id, fecha_i, fecha_f } = req.query;
    console.log("Datos de consumo recibidos:", vehi_id, fecha_i, fecha_f);

    const response = await axios.get(
      `${API_BASE_URL}/consumo_placa?vehi_id=${vehi_id}&fecha_i=${fecha_i}&fecha_f=${fecha_f}`,
      { httpsAgent: agent }
    );

    res.json(response.data);
  } catch (error) {
    next(error);
  }
});

// Geocoding route
app.get("/reverse-geocode", limiter, async (req, res) => {
  const { lat, lon } = req.query;

  // Validar parámetros
  if (!lat || !lon) {
    return res.status(400).json({ error: "Missing latitude or longitude" });
  }

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: "Invalid latitude or longitude" });
  }

  const cacheKey = `${lat},${lon}`;

  // Verificar caché
  if (addressCache.has(cacheKey)) {
    console.log("Cache hit for:", cacheKey);
    return res.json(addressCache.get(cacheKey));
  }

  try {
    console.log(`Requesting geocoding for coordinates: lat=${lat}, lon=${lon}`);
    const response = await axios.get("https://nominatim.openstreetmap.org/reverse", {
      params: { format: "json", lat, lon },
      timeout: 5000,
    });

    addressCache.set(cacheKey, response.data);
    console.log("Cache set for:", cacheKey, "Data:", response.data);
    res.json(response.data);
  } catch (error) {
    console.error("Error response from geocoding service:", error.response?.data || "No response data");
    console.error("Error details:", error.message);
    res.status(500).json({ error: "Error connecting to geocoding service" });
  }
});



// ===================================
// SERVER START
// ===================================
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor proxy escuchando en el puerto ${port}`);
});
