import { Observable, Subscription } from 'rxjs';

export interface Cond {
  value: any;
  obs?: Observable<any>;
  subscription?: Subscription;
  promise?: Promise<any>;
  key?: string;
}
