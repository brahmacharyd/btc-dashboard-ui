import { Injectable } from '@angular/core';
import { environment } from 'environments/environments.prod';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

export interface BtcData {
  price: number;
  oi: number;
  volume: number;
  topBids: { price: number; qty: number }[];
  topAsks: { price: number; qty: number }[];
  signal: 'BUY' | 'SELL' | 'NEUTRAL'; // not just `string`
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
  
}
