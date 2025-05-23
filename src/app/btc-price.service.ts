import { Injectable } from '@angular/core';
import { environment } from 'environments/environments.prod';
import { Observable, of } from 'rxjs';
import { io, Socket } from 'socket.io-client';

export interface BtcData {
  price: number;
  volume: number;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  topBids?: { price: number; qty: number }[];
  topAsks?: { price: number; qty: number }[];
  oiBuy?: number;   // Open Interest Buy side
  oiSell?: number;  // Open Interest Sell side
}

@Injectable({
  providedIn: 'root'
})
export class BtcPriceService {
  private socket: Socket;

  constructor() {
    this.socket = io(environment.socketUrl);
  }

  getPriceUpdates(): Observable<BtcData> {
    return new Observable(observer => {
      this.socket.on('btcData', (data: BtcData) => observer.next(data));
      this.socket.on('connect_error', (err) => observer.error(err));
  
      return () => {
        this.socket.disconnect();
      };
    });
  }

  // ✅ Added method: process incoming price/volume/oi to generate a signal
  processPrice(price: number, volume: number, oi: number): Observable<{ signal: 'BUY' | 'SELL' | 'HOLD', price: number, volume: number, oi: number }> {
    const signal = this.generateSignal(price, volume, oi);
    return of({ signal, price, volume, oi });
  }

  private generateSignal(price: number, volume: number, oi: number): 'BUY' | 'SELL' | 'HOLD' {
    // 🔍 Simple logic for demonstration
    if (oi > 1000 && volume > 50) return 'BUY';
    if (oi < 500) return 'SELL';
    return 'HOLD';
  }
}
