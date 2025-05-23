import { Injectable } from '@angular/core';
import { environment } from 'environments/environments.prod';
import { Observable, Subject } from 'rxjs';

interface OrderBookEntry {
  price: number;
  qty: number;
}

interface Zone {
  type: 'OB' | 'FVG';
  start: number;
  end: number;
  direction: 'bullish' | 'bearish';
  strength: number;
  timestamp: number;
}

interface BtcData {
  price: number;
  volume: number;
  oi: number;
  topBids: OrderBookEntry[];
  topAsks: OrderBookEntry[];
  signal: 'BUY' | 'SELL' | 'HOLD';
  target?: number;
  stopLoss?: number;
  zones?: Zone[];
  trend?: 'up' | 'down' | 'neutral';
}

@Injectable({ providedIn: 'root' })
export class BtcSocketService {
  private priceList1m: number[] = [];
  private priceList5m: number[] = [];
  private priceList15m: number[] = [];
  private volumeList1m: number[] = [];
  
  private zones1m: Zone[] = [];
  private zones5m: Zone[] = [];
  private zones15m: Zone[] = [];

  private lastSignal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  private confirmedSignal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  private signalCount = 0;
  private confirmationThreshold = 3;
  private averageVolume = 0;

  private cooldownUntil: number = 0;
  private cooldownDuration = 10000;
  private zoneExpiryTime = 3600000;

  private priceSocket = new WebSocket(environment.priceSocketUrl);
  private orderBookSocket = new WebSocket(environment.orderBookSocketUrl);

  private btcSubject = new Subject<BtcData>();

  private currentOI = 50000;
  private currentVolume = 0;
  private topBids: OrderBookEntry[] = [];
  private topAsks: OrderBookEntry[] = [];

  private beepAudio = new Audio('assets/beep.mp3');

  constructor() {
    this.initSockets();
    this.simulateData();
  }

  private initSockets() {
    this.priceSocket.onmessage = (msg) => {
      const trade = JSON.parse(msg.data);
      const price = parseFloat(trade.p);
      const volume = parseFloat(trade.v);
      this.updatePrice1m(price);
      this.updateVolume1m(volume);
    };

    this.orderBookSocket.onmessage = (msg) => {
      const ob = JSON.parse(msg.data);
      this.topBids = ob.bids.slice(0, 5).map((b: [string, string]) => ({
        price: +b[0],
        qty: +b[1],
      }));
      this.topAsks = ob.asks.slice(0, 5).map((a: [string, string]) => ({
        price: +a[0],
        qty: +a[1],
      }));
    };

    setInterval(() => this.processData(), 1000);
  }

  private simulateData() {
    // Simulate OI changes
    setInterval(() => {
      this.currentOI += (Math.random() - 0.5) * 2000;
      this.currentOI = Math.max(0, this.currentOI);
    }, 2000);

    // Simulate volume changes
    setInterval(() => {
      this.currentVolume += Math.random() * 5;
      this.currentVolume = Math.max(0, this.currentVolume);
    }, 1000);
  }

  private processData() {
    if (!this.priceList1m.length || !this.topBids.length || !this.topAsks.length) return;

    const price = this.priceList1m[this.priceList1m.length - 1];
    const volume = this.currentVolume;
    this.averageVolume = this.calculateAverageVolume();

    // Update higher timeframes
    this.priceList5m = this.aggregateToHigherTimeframe(this.priceList1m, 5);
    this.priceList15m = this.aggregateToHigherTimeframe(this.priceList1m, 15);

    // Detect zones with expiration
    const now = Date.now();
    this.zones1m = this.detectZonesForTimeframe(this.priceList1m).filter(z => now - z.timestamp < this.zoneExpiryTime);
    this.zones5m = this.detectZonesForTimeframe(this.priceList5m).filter(z => now - z.timestamp < this.zoneExpiryTime);
    this.zones15m = this.detectZonesForTimeframe(this.priceList15m).filter(z => now - z.timestamp < this.zoneExpiryTime);

    // Get trend context
    const trend = this.getTrendDirection(this.priceList15m);

    // Confirm signal with multiple factors
    const rawSignal = this.confirmSignal(price, trend);

    // Signal counting and confirmation logic
    if (rawSignal === this.lastSignal) {
      this.signalCount++;
    } else {
      this.signalCount = 1;
      this.lastSignal = rawSignal;
    }

    const shouldConfirmSignal = 
      this.signalCount >= this.confirmationThreshold &&
      rawSignal !== this.confirmedSignal &&
      Date.now() >= this.cooldownUntil &&
      this.isVolumeAboveAverage();

    if (shouldConfirmSignal) {
      this.confirmedSignal = rawSignal;
      if (this.confirmedSignal !== 'HOLD') {
        this.playBeepSound();
        this.showNotification(this.confirmedSignal);
        this.cooldownUntil = Date.now() + this.cooldownDuration;
      }
    }

    const { target, stopLoss } = this.calculateTargetStopLoss(price, this.zones1m, this.confirmedSignal);

    this.btcSubject.next({
      price,
      volume,
      oi: this.currentOI,
      topBids: this.topBids,
      topAsks: this.topAsks,
      signal: this.confirmedSignal,
      target,
      stopLoss,
      zones: this.zones1m,
      trend
    });
  }

