const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const app = express();

const currentPort =  3000;
const otherServers = process.env.OTHER_BACKENDS?.split(',') ?? [];
const serverId = process.env.SERVER_ID ?? 'server1';


// Your AWS Cognito details
const COGNITO_USER_POOL_ID = 'us-east-1_z1z0IBBHC';
const COGNITO_REGION = 'us-east-1';
const APP_CLIENT_ID = '4b6ci6m9neo5lqtespmd9rv1i4';
const JWKS_URI = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`;

// Initialize JWKS client
const client = jwksClient({
  jwksUri: JWKS_URI,
});

// Helper function to get signing key
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

function validateToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    console.log("AUDIENCE", decoded.aud);

    // Validate the issuer (iss claim)
    const expectedIssuer = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`;
    if (decoded.iss !== expectedIssuer) {
      return res.status(401).json({ error: 'Unauthorized: Invalid issuer' });
    }

    req.user = decoded;
    next();
  });
}

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
});

app.use(express.json());

let counter = 0;

function simulateLatency() {
    return new Promise(resolve => setTimeout(resolve, Math.random() * 200));
}

app.post('/increment', async (req, res) => {
    await simulateLatency();

    counter++;
    console.log(`Counter incremented to ${counter}`);

    for (const server of otherServers) {
        try {
            await axios.post(`${server}/sync`, { counter });
        } catch (error) {
            console.log(`Failed to sync with ${server}`);
        }
    }
    res.send(`Counter incremented to ${counter} on server ${serverId}`);
});

app.post('/sync', async (req, res) => {
    await simulateLatency(); 

    counter = req.body.counter;
    console.log(`Counter synchronized to ${counter}`);
    res.sendStatus(200);
});

app.get('/counter', (req, res) => {
    res.json({ counter });
});

app.get('/protected', validateToken, (req, res) => {
    res.json({
      message: 'This is a protected route',
      user: req.user,
    });
  });

const fetchCountFromServer = async (server) => {
    try {
      const response = await fetch(`${server}/counter`);
      const data = await response.json();
      console.log(`Fetched count from server ${server}:`, data.counter);
      currentCount = data.counter; 
    } catch (error) {
      console.error(`Error fetching count from server ${server}:`, error);
    }
  };

  const initializeCounts = async () => {
    for (const server of otherServers) {
        await fetchCountFromServer(server);
    }
  };

app.listen(currentPort, async () => {
    await initializeCounts();
    console.log(`Server running on port ${currentPort}`)
});