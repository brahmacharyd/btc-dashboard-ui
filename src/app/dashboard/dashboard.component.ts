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
  buyStopLoss: number | null = null;

  sellPrice: number | null = null;
  sellTargetPrice: number | null = null;
  sellStopLoss: number | null = null;

  topBids: { price: number; qty: number }[] = [];
  topAsks: { price: number; qty: number }[] = [];

  zones: any[] = [];

  lastUpdated = new Date();

  private btcSub: Subscription | null = null;

  constructor(private btcSocketService: BtcSocketService) {}

  ngOnInit() {
    this.btcSub = this.btcSocketService.getBtcObservable().subscribe({
      next: (data) => {
        this.loading = false;
        this.error = null;

        this.price = data.price;
        this.oi = data.oi;
        this.volume = data.volume;
        this.topBids = data.topBids;
        this.topAsks = data.topAsks;
        this.zones = data.zones || [];

        this.signal = data.signal === 'HOLD' ? 'NEUTRAL' : data.signal;
        this.signalHighlight = this.signal !== 'NEUTRAL';

        if (this.signal === 'BUY') {
          this.buyPrice = this.price;
          this.buyTargetPrice = data.target || null;
          this.buyStopLoss = data.stopLoss || null;

          this.sellPrice = null;
          this.sellTargetPrice = null;
          this.sellStopLoss = null;
        } else if (this.signal === 'SELL') {
          this.sellPrice = this.price;
          this.sellTargetPrice = data.target || null;
          this.sellStopLoss = data.stopLoss || null;

          this.buyPrice = null;
          this.buyTargetPrice = null;
          this.buyStopLoss = null;
        } else {
          this.buyPrice = null;
          this.buyTargetPrice = null;
          this.buyStopLoss = null;

          this.sellPrice = null;
          this.sellTargetPrice = null;
          this.sellStopLoss = null;
        }

        this.lastUpdated = new Date();
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Error receiving BTC data';
      },
    });
  }

  ngOnDestroy() {
    this.btcSub?.unsubscribe();
  }
}
