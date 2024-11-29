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
const addressCache = new NodeCache({ stdTTL: 86400 * 7 }); // Caché válido por 7 días

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));


const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 500, // 100 solicitudes por minuto por IP
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

    const rawData = response.data; // Assuming response.data is an array of reports

    const filteredData = [];
    let lastIncludedReport = null;

    for (const report of rawData) {
      // Always include the first report
      if (!lastIncludedReport) {
        filteredData.push(report);
        lastIncludedReport = report;
        continue;
      }

      // Include report if position or speed changes
      if (
        report.position !== lastIncludedReport.position ||
        report.speed !== lastIncludedReport.speed
      ) {
        filteredData.push(report);
        lastIncludedReport = report;
      }
    }

    res.json(filteredData);
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

//like you tell me " before the making geocoding " I think that you telling me to this part equally confirm
app.post("/optimize-reports", (req, res) => {
  const reports = req.body; // Array of reports with { lat, lon, speed }

  const uniqueReports = [];
  const seenCoordinates = new Set();

  for (const report of reports) {
    const key = `${report.lat},${report.lon}`;

    if (!seenCoordinates.has(key) || report.speed > 0) {
      seenCoordinates.add(key);
      uniqueReports.push(report);
    }
  }

  res.json(uniqueReports);
});

//I add the part of batch in this aprt after the optimize-reports
// Optimize address fetching by batching duplicate coordinates
app.post("/batch-geocode", async (req, res) => {
  const { locations } = req.body; // Receive an array of { lat, lon }

  if (!locations || !Array.isArray(locations)) {
    return res.status(400).json({ error: "Invalid locations format." });
  }

  const uniqueLocations = [...new Set(locations.map(({ lat, lon }) => `${lat},${lon}`))];
  const results = {};

  for (const loc of uniqueLocations) {
    const [lat, lon] = loc.split(",");
    const cacheKey = `${lat},${lon}`;

    // Check cache first
    if (addressCache.has(cacheKey)) {
      results[cacheKey] = addressCache.get(cacheKey);
      continue;
    }

    try {
      console.log(`Fetching address for lat=${lat}, lon=${lon}`);
      await delay(1000); // Throttle requests to avoid rate limits
      const response = await axios.get("https://nominatim.openstreetmap.org/reverse", {
        params: { format: "json", lat, lon },
        timeout: 5000,
        headers: { "User-Agent": "Your-App-Name" }, // Identify your application
        httpsAgent: agent,
      });

      const address = response.data.display_name || "Dirección no disponible";
      addressCache.set(cacheKey, address); // Cache the response
      results[cacheKey] = address;
    } catch (error) {
      console.error("Error fetching address for:", cacheKey, error.message);
      results[cacheKey] = "Error fetching address";
    }
  }

  res.json(results); // Return all results in a single response
});



// Geocoding route
app.get("/reverse-geocode", limiter, async (req, res) => {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    console.error("Faltan parámetros: lat y lon");
    return res.status(400).json({ error: "Missing latitude or longitude" });
  }

  const cacheKey = `${lat},${lon}`;

  if (addressCache.has(cacheKey)) {
    console.log("Cache hit for:", cacheKey);
    return res.json(addressCache.get(cacheKey));
  }

  try {
    console.log(`Solicitando geocodificación para lat=${lat}, lon=${lon}`);
    await delay(500); // Add a delay of 500ms to prevent hitting rate limits
    const response = await axios.get("https://nominatim.openstreetmap.org/reverse", {
      params: { format: "json", lat, lon },
      timeout: 5000,
      httpsAgent: agent,
    });

    addressCache.set(cacheKey, response.data);
    res.json(response.data);
  } catch (error) {
    console.error("Error al conectar con el servicio de geocodificación:");
    if (error.response) {
      console.error("Código de estado:", error.response.status);
      console.error("Datos de respuesta:", error.response.data);
    } else if (error.request) {
      console.error("No se recibió respuesta del servidor:");
      console.error("Detalles de la solicitud:", error.request);
    } else {
      console.error("Error al configurar la solicitud:", error.message);
    }
    res.status(500).json({ error: "Error connecting to geocoding service" });
  }
});


// Prueba de conectividad a OpenStreetMap al iniciar
(async () => {
  try {
    console.log("Realizando prueba de conexión a OpenStreetMap...");
    const response = await axios.get("https://nominatim.openstreetmap.org/reverse", {
      params: { format: "json", lat: 4.79959, lon: -75.744102 },
      timeout: 5000, // Tiempo límite de espera
      httpsAgent: agent, // Usar el agente HTTPS
    });
    console.log("Conexión exitosa. Respuesta de OpenStreetMap:", response.data);
  } catch (error) {
    console.error("Error al intentar conectar con OpenStreetMap:");
    if (error.response) {
      console.error("Código de estado:", error.response.status);
      console.error("Datos de respuesta:", error.response.data);
    } else if (error.request) {
      console.error("No se recibió respuesta del servidor:");
      console.error("Detalles de la solicitud:", error.request);
    } else {
      console.error("Error al configurar la solicitud:", error.message);
    }
  }
})();




// ===================================
// SERVER START
// ===================================
const port = process.env.PORT || 3000;

// Prueba de conectividad a OpenStreetMap
(async () => {
  try {
    console.log("Realizando prueba de conexión a OpenStreetMap...");
    const response = await axios.get("https://nominatim.openstreetmap.org/reverse", {
      params: { format: "json", lat: 4.79959, lon: -75.744102 },
      timeout: 5000, // Tiempo límite de espera
    });
    console.log("Conexión exitosa. Respuesta de OpenStreetMap:", response.data);
  } catch (error) {
    console.error("Error al intentar conectar con OpenStreetMap:");
    if (error.response) {
      // Si el servidor responde con un código de error HTTP (como 403, 404, etc.)
      console.error("Código de estado:", error.response.status);
      console.error("Datos de respuesta:", error.response.data);
    } else if (error.request) {
      // Si la solicitud fue hecha pero no se recibió respuesta
      console.error("No se recibió respuesta del servidor:");
      console.error("Detalles de la solicitud:", error.request);
    } else {
      // Errores en la configuración de la solicitud
      console.error("Error al configurar la solicitud:", error.message);
    }
  }
})();


app.listen(port, () => {
  console.log(`Servidor proxy escuchando en el puerto ${port}`);
});
