import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { BtcSocketService } from '../btc-price.service';

@Component({
  selector: 'app-btc-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class BtcDashboardComponent implements OnInit, OnDestroy {
  loading = true;
  error: string | null = null;

  price = 0;
  oi = 0;
  volume = 0;

  signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  signalHighlight = false;

  buyPrice: number | null = null;
  buyTargetPrice: number | null = null;

  sellPrice: number | null = null;
  sellTargetPrice: number | null = null;

  topBids: { price: number; qty: number }[] = [];
  topAsks: { price: number; qty: number }[] = [];

  lastUpdated = new Date();

  private btcSub: Subscription | null = null;

  constructor(private btcSocketService: BtcSocketService) {}

  ngOnInit() {
    this.btcSub = this.btcSocketService.getBtcStream().subscribe({
      next: (data) => {
        this.loading = false;
        this.error = null;

        this.price = data.price;
        this.oi = data.oi;
        this.volume = data.volume;
        this.topBids = data.topBids;
        this.topAsks = data.topAsks;

        this.signal = data.signal === 'HOLD' ? 'NEUTRAL' : data.signal;
        this.signalHighlight = this.signal !== 'NEUTRAL';

        if (this.signal === 'BUY') {
          this.buyPrice = this.price - 100;
          this.buyTargetPrice = data.target || this.price + 150;
          this.sellPrice = null;
          this.sellTargetPrice = null;
        } else if (this.signal === 'SELL') {
          this.sellPrice = this.price + 100;
          this.sellTargetPrice = data.target || this.price - 150;
          this.buyPrice = null;
          this.buyTargetPrice = null;
        } else {
          this.buyPrice = null;
          this.buyTargetPrice = null;
          this.sellPrice = null;
          this.sellTargetPrice = null;
        }

        this.lastUpdated = new Date();
      },
      error: (err) => {
        this.error = 'Error receiving live data';
        this.loading = false;
        console.error('BTC stream error:', err);
      }
    });
  }

  ngOnDestroy() {
    this.btcSub?.unsubscribe();
  }
}
