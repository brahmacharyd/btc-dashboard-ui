import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

export interface BtcData {
  price: number;
  oi: number;
  volume: number;
  signal: string;
  topBids: { price: number; qty: number }[];
  topAsks: { price: number; qty: number }[];
}

@Injectable({
  providedIn: 'root'
})
export class BtcPriceService {
  private socket: Socket;

  constructor() {
    this.socket = io('https://btc-dashboard-2ijv.onrender.com');
  }

  getPriceUpdates(): Observable<BtcData> {
    return new Observable(observer => {
      this.socket.on('btcData', (data: BtcData) => {
        observer.next(data);
      });

      return () => this.socket.disconnect();
    });
  }
}
