const express = require('express');
const axios = require('axios');
const cors = require('cors');
const qs = require('qs');
const https = require('https');

const app = express();

// Habilita CORS para permitir solicitudes desde cualquier origen
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Para procesar datos urlencoded

// Crear un agente HTTPS que use TLS v1.2 y que ignore la verificación de certificados
const agent = new https.Agent({
  rejectUnauthorized: false,
  secureProtocol: 'TLSv1_2_method',
});

// Ruta para manejar el login
app.post('/login', async (req, res) => {
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
    console.error('Error en la solicitud:', error);
    res.status(500).json({ error: 'Error al conectarse con el backend' });
  }
});

// Ruta para manejar las solicitudes de vehículos del usuario
app.use('/vehiculos_user', async (req, res) => {
  try {
    const { usuario_id } = req.query;
    console.log('Datos del usuario recibidos en el proxy:', usuario_id);

    const response = await axios.get(`https://ws.gmys.com.co/vehiculos_user?usuario_id=${usuario_id}`, { httpsAgent: agent });

    console.log('Respuesta del backend:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Error al conectar con el backend:', error);
    res.status(500).json({ error: 'Error al conectarse con el backend' });
  }
});

// Ruta para manejar las solicitudes de recorrido del vehículo
app.use('/vehiculo_recorrido', async (req, res) => {
  try {
    const { vehi_id, fecha_i, fecha_f } = req.query;
    console.log('Datos del recorrido recibidos en el proxy:', vehi_id, fecha_i, fecha_f);

    const response = await axios.get(`https://ws.gmys.com.co/vehiculo_recorrido?vehi_id=${vehi_id}&fecha_i=${fecha_i}&fecha_f=${fecha_f}`, { httpsAgent: agent });

    console.log('Respuesta del backend:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Error al conectar con el backend:', error);
    res.status(500).json({ error: 'Error al conectarse con el backend' });
  }
});

// Nueva ruta para manejar solicitudes de eventos por placa
app.use('/eventos_placa', async (req, res) => {
  try {
    const { vehi_id, fecha_i, fecha_f } = req.query;
    console.log('Datos de eventos recibidos en el proxy:', vehi_id, fecha_i, fecha_f);

    const response = await axios.get(`https://ws.gmys.com.co/eventos_placa?vehi_id=${vehi_id}&fecha_i=${fecha_i}&fecha_f=${fecha_f}`, { httpsAgent: agent });

    console.log('Respuesta del backend:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Error al conectar con el backend:', error);
    res.status(500).json({ error: 'Error al conectarse con el backend' });
  }
});

// Nueva ruta para manejar las solicitudes de geocercas por placa
app.use('/geocerca_placa', async (req, res) => {
  try {
    const { vehi_id } = req.query;
    console.log('Datos de geocerca recibidos en el proxy:', vehi_id);

    const response = await axios.get(`https://ws.gmys.com.co/geocerca_placa?vehi_id=${vehi_id}`, { httpsAgent: agent });

    console.log('Respuesta del backend de geocercas:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Error al conectar con el backend:', error);
    res.status(500).json({ error: 'Error al conectarse con el backend' });
  }
});

// Ruta para manejar las solicitudes de consumo de vehículo
app.use('/consumo_vehiculo', async (req, res) => {
  try {
    const { vehi_id, fecha_i, fecha_f } = req.query;
    console.log('Datos de consumo recibidos en el proxy:', vehi_id, fecha_i, fecha_f);

    const response = await axios.get(`https://ws.gmys.com.co/consumo_placa?vehi_id=${vehi_id}&fecha_i=${fecha_i}&fecha_f=${fecha_f}`, { httpsAgent: agent });

    console.log('Respuesta del backend de consumo:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Error al conectar con el backend:', error);
    res.status(500).json({ error: 'Error al conectarse con el backend' });
  }
});

// Ruta para manejar las solicitudes de geocodificación inversa de OpenStreetMap
app.get('/reverse-geocode', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    console.log('Coordenadas recibidas en el proxy para geocodificación:', lat, lon);

    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      { httpsAgent: agent } // Opcional si necesitas usar TLSv1.2 o ignorar certificados
    );

    console.log('Respuesta del backend de OpenStreetMap:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Error al conectar con OpenStreetMap:', error);
    res.status(500).json({ error: 'Error al conectarse con el servicio de geocodificación' });
  }
});


// Configuración del puerto
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor proxy escuchando en el puerto ${port}`);
});