  private aggregateToHigherTimeframe(prices: number[], intervalMinutes: number): number[] {
    const higherTFPrices: number[] = [];
    for (let i = 0; i < prices.length; i += intervalMinutes) {
      const candleClose = prices[Math.min(i + intervalMinutes - 1, prices.length - 1)];
      higherTFPrices.push(candleClose);
    }
    return higherTFPrices;
  }

  private getSignalFromZones(price: number, zones: Zone[]): 'BUY' | 'SELL' | 'HOLD' {
    for (const zone of zones) {
      if (price >= zone.start && price <= zone.end) {
        return zone.direction === 'bullish' ? 'BUY' : 'SELL';
      }
    }
    return 'HOLD';
  }

  private updatePrice1m(price: number) {
    this.priceList1m.push(price);
    if (this.priceList1m.length > 300) this.priceList1m.shift();
  }

  private updateVolume1m(volume: number) {
    this.currentVolume = volume;
    this.volumeList1m.push(volume);
    if (this.volumeList1m.length > 300) this.volumeList1m.shift();
  }

  private calculateAverageVolume(): number {
    if (this.volumeList1m.length === 0) return 0;
    return this.volumeList1m.reduce((sum, vol) => sum + vol, 0) / this.volumeList1m.length;
  }

  private isVolumeAboveAverage(): boolean {
    return this.currentVolume > this.averageVolume * 1.3;
  }

  private getTrendDirection(prices: number[]): 'up' | 'down' | 'neutral' {
    if (prices.length < 20) return 'neutral';
    const shortPeriod = Math.min(5, Math.floor(prices.length / 4));
    const longPeriod = Math.min(20, Math.floor(prices.length / 2));
    
    const shortMA = this.calculateMA(prices, shortPeriod);
    const longMA = this.calculateMA(prices, longPeriod);
    
    if (shortMA > longMA * 1.001) return 'up';
    if (shortMA < longMA * 0.999) return 'down';
    return 'neutral';
  }

