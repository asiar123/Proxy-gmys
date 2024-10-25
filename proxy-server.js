const express = require('express');
const axios = require('axios');
const cors = require('cors');
const qs = require('qs');
const https = require('https');

const app = express();

// Limita CORS a solo un origen confiable (frontend de producción)
const corsOptions = {
  origin: 'https://mi-frontend.com', // Reemplaza con tu dominio del frontend
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions)); // Implementa el CORS limitado

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Para procesar datos urlencoded

// Crear un agente HTTPS que use TLS v1.2 y que ignore la verificación de certificados
const agent = new https.Agent({
  rejectUnauthorized: false,
  secureProtocol: 'TLSv1_2_method',
});

// Middleware para manejar errores
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message || err);
  res.status(500).json({ error: 'Error al conectarse con el backend', details: err.message });
};

// Ruta para manejar el login
app.post('/login', async (req, res, next) => {
  try {
    const { usuario, passwd } = req.body;
    console.log('Datos enviados al backend:', usuario, passwd);

    // Envía la solicitud al web service utilizando el agente con TLS 1.2
    const response = await axios.post('https://ws.gmys.com.co/login', qs.stringify({
      usuario: usuario,
      passwd: passwd
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      httpsAgent: agent
    });

    console.log('Respuesta del backend:', response.data);
    res.json(response.data);
  } catch (error) {
    next(error); // Pasa el error al middleware de manejo de errores
  }
});

// Cache de respuestas (opcional)
const cache = {};

// Ruta para manejar las solicitudes de vehículos del usuario
app.get('/vehiculos_user', async (req, res, next) => {
  try {
    const { usuario_id } = req.query;
    console.log('Datos del usuario recibidos en el proxy:', usuario_id);

    // Si ya hay una respuesta en caché, se devuelve directamente
    if (cache[usuario_id]) {
      console.log('Usando datos de caché');
      return res.json(cache[usuario_id]);
    }

    const response = await axios.get(`https://ws.gmys.com.co/vehiculos_user?usuario_id=${usuario_id}`, { httpsAgent: agent });

    console.log('Respuesta del backend:', response.data);
    cache[usuario_id] = response.data; // Guarda en caché
    res.json(response.data);
  } catch (error) {
    next(error); // Pasa el error al middleware de manejo de errores
  }
});

// Ruta para manejar las solicitudes de recorrido del vehículo
app.get('/vehiculo_recorrido', async (req, res, next) => {
  try {
    const { vehi_id, fecha_i, fecha_f } = req.query;
    console.log('Datos del recorrido recibidos en el proxy:', vehi_id, fecha_i, fecha_f);

    const response = await axios.get(`https://ws.gmys.com.co/vehiculo_recorrido?vehi_id=${vehi_id}&fecha_i=${fecha_i}&fecha_f=${fecha_f}`, { httpsAgent: agent });

    console.log('Respuesta del backend:', response.data);
    res.json(response.data);
  } catch (error) {
    next(error); // Pasa el error al middleware de manejo de errores
  }
});

// Middleware de manejo de errores
app.use(errorHandler);

// Configuración del puerto
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor proxy escuchando en el puerto ${port}`);
});
