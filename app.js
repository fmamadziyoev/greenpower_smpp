const express = require('express');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const smpp = require('smpp');
const winston = require('winston');

const app = express();
app.use(express.json());

// Configure Winston for logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: 'app.log', level: 'info' }),
    new winston.transports.Console(),
  ],
});

// Swagger Configuration
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'SMPP SMS API',
      version: '1.0.0',
      description: 'API for sending SMS using SMPP',
    },
    servers: [
      {
        url: 'http://localhost:3000',
      },
    ],
  },
  apis: ['./app.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Create an SMPP session
const session = new smpp.Session({ host: '195.246.103.248', port: 2222 });
let isConnected = false;
let isConnecting = false;

// Handle SMPP session events
session.on('connect', () => {
  logger.info('Connected to SMPP server');
  session.bind_transceiver(
    {
      system_id: 'Sayohon2',
      password: 'Nf6yE3mp',
      addr_ton: 1,
      addr_npi: 1,
    },
    (pdu) => {
      if (pdu.command_status === 0) {
        isConnected = true;
        isConnecting = false;
        logger.info('Successfully bound to SMPP server');
      } else {
        logger.error('Binding failed with status:', pdu.command_status);
        session.close();
      }
    },
  );
});

session.on('close', () => {
  logger.info('SMPP connection is now closed');
  isConnected = false;
  isConnecting = false;
  reconnectToServer();
});

session.on('error', (error) => {
  logger.error('SMPP error:', error.message || error);
  isConnected = false;
  isConnecting = false;
  reconnectToServer();
});

function reconnectToServer() {
  if (isConnecting) return;
  logger.info('Reconnecting to SMPP server...');
  isConnecting = true;
  setTimeout(() => {
    session.connect();
  }, 5000);
}

function sendSMS(from, to, text) {
  return new Promise((resolve, reject) => {
    if (!isConnected) {
      return reject('Not connected to SMPP server.');
    }

    session.submit_sm(
      {
        source_addr: from,
        destination_addr: to,
        short_message: text,
      },
      (pdu) => {
        if (pdu.command_status === 0) {
          logger.info(`Message sent successfully with ID: ${pdu.message_id}`);
          resolve({ messageId: pdu.message_id });
        } else {
          logger.error(`Failed to send message, status code: ${pdu.command_status}`);
          reject(`Failed to send message, status code: ${pdu.command_status}`);
        }
      },
    );
  });
}

/**
 * @swagger
 * /send-sms:
 *   post:
 *     summary: Send SMS using SMPP
 *     description: Sends an SMS message to a specified phone number.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *               - text
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "987654321"
 *                 minLength: 1
 *               text:
 *                 type: string
 *                 example: "Hello from Tajikistan!"
 *                 minLength: 1
 *     responses:
 *       200:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messageId:
 *                   type: string
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Phone number and text cannot be empty."
 *       500:
 *         description: Error sending message
 */
app.post('/send-sms', async (req, res) => {
  const { phoneNumber, text } = req.body;
  const from = '+992880514004'; // Customize with your source address
  const to = `+992${phoneNumber}`;

  if (!phoneNumber || !text) {
    logger.error('Validation error: Phone number and text cannot be empty.');
    return res.status(400).json({ message: 'Phone number and text cannot be empty.' });
  }

  try {
    const result = await sendSMS(from, to, text);
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error sending message:', error);
    res.status(500).json({ message: error });
  }
});

// Start server
const PORT = 3000;
app.listen(PORT, () => logger.info(`Server running on http://localhost:${PORT}`));

// Initiate connection to the SMPP server
session.connect();