  private calculateMA(prices: number[], period: number): number {
    if (prices.length < period) return prices.reduce((a, b) => a + b, 0) / prices.length;
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  private confirmSignal(price: number, trend: 'up' | 'down' | 'neutral'): 'BUY' | 'SELL' | 'HOLD' {
    const sig1m = this.getSignalFromZones(price, this.zones1m);
    if (sig1m === 'HOLD') return 'HOLD';

    const sig5m = this.getSignalFromZones(price, this.zones5m);
    const sig15m = this.getSignalFromZones(price, this.zones15m);
    
    const totalBidQty = this.topBids.reduce((sum, bid) => sum + bid.qty, 0);
    const totalAskQty = this.topAsks.reduce((sum, ask) => sum + ask.qty, 0);
    const obConfirmation = totalBidQty > totalAskQty * 1.2 ? 'BUY' : 
                          totalAskQty > totalBidQty * 1.2 ? 'SELL' : 'HOLD';

    if (sig1m === 'BUY' && trend === 'down') return 'HOLD';
    if (sig1m === 'SELL' && trend === 'up') return 'HOLD';

    if (
      (sig1m === sig5m || sig1m === sig15m) &&
      sig1m === obConfirmation &&
      this.isVolumeAboveAverage()
    ) {
      return sig1m;
    }
    
    return 'HOLD';
  }

  private calculateTargetStopLoss(price: number, zones: Zone[], signal: 'BUY' | 'SELL' | 'HOLD') {
    if (signal === 'HOLD') return { target: undefined, stopLoss: undefined };

    const matchingZones = zones.filter(z => z.direction === (signal === 'BUY' ? 'bullish' : 'bearish'));
    if (!matchingZones.length) return { target: undefined, stopLoss: undefined };

    const targetZone = signal === 'BUY'
      ? matchingZones.reduce((max, z) => (z.end > max.end ? z : max), matchingZones[0])
      : matchingZones.reduce((min, z) => (z.start < min.start ? z : min), matchingZones[0]);

    const stopLossZone = signal === 'BUY'
      ? matchingZones.reduce((min, z) => (z.start < min.start ? z : min), matchingZones[0])
      : matchingZones.reduce((max, z) => (z.end > max.end ? z : max), matchingZones[0]);

    return {
      target: targetZone.end,
      stopLoss: stopLossZone.start,
    };
  }

  private playBeepSound() {
    this.beepAudio.pause();
    this.beepAudio.currentTime = 0;
    this.beepAudio.play().catch(err => console.warn('Audio play failed:', err));
  }

  private showNotification(signal: 'BUY' | 'SELL') {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(`BTC Signal: ${signal}`, {
        body: `New ${signal} signal confirmed!`,
        icon: 'assets/signal-icon.png',
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(`BTC Signal: ${signal}`, {
            body: `New ${signal} signal confirmed!`,
            icon: 'assets/signal-icon.png',
          });
        }
      });
    }
  }

  getBtcObservable(): Observable<BtcData> {
    return this.btcSubject.asObservable();
  }

  // Zone detection methods
  private detectZonesForTimeframe(prices: number[]): Zone[] {
    const zones: Zone[] = [];
    if (prices.length < 10) return zones;

    const volatility = this.calculateVolatility(prices);
    const threshold = prices[prices.length - 1] * volatility * 0.7;

    for (let i = 3; i < prices.length - 3; i++) {
      // Fair Value Gap detection
      if (prices[i] > prices[i-3] + threshold) {
        zones.push({
          type: 'FVG',
          start: prices[i-3] - threshold/2,
          end: prices[i] + threshold/2,
          direction: 'bullish',
          strength: prices[i] - prices[i-3],
          timestamp: Date.now()
        });
      }
      
      if (prices[i] < prices[i-3] - threshold) {
        zones.push({
          type: 'FVG',
          start: prices[i] - threshold/2,
          end: prices[i-3] + threshold/2,
          direction: 'bearish',
          strength: prices[i-3] - prices[i],
          timestamp: Date.now()
        });
      }

      // Order Block detection
      if (this.isSwingLow(prices, i, 3)) {
        zones.push({
          type: 'OB',
          start: prices[i] - threshold,
          end: prices[i] + threshold,
          direction: 'bullish',
          strength: threshold * 2,
          timestamp: Date.now()
        });
      }

      if (this.isSwingHigh(prices, i, 3)) {
        zones.push({
          type: 'OB',
          start: prices[i] - threshold,
          end: prices[i] + threshold,
          direction: 'bearish',
          strength: threshold * 2,
          timestamp: Date.now()
        });
      }
    }

    return zones.filter(z => z.strength > threshold);
  }

  private isSwingLow(prices: number[], index: number, lookback: number): boolean {
    for (let i = Math.max(0, index - lookback); i < index; i++) {
      if (prices[i] <= prices[index]) return false;
    }
    for (let i = index + 1; i <= Math.min(prices.length - 1, index + lookback); i++) {
      if (prices[i] <= prices[index]) return false;
    }
    return true;
  }

  private isSwingHigh(prices: number[], index: number, lookback: number): boolean {
    for (let i = Math.max(0, index - lookback); i < index; i++) {
      if (prices[i] >= prices[index]) return false;
    }
    for (let i = index + 1; i <= Math.min(prices.length - 1, index + lookback); i++) {
      if (prices[i] >= prices[index]) return false;
    }
    return true;
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0.005;
    let sum = 0;
    for (let i = 1; i < prices.length; i++) {
      sum += Math.abs(prices[i] - prices[i-1]) / prices[i-1];
    }
    return Math.max(0.003, Math.min(0.02, sum / (prices.length - 1)));
  }
}