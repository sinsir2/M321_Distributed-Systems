<template>
  <div style="margin-left: -30px">
    <h1>Weather Broadcast</h1>
    <div class="stations-container">
      <div
          v-for="(station, id) in stations"
          :key="id"
          class="station-card"
      >
        <div class="card-header">
          <div class="info-card">
            <h2>Station: {{ id }}</h2>
            <br>
            <h3>Live data:</h3>
            <p>Temperature: {{ station.temperature }} °C</p>
            <p>Humidity: {{ station.humidity }} %</p>
            <p>Last value received: {{ station.timestamp }}</p>
            <p v-if="!station.valid" class="error">
              Invalid data: {{ station.issues.join(', ') }}
            </p>
          </div>

          <div class="info-card">
            <h3>Statistics</h3>

            <p>5-Minute Average:</p>
            <ul>
              <li>Temperature: {{ station.stats.avg5min.temperature?.toFixed(2) ?? '-' }} °C</li>
              <li>Humidity: {{ station.stats.avg5min.humidity?.toFixed(2) ?? '-' }} %</li>
            </ul>

            <p>Last Hour:</p>
            <ul>
              <li>Ø Temperature: {{ station.stats.lastHour.avgTemp?.toFixed(2) ?? '-' }} °C</li>
              <li>Min-Temperature: {{ station.stats.lastHour.minTemp ?? '-' }} °C</li>
              <li>Max-Temperature: {{ station.stats.lastHour.maxTemp ?? '-' }} °C</li>
              <li>Ø Humidity: {{ station.stats.lastHour.avgHum?.toFixed(2) ?? '-' }} %</li>
              <li>Min-Humidity: {{ station.stats.lastHour.minHum ?? '-' }} %</li>
              <li>Max-Humidity: {{ station.stats.lastHour.maxHum ?? '-' }} %</li>
            </ul>

            <p>Day statistics:</p>
            <ul>
              <li>Min-Temperature: {{ station.stats.daily.minTemp ?? '-' }} °C</li>
              <li>Max-Temperature: {{ station.stats.daily.maxTemp ?? '-' }} °C</li>
              <li>Min-Humidity: {{ station.stats.daily.minHum ?? '-' }} %</li>
              <li>Max-Humidity: {{ station.stats.daily.maxHum ?? '-' }} %</li>
            </ul>
          </div>
        </div>
        <canvas :id="'chartTemp' + id"></canvas>
        <canvas :id="'chartHum' + id"></canvas>
      </div>
    </div>
  </div>
</template>

<style>
.stations-container {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 500px;
  gap: 5px;
  overflow-x: hidden;
  padding-bottom: 10px;
}

.station-card {
  border: 1px solid #ccc;
  padding: 5px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 5px;
  margin-bottom: 10px;
}

.info-card {
  flex: 1;
  background: #f8f9fa;
  border-radius: 6px;
  padding: 10px;
}

.error {
  color: red;
  font-weight: bold;
}
</style>

<script>
import { reactive, onMounted, nextTick } from "vue";
import mqtt from "mqtt";
import Chart from "chart.js/auto";

