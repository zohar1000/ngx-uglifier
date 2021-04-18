import { ModuleWithProviders, NgModule } from '@angular/core';
import { NgCondDirective } from './ng-cond.directive';
import { CondOpts } from './models/cond-opts.model';
import { NG_COND_OPTS_TOKEN } from './tokens/ng-cond-opts.token';

@NgModule({
  declarations: [NgCondDirective],
  exports: [NgCondDirective]
})
export class NgCondModule {
  static forChild(opts: CondOpts): ModuleWithProviders<NgCondModule> {
    return {
      ngModule: NgCondModule,
      providers: [{ provide: NG_COND_OPTS_TOKEN, useValue: opts }]
    };
  }

  // static forChild() {
  //   console.log('forChild');
  // }
}
