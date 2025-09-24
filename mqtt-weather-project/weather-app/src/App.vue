<template>
  <div>
    <h1>Wetterstationen Dashboard</h1>
*
    <p>Status: {{ connectionStatus }}</p>

    <div v-for="(station, id) in stations" :key="id" :class="['station-card', { invalid: !station.valid }]">
      <h2>Station: {{ id }}</h2>
      <p>Temperatur: {{ station.temperature }} °C</p>
      <p>Luftfeuchtigkeit: {{ station.humidity }} %</p>
      <p>Letzter Empfang: {{ station.timestamp }}</p>
      <p v-if="!station.valid" class="error">
        Ungültige Daten: {{ station.issues.join(', ') }}
      </p>

      <p>Durchschnitt letzte 5 Min: {{ stats[id]?.avgTemp?.toFixed(1) }} °C / {{ stats[id]?.avgHumidity?.toFixed(1) }} %</p>
      <p>Heute Min/Max: {{ stats[id]?.minTemp }} / {{ stats[id]?.maxTemp }} °C, {{ stats[id]?.minHumidity }} / {{ stats[id]?.maxHumidity }} %</p>

      <canvas :id="'chart-' + id"></canvas>
      <hr />
    </div>
  </div>
</template>

<script>
import { reactive, ref, onMounted } from 'vue';
import mqtt from 'mqtt';
import { Chart, LineController, LineElement, PointElement, LinearScale, Title, CategoryScale } from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, Title, CategoryScale);

export default {
  name: 'MqttWeather',
  setup() {
    const stations = reactive({});
    const connectionStatus = ref('Connecting...');
    const stats = reactive({}); // Statistik-Modul
    const history = reactive({}); // für 5-minütige Daten und Graphen

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

    function updateStats(stationId) {
      const now = Date.now();
      const fiveMinAgo = now - 5 * 60 * 1000;

      // Filter last 5 minutes
      const last5Min = (history[stationId] || []).filter(d => d.timestamp >= fiveMinAgo);

      if (last5Min.length > 0) {
        stats[stationId] = {
          avgTemp: last5Min.reduce((sum, d) => sum + d.temperature, 0) / last5Min.length,
          avgHumidity: last5Min.reduce((sum, d) => sum + d.humidity, 0) / last5Min.length,
          minTemp: Math.min(...last5Min.map(d => d.temperature)),
          maxTemp: Math.max(...last5Min.map(d => d.temperature)),
          minHumidity: Math.min(...last5Min.map(d => d.humidity)),
          maxHumidity: Math.max(...last5Min.map(d => d.humidity)),
        };
      }
    }

    function renderChart(stationId) {
      const ctx = document.getElementById('chart-' + stationId).getContext('2d');
      const data = history[stationId] || [];
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.map(d => new Date(d.timestamp).toLocaleTimeString()),
          datasets: [
            {
              label: 'Temperatur °C',
              data: data.map(d => d.temperature),
              borderColor: 'red',
              fill: false
            },
            {
              label: 'Luftfeuchtigkeit %',
              data: data.map(d => d.humidity),
              borderColor: 'blue',
              fill: false
            }
          ]
        },
        options: { responsive: true }
      });
    }

    onMounted(() => {
      const client = mqtt.connect('ws://localhost:9001', { reconnectPeriod: 5000 });

      client.on('connect', () => {
        connectionStatus.value = 'Connected';
        client.subscribe('weather', (err) => {
          if (err) console.error('Fehler beim Abonnieren des Topics:', err);
        });
      });

      client.on('reconnect', () => { connectionStatus.value = 'Reconnecting...'; });
      client.on('error', () => { connectionStatus.value = 'Error'; });

      client.on('message', (topic, message) => {
        try {
          const data = JSON.parse(message.toString());
          const { valid, issues } = validateData(data);
          if (!data.stationId) return;

          // Update latest data
          stations[data.stationId] = {
            temperature: data.temperature,
            humidity: data.humidity,
            timestamp: new Date(data.timestamp).toLocaleTimeString(),
            valid,
            issues
          };

          // Save history
          if (!history[data.stationId]) history[data.stationId] = [];
          history[data.stationId].push({
            temperature: data.temperature,
            humidity: data.humidity,
            timestamp: data.timestamp
          });

          // Keep only last 24 hours for chart
          history[data.stationId] = history[data.stationId].filter(d => d.timestamp > Date.now() - 24*60*60*1000);

          // Update statistics
          updateStats(data.stationId);

          // Render chart
          renderChart(data.stationId);

        } catch (err) {
          console.error('Fehler beim Verarbeiten der Nachricht:', err.message);
        }
      });
    });

    return { stations, connectionStatus, stats };
  }
};
</script>

<style>
.station-card {
  border: 1px solid #ccc;
  padding: 10px;
  margin-bottom: 10px;
  border-radius: 5px;
}

.station-card.invalid {
  background-color: #ffe5e5;
  border-color: red;
}

.error {
  color: red;
  font-weight: bold;
}
</style>
