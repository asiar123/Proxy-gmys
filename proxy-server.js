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

app.get("/vehiculo_recorrido", async (req, res, next) => {
  try {
    let { vehi_id, fecha_i, fecha_f } = req.query;

    console.log("Datos originales del recorrido recibidos:", vehi_id, fecha_i, fecha_f);

    // Fecha actual en UTC
    const now = new Date();
    console.log("Fecha y hora actual en UTC:", now.toISOString());

    // Ajuste manual: restar 5 horas para calcular la fecha en UTC-5
    const nowInColombia = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    console.log("Fecha y hora ajustada a Colombia (UTC-5):", nowInColombia.toISOString());

    // Calcular inicio y fin del día en Colombia
    const startOfDay = new Date(nowInColombia);
    startOfDay.setHours(0, 0, 0, 0); // Inicio del día (00:00:00)

    const endOfDay = new Date(nowInColombia);
    endOfDay.setHours(23, 59, 59, 999); // Fin del día (23:59:59)

    console.log("Inicio del día en Colombia:", startOfDay.toISOString());
    console.log("Fin del día en Colombia:", endOfDay.toISOString());

    // Sobrescribir fechas manualmente si no están ajustadas correctamente
    fecha_i = startOfDay.toISOString().split("T")[0];
    fecha_f = endOfDay.toISOString().split("T")[0];

    console.log("Fechas ajustadas manualmente:", fecha_i, fecha_f);

    // Realizar la solicitud al backend con las fechas ajustadas
    const response = await axios.get(
      `${API_BASE_URL}/vehiculo_recorrido?vehi_id=${vehi_id}&fecha_i=${fecha_i}&fecha_f=${fecha_f}`,
      { httpsAgent: agent }
    );

    const rawData = response.data;

    // Validar si la respuesta es un array
    if (!Array.isArray(rawData)) {
      console.error("Respuesta inesperada del backend:", rawData);
      return res.status(500).json({
        error: "El backend devolvió una respuesta no válida",
        data: rawData,
      });
    }

    res.json(rawData);
  } catch (error) {
    console.error("Error en vehiculo_recorrido:", error.message);
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

// Optimize address fetching by batching duplicate coordinates
app.post("/batch-geocode", async (req, res) => {
  const { locations } = req.body;

  // Validate input
  if (
    !locations ||
    !Array.isArray(locations) ||
    !locations.every(
      (loc) =>
        typeof loc.lat === "number" &&
        typeof loc.lon === "number" &&
        loc.lat >= -90 &&
        loc.lat <= 90 &&
        loc.lon >= -180 &&
        loc.lon <= 180
    )
  ) {
    return res.status(400).json({
      error: "Invalid locations format. Each location must have numeric lat and lon within valid geographic ranges.",
    });
  }

  // Deduplicate and round coordinates to 5 decimal places
  const uniqueLocations = [
    ...new Map(
      locations.map(({ lat, lon }) => [
        `${Math.round(lat * 1e5) / 1e5},${Math.round(lon * 1e5) / 1e5}`,
        { lat, lon },
      ])
    ).values(),
  ];

  const results = {};

  // Helper to fetch address with retry
  const fetchAddressWithRetry = async (lat, lon, retries = 3) => {
    const cacheKey = `${lat},${lon}`;
    if (addressCache.has(cacheKey)) {
      console.log(`Cache hit for: ${cacheKey}`);
      return addressCache.get(cacheKey);
    }

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        console.log(`Fetching address for lat=${lat}, lon=${lon} (attempt ${attempt + 1})`);
        const response = await axios.get("https://nominatim.openstreetmap.org/reverse", {
          params: { format: "json", lat, lon },
          timeout: 5000,
          headers: { "User-Agent": "Your-App-Name" },
          httpsAgent: agent,
        });

        const address = response.data.display_name || "Dirección no disponible";
        addressCache.set(cacheKey, address); // Cache the response
        return address;
      } catch (error) {
        console.error(`Error fetching address for ${cacheKey} (attempt ${attempt + 1}):`, error.message);
        if (attempt === retries - 1) {
          return "Error fetching address"; // Return fallback after max retries
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt))); // Exponential backoff
      }
    }
  };

  // Fetch addresses for all unique locations
  await Promise.all(
    uniqueLocations.map(async ({ lat, lon }) => {
      const cacheKey = `${lat},${lon}`;
      results[cacheKey] = await fetchAddressWithRetry(lat, lon);
    })
  );

  console.log("Geocoding results:", results);
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