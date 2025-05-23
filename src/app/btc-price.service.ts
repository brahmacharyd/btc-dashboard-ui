import { Injectable } from '@angular/core';
import { environment } from 'environments/environments.prod';
import { Observable, Subject } from 'rxjs';

interface OrderBookEntry {
  price: number;
  qty: number;
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
}

@Injectable({ providedIn: 'root' })
export class BtcSocketService {
  private priceList: number[] = [];
  private volumeList: number[] = [];
  private lastSignal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  private signalCount = 0;

  private priceSocket = new WebSocket(environment.priceSocketUrl);
  private orderBookSocket = new WebSocket(environment.orderBookSocketUrl);

  private btcSubject = new Subject<BtcData>();

  private currentOI = 50000;
  private currentVolume = 0;
  private topBids: OrderBookEntry[] = [];
  private topAsks: OrderBookEntry[] = [];

  constructor() {
    this.initSockets();
    this.simulateData();
  }

  private initSockets() {
    this.priceSocket.onopen = () => console.log('Price WebSocket connected');
    this.priceSocket.onerror = (err) => console.error('Price WebSocket error', err);
    this.priceSocket.onclose = () => console.warn('Price WebSocket closed');

    this.orderBookSocket.onopen = () => console.log('OrderBook WebSocket connected');
    this.orderBookSocket.onerror = (err) => console.error('OrderBook WebSocket error', err);
    this.orderBookSocket.onclose = () => console.warn('OrderBook WebSocket closed');

    this.priceSocket.onmessage = (msg) => {
      const trade = JSON.parse(msg.data);
      const price = parseFloat(trade.p);
      this.updatePrice(price);
    };

    this.orderBookSocket.onmessage = (msg) => {
      const ob = JSON.parse(msg.data);
      this.topBids = ob.bids.slice(0, 3).map((b: [string, string]) => ({
        price: +b[0],
        qty: +b[1],
      }));
      this.topAsks = ob.asks.slice(0, 3).map((a: [string, string]) => ({
        price: +a[0],
        qty: +a[1],
      }));
    };

    setInterval(() => {
      if (!this.priceList.length || !this.topBids.length || !this.topAsks.length) return;

      const price = this.priceList[this.priceList.length - 1];
      const volume = this.currentVolume;
      const oi = this.currentOI;

      const { signal, target, stopLoss } = this.processSignal(price, volume, oi);

      this.btcSubject.next({
        price,
        volume,
        oi,
        topBids: this.topBids,
        topAsks: this.topAsks,
        signal,
        target,
        stopLoss,
      });
    }, 500);
  }

  private simulateData() {
    // Simulate Open Interest changing over time
    setInterval(() => {
      this.currentOI += (Math.random() - 0.5) * 2000;
      this.currentOI = Math.max(0, this.currentOI);
    }, 2000);

    // Simulate volume changing over time
    setInterval(() => {
      this.currentVolume += Math.random() * 5;
      this.currentVolume = Math.max(0, this.currentVolume);
    }, 1000);
  }

  private updatePrice(price: number) {
    this.priceList.push(price);
    if (this.priceList.length > 20) this.priceList.shift();

    this.volumeList.push(this.currentVolume);
    if (this.volumeList.length > 20) this.volumeList.shift();
  }

  private processSignal(price: number, volume: number, oi: number) {
    const trend = this.priceList[this.priceList.length - 1] - this.priceList[0];
    const avgVol = this.volumeList.length
      ? this.volumeList.reduce((a, b) => a + b, 0) / this.volumeList.length
      : 0;

    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let target: number | undefined;
    let stopLoss: number | undefined;

    if (trend > 100 && volume > avgVol && oi > 20000) {
      signal = 'BUY';
      target = price + 150;
      stopLoss = price - 50;
    } else if (trend < -100 && volume > avgVol && oi < 15000) {
      signal = 'SELL';
      target = price - 150;
      stopLoss = price + 50;
    }

    if (signal !== this.lastSignal) {
      this.signalCount = 1;
      this.lastSignal = signal;
      return { signal: 'HOLD' as const };
    } else {
      this.signalCount++;
      if (this.signalCount >= 2 && signal !== 'HOLD') {
        return { signal, target, stopLoss };
      } else {
        return { signal: 'HOLD' as const };
      }
    }
  }

  getBtcStream(): Observable<BtcData> {
    return this.btcSubject.asObservable();
  }
}
