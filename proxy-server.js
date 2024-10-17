const express = require('express');
const axios = require('axios');
const cors = require('cors');
const qs = require('qs'); // Asegúrate de haber importado qs
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

    // Devuelve la respuesta del web service al frontend
    res.json(response.data);
  } catch (error) {
    console.error('Error en la solicitud:', error);
    res.status(500).json({ error: 'Error al conectarse con el backend' });
  }
});

// Maneja las solicitudes al endpoint /api/vehiculos_user
app.use('/vehiculos_user', async (req, res) => {
  try {
    const { usuario_id } = req.query; // Obtiene el ID del usuario desde la query string
    console.log('Datos del usuario recibidos en el proxy:', usuario_id);

    const response = await axios.get(`https://ws.gmys.com.co/api/vehiculos_user?usuario_id=${usuario_id}`);

    console.log('Respuesta del backend:', response.data);

    // Envía la respuesta del backend al frontend
    res.json(response.data);
  } catch (error) {
    console.error('Error al conectar con el backend:', error);
    res.status(500).json({ error: 'Error al conectarse con el backend' });
  }
});

// Configuración del puerto
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor proxy escuchando en el puerto ${port}`);
});