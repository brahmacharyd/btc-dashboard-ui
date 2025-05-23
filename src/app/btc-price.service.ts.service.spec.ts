import { TestBed } from '@angular/core/testing';

import { BtcPriceServiceTsService } from './btc-price.service.ts.service';

describe('BtcPriceServiceTsService', () => {
  let service: BtcPriceServiceTsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BtcPriceServiceTsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
