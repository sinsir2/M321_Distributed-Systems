<template>
  <canvas :id="chartId"></canvas>
</template>

<script>
import { onMounted, ref, watch } from 'vue';
import { Chart, LineController, LineElement, PointElement, LinearScale, Title, CategoryScale } from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, Title, CategoryScale);

export default {
  name: 'ChartComponent',
  props: {
    chartId: { type: String, required: true },
    labels: { type: Array, default: () => [] },
    datasets: { type: Array, default: () => [] } // multiple datasets supported
  },
  setup(props) {
    const chartInstance = ref(null);

    onMounted(() => {
      const ctx = document.getElementById(props.chartId);
      chartInstance.value = new Chart(ctx, {
        type: 'line',
        data: { labels: props.labels, datasets: props.datasets },
        options: { responsive: true, animation: { duration: 200 } }
      });
    });

    watch(
        () => [props.labels, props.datasets],
        () => {
          if (!chartInstance.value) return;
          chartInstance.value.data.labels = props.labels;
          chartInstance.value.data.datasets = props.datasets;
          chartInstance.value.update();
        },
        {deep: true}
    );

    return {};
  }
};
</script>
