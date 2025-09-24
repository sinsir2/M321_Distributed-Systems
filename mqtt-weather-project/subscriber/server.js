import mqtt from 'mqtt';

const client = mqtt.connect('ws://localhost:9001', {
    reconnectPeriod: 5000
});

const stations = {};

function validateData(data) {
    let valid = true;
    let issues = [];

    if (typeof data.temperature !== 'number' || data.temperature < -273) {
        valid = false;
        issues.push(`Ungültige Temperatur: ${data.temperature}`);
    }

    if (typeof data.humidity !== 'number' || data.humidity < 0 || data.humidity > 100) {
        valid = false;
        issues.push(`Ungültige Luftfeuchtigkeit: ${data.humidity}`);
    }

    return { valid, issues };
}

client.on('connect', () => {
    console.log('Verbunden mit MQTT-Broker');
    client.subscribe('weather', (err) => {
        if (err) {
            console.error('Fehler beim Abonnieren des Topics:', err);
        } else {
            console.log('Abonniert Topic: weather');
        }
    });
});

client.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        const { valid, issues } = validateData(data);

        //console.log("message from " + data.stationId)
        stations[data.stationId] = {
            temperature: data.temperature,
            humidity: data.humidity,
            timestamp: data.timestamp,
            valid,
            issues
        };

        displayStations();
    } catch (err) {
        console.error('Fehler beim Verarbeiten der Nachricht:', err.message);
    }
});

function displayStations() {
    console.clear();
    console.log('=== Wetterstationen ===');
    for (const [id, data] of Object.entries(stations)) {
        console.log(`Station: ${id}`);
        console.log(`  Temperatur: ${data.temperature} °C`);
        console.log(`  Luftfeuchtigkeit: ${data.humidity} %`);
        console.log(`  Letzter Empfang: ${data.timestamp}`);
        if (!data.valid) {
            console.log(`Ungültige Daten: ${data.issues.join(', ')}`);
        }
        console.log('-----------------------');
    }
}