export default {
  name: "WeatherBroadcast",
  setup() {
    const stations = reactive({});
    const charts = new Map();
    const MAX_POINTS = 30;

    const skipped = (ctx, value) =>
        ctx.p0.skip || ctx.p1.skip ? value : undefined;

    function validateData(data) {
      let valid = true;
      let issues = [];

      if (!isValidTemperature(data.temperature)) {
        valid = false;
        issues.push(`Invalid Temperature: ${data.temperature}`);
      }
      if (!isValidHumidity(data.humidity)) {
        valid = false;
        issues.push(`Invalid Humidity: ${data.humidity}`);
      }
      return { valid, issues };
    }

    function isValidTemperature(t) {
      return typeof t === "number" && t >= -273;
    }

    function isValidHumidity(h) {
      return typeof h === "number" && h >= 0 && h <= 100;
    }

    function addData(chart, label, value) {
      chart.data.labels.push(label);
      chart.data.datasets[0].data.push(value);

      if (chart.data.labels.length > MAX_POINTS) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
      }
      chart.update();
    }

    function renderCharts(stationId) {
      if (charts.has(stationId)) return;

      const tempCtx = document.getElementById("chartTemp" + stationId);
      const humCtx = document.getElementById("chartHum" + stationId);
      if (!tempCtx || !humCtx) return;

      const tempChart = new Chart(tempCtx, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            {
              label: "Temperatur °C",
              data: [],
              borderColor: "red",
              fill: false,
              segment: {
                borderColor: (ctx) => skipped(ctx, "rgb(0,0,0,0.2)"),
                borderDash: (ctx) => skipped(ctx, [6, 6]),
              },
              spanGaps: true,
            },
          ],
        },
        options: { responsive: true },
      });

      const humChart = new Chart(humCtx, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            {
              label: "Humidity %",
              data: [],
              borderColor: "blue",
              fill: false,
              segment: {
                borderColor: (ctx) => skipped(ctx, "rgb(0,0,0,0.2)"),
                borderDash: (ctx) => skipped(ctx, [6, 6]),
              },
              spanGaps: true,
            },
          ],
        },
        options: { responsive: true },
      });

      charts.set(stationId, { tempChart, humChart });
    }

    function updateStatistics(station, now) {
      const cutoff5min = now.getTime() - 5 * 60 * 1000;
      const cutoffHour = now.getTime() - 60 * 60 * 1000;

      const validHistory = station.history.filter(d => d.valid);

      const today = validHistory.filter(
          (d) => new Date(d.timestamp).toDateString() === now.toDateString()
      );

      const last5min = today.filter(
          (d) => new Date(d.timestamp).getTime() >= cutoff5min
      );
      station.stats.avg5min.temperature =
          last5min.length > 0 ? last5min.reduce((s, d) => s + d.temperature, 0) / last5min.length : null;
      station.stats.avg5min.humidity =
          last5min.length > 0 ? last5min.reduce((s, d) => s + d.humidity, 0) / last5min.length : null;

      if (today.length > 0) {
        const temps = today.map((d) => d.temperature);
        const hums = today.map((d) => d.humidity);
        station.stats.daily.minTemp = Math.min(...temps);
        station.stats.daily.maxTemp = Math.max(...temps);
        station.stats.daily.minHum = Math.min(...hums);
        station.stats.daily.maxHum = Math.max(...hums);
      } else {
        station.stats.daily = { minTemp: null, maxTemp: null, minHum: null, maxHum: null };
      }

      const lastHour = today.filter(
          (d) => new Date(d.timestamp).getTime() >= cutoffHour
      );
      if (lastHour.length > 0) {
        const tempsHour = lastHour.map((d) => d.temperature);
        const humsHour = lastHour.map((d) => d.humidity);

        station.stats.lastHour.avgTemp = tempsHour.reduce((s, v) => s + v, 0) / tempsHour.length;
        station.stats.lastHour.avgHum = humsHour.reduce((s, v) => s + v, 0) / humsHour.length;

        station.stats.lastHour.minTemp = Math.min(...tempsHour);
        station.stats.lastHour.maxTemp = Math.max(...tempsHour);
        station.stats.lastHour.minHum = Math.min(...humsHour);
        station.stats.lastHour.maxHum = Math.max(...humsHour);
      } else {
        station.stats.lastHour = { avgTemp: null, avgHum: null, minTemp: null, maxTemp: null, minHum: null, maxHum: null };
      }
    }

    onMounted(() => {
      const client = mqtt.connect("ws://localhost:9001", {
        reconnectPeriod: 5000,
      });

      client.on("connect", () => {
        console.log("Verbunden mit MQTT-Broker");
        client.subscribe("weather", (err) => {
          if (err) console.error("Fehler beim Abonnieren:", err);
        });
      });

      client.on("message", async (topic, message) => {
        try {
          const data = JSON.parse(message.toString());
          const { valid, issues } = validateData(data);

          if (!stations[data.stationId]) {
            stations[data.stationId] = {
              temperature: null,
              humidity: null,
              timestamp: null,
              valid: true,
              issues: [],
              history: [],
              stats: {
                avg5min: { temperature: null, humidity: null },
                daily: { minTemp: null, maxTemp: null, minHum: null, maxHum: null },
                lastHour: { avgTemp: null, avgHum: null, minTemp: null, maxTemp: null, minHum: null, maxHum: null },
              },
            };
          }

          const station = stations[data.stationId];
          station.temperature = data.temperature;
          station.humidity = data.humidity;
          station.timestamp = data.timestamp;
          station.valid = valid;
          station.issues = issues;

          station.history.push({ ...data, valid });

          updateStatistics(station, new Date(data.timestamp));

          await nextTick();
          renderCharts(data.stationId);

          const stationCharts = charts.get(data.stationId);
          if (stationCharts) {
            const label = new Date(data.timestamp).toLocaleTimeString();
            addData(stationCharts.tempChart, label, valid ? data.temperature : NaN);
            addData(stationCharts.humChart, label, valid ? data.humidity : NaN);
          }
        } catch (err) {
          console.error("Fehler beim Verarbeiten:", err.message);
        }
      });

    });

    return {stations};
  },
};
</script>
