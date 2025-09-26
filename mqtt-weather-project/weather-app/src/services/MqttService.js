// services/MqttService.js
import mqtt from 'mqtt';

class MqttService {
    constructor() {
        this.client = null;
    }

    connect(url = 'ws://localhost:9001', topic = 'weather', onMessageCallback) {
        if (this.client) return this.client; // already connected

        this.client = mqtt.connect(url, { reconnectPeriod: 5000 });

        this.client.on('connect', () => {
            console.log('Connected to MQTT broker');
            this.client.subscribe(topic, (err) => {
                if (err) console.error('Error subscribing:', err);
            });
        });

        this.client.on('reconnect', () => console.log('Reconnecting...'));
        this.client.on('error', (err) => console.error('MQTT Error:', err));

        this.client.on('message', (topic, message) => {
            try {
                const data = JSON.parse(message.toString());
                onMessageCallback && onMessageCallback(data);
            } catch (err) {
                console.error('Error parsing MQTT message:', err.message);
            }
        });

        return this.client;
    }
}

export default new MqttService();
