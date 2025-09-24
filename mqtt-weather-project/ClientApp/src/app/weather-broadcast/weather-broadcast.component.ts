import { Component, OnInit, OnDestroy } from '@angular/core';
import { IMqttMessage, MqttService } from 'ngx-mqtt';
import { Subscription } from 'rxjs';

interface StationData {
  temperature: number;
  humidity: number;
  timestamp: string;
  valid: boolean;
  issues: string[];
}

@Component({
  selector: 'app-weather-broadcast',
  templateUrl: './weather-broadcast.component.html',
  styleUrls: ['./weather-broadcast.component.css'],
  standalone: true
})
export class WeatherBroadcastComponent implements OnInit, OnDestroy {
  stations: { [id: string]: StationData } = {};
  private mqttSubscription?: Subscription;

  constructor(private _mqttService: MqttService) {}

  ngOnInit(): void {
    console.log('Attempting to connect...');
    this.mqttSubscription = this._mqttService.observe('weather').subscribe({
      next: (message: IMqttMessage) => this.handleMessage(message),
      error: (err) => console.error('MQTT error:', err)
    });
  }

  ngOnDestroy(): void {
    this.mqttSubscription?.unsubscribe();
  }

  private handleMessage(message: IMqttMessage) {
    try {
      const data = JSON.parse(message.payload.toString());
      const { valid, issues } = this.validateData(data);

      this.stations[data.stationId] = {
        temperature: data.temperature,
        humidity: data.humidity,
        timestamp: data.timestamp,
        valid,
        issues
      };
    } catch (err: any) {
      console.error('Fehler beim Verarbeiten der Nachricht:', err.message);
    }
  }

  private validateData(data: any): { valid: boolean; issues: string[] } {
    let valid = true;
    const issues: string[] = [];

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
}
