const express = require('express');
const axios = require('axios');

const app = express();

const currentPort =  3000;
const otherServers = process.env.OTHER_BACKENDS.split(',');
const serverId = process.env.SERVER_ID;


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