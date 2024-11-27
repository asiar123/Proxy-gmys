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
const addressCache = new NodeCache({ stdTTL: 3600 }); // Cache TTL: 1 hour

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 5, // Allow up to 5 requests per second
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true, // Send rate limit info in response headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
});

// HTTPS agent for secure connections
const agent = new https.Agent({
  rejectUnauthorized: false,
  secureProtocol: "TLSv1_2_method",
});

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Reverse Geocoding with OpenStreetMap
app.get("/reverse-geocode", limiter, async (req, res, next) => {
  const { lat, lon } = req.query;
  const cacheKey = `${lat},${lon}`;

  if (!lat || !lon || isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: "Invalid latitude or longitude" });
  }

  if (addressCache.has(cacheKey)) {
    return res.json(addressCache.get(cacheKey));
  }

  try {
    const response = await axios.get(
      `${NOMINATIM_API}/reverse?format=json&lat=${lat}&lon=${lon}`
    );

    const data = {
      road: response.data.address?.road || "Unknown Road",
      city: response.data.address?.city || response.data.address?.town || "Unknown City",
      state: response.data.address?.state || "Unknown State",
      country: response.data.address?.country || "Unknown Country",
    };

    addressCache.set(cacheKey, data); // Save response in cache
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// ===================================
// SERVER START
// ===================================
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor proxy escuchando en el puerto ${port}`);
});
