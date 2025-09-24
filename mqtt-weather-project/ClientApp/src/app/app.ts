import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {WeatherBroadcastComponent} from './weather-broadcast/weather-broadcast.component';

@Component({
  selector: 'app-root',
  imports: [WeatherBroadcastComponent],
  templateUrl: './app.html',
  standalone: true,
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('ClientApp');
}
