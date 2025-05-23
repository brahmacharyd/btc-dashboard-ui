import { Component, OnInit, OnDestroy } from '@angular/core';
import { BtcData, BtcPriceService } from '../btc-price.service.ts.service';
import { Subscription, timer } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  price: number = 0;
  oi: number = 0;
  volume: number = 0;
  signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  lastUpdated: Date | null = null;
  error: string | null = null;

  buyPrice: number | null = null;
  buyTargetPrice: number | null = null;

  sellPrice: number | null = null;
  sellTargetPrice: number | null = null;

  topBids: { price: number; qty: number }[] = [];
  topAsks: { price: number; qty: number }[] = [];

  loading: boolean = true;
  private subscription: Subscription | null = null;

  signalHighlight: boolean = false;

  constructor(private btcService: BtcPriceService) {}

  ngOnInit(): void {
    this.subscription = this.btcService.getPriceUpdates().subscribe({
      next: (data: BtcData & { oi: number; volume: number; topBids: any[]; topAsks: any[] }) => {
        this.loading = false;
        this.error = null;

        this.price = data.price;
        this.oi = data.oi;
        this.volume = data.volume;
        this.topBids = data.topBids;
        this.topAsks = data.topAsks;

        if (this.signal !== data.signal) {
          this.signalHighlight = true;
          setTimeout(() => (this.signalHighlight = false), 2000);
        }

        this.signal = data.signal as 'BUY' | 'SELL' | 'NEUTRAL';

        if (this.signal === 'BUY') {
          this.buyPrice = this.price;
          this.buyTargetPrice = this.calculateBuyTargetPrice();
          this.sellPrice = null;
          this.sellTargetPrice = null;
        } else if (this.signal === 'SELL') {
          this.sellPrice = this.price;
          this.sellTargetPrice = this.calculateSellTargetPrice();
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
        this.loading = false;
        this.error = 'Failed to fetch live data. Please try again later.';
        console.error('Socket error:', err);
      },
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  calculateBuyTargetPrice(): number {
    return +(this.price * 1.02).toFixed(2);
  }

  calculateSellTargetPrice(): number {
    return +(this.price * 0.98).toFixed(2);
  }
}
