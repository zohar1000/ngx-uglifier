import {
  ChangeDetectorRef,
  Directive,
  EmbeddedViewRef,
  Inject,
  Input,
  NgZone,
  OnDestroy, Optional,
  TemplateRef,
  ViewContainerRef
} from '@angular/core';
import { Observable } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { NgCondContext } from './models/ng-cond-context.model';
import { Cond } from './models/cond.model';
import { Exp } from './models/exp.model';
import { CondOpts } from './models/cond-opts.model';
import { NG_COND_OPTS_TOKEN } from './tokens/ng-cond-opts.token';

@Directive({ selector: '[ngCond]' })
export class NgCondDirective implements OnDestroy {
  private readonly _KEYWORD = 'NgCond';
  private readonly _SINGLE_KEY = '@singleCond';
  private readonly _OPTS_KEYS = ['isShowOnValue', 'isShowOnEmit', 'isThrowOnError', 'isMarkForCheck', 'isDetectChanges', 'isClearValueOnError'];
  private _isShow = false;
  private _isMulti = false;
  private _conds: Cond[];
  private _opts: CondOpts = {};
  private _isUpdateViewPending = false;
  private _context: NgCondContext = new NgCondContext();
  private _elseTemplateRef: TemplateRef<NgCondContext> | null = null;
  private _thenViewRef: EmbeddedViewRef<NgCondContext> | null = null;
  private _elseViewRef: EmbeddedViewRef<NgCondContext> | null = null;
  private _exp;
  private _error;
  private _complete;

  constructor(
      @Optional() @Inject(NG_COND_OPTS_TOKEN) opts: CondOpts,
      private viewContainer: ViewContainerRef,
      private thenTemplateRef: TemplateRef<NgCondContext<any>>,
      private cdr: ChangeDetectorRef,
      ngZone: NgZone) {
console.log('ngCond con - 24 - ivy');
    const isZone = ngZone instanceof NgZone;
    this._opts.isMarkForCheck = isZone;
    this._opts.isDetectChanges = !isZone;
    if (opts) this._OPTS_KEYS.forEach(key => { if (opts.hasOwnProperty(key)) this._opts[key] = Boolean(opts[key]); });
  }

  /***********************/
  /*      I N P U T      */
  /***********************/

  @Input() set ngCond(exp) {
    this._exp = exp;
    setTimeout(() => {
      const exps: Exp[] = this._getParsedExp(exp);
      if (!this._conds) this._initConds(exps);
      this._setConds(exps);
      setTimeout(this._updateViewOnInput.bind(this));
    });
  }

  @Input() set ngCondMulti(isMulti: boolean) {
    this._isMulti = isMulti;
  }

  @Input() set ngCondThen(templateRef: TemplateRef<NgCondContext> | null) {
    this._assertTemplate(`ng${this._KEYWORD}Then`, templateRef);
    this.thenTemplateRef = templateRef;
    this._thenViewRef = null;  // clear previous view if any.
    setTimeout(this._updateViewOnInput.bind(this));
  }

  @Input() set ngCondElse(templateRef: TemplateRef<NgCondContext> | null) {
    this._assertTemplate(`ng${this._KEYWORD}Else`, templateRef);
    this._elseTemplateRef = templateRef;
    this._elseViewRef = null;  // clear previous view if any.
    setTimeout(this._updateViewOnInput.bind(this));
  }

  @Input() set ngCondOpts(opts: CondOpts) {
    if (!opts || typeof opts !== 'object' || Object.keys(opts).length === 0) return;
    this._OPTS_KEYS.forEach(key => this._opts[key] = Boolean(opts[key]));
   }


  /***********************/
  /*      I T E M S      */
  /***********************/

  private _getParsedExp(exp) {
    const isSingle = exp instanceof Observable || exp instanceof Promise || typeof exp !== 'object' || !this._isMulti;
    this._isMulti = !isSingle;
    if (!this._isMulti) {
      return [{ key: this._SINGLE_KEY, cond: exp }];
    } else {
      const exps = Object.keys(exp).map(key => ({ key, cond: exp[key] }));
      if (exps.length === 0) {
        throw new Error(`An empty object was passed to ${this._KEYWORD}.`);
      }
      return exps;
    }
  }

  _initConds(exps: Exp[]) {
    const len = exps.length;
    this._conds = new Array(len);
    for (let i = 0; i < len; i++) {
      this._conds[i] = { value: undefined, key: exps[i].key };
    }
  }

  _setConds(exps: Exp[]) {
    for (let i = 0, len = exps.length; i < len; i++) {
      this._setDirectCond(exps[i].cond, i);
    }
  }

  _setDirectCond(cond, i) {
    if (cond instanceof Observable) {
      this._setItemObservable(cond, i);
    } else if (cond instanceof Promise) {
      this._setItemPromise(cond, i);
    } else {
      if (this._conds[i].subscription) this._clearItem(this._conds[i], true);
      this._conds[i].value = cond;
    }
  }

  _setItemObservable(obs, i) {
    if (this._conds[i].obs && this._conds[i].obs !== obs) this._clearItem(this._conds[i], true);
    if (!this._conds[i].obs) {
      this._conds[i].obs = obs;
      this._conds[i].subscription = obs
        .pipe(distinctUntilChanged())
        .subscribe(
            value => this._onNext(this._conds[i], value),
            e => this._onError(this._conds[i], e),
            () => this._onComplete(this._conds[i])
        );
    }
  }

  _setItemPromise(promise, i) {
    if (this._conds[i].promise && this._conds[i].promise !== promise) this._clearItem(this._conds[i], true);
    if (!this._conds[i].promise) {
      this._conds[i].promise = promise;
      this._conds[i].subscription = promise.then(value => {
        this._onNext(this._conds[i], value);
        this._onComplete(this._conds[i]);
      }, e => this._onError(this._conds[i], e));
    }
  }


  _onNext(cond: Cond, value) {
    cond.value = value;
    if (this._error) delete this._error[cond.key];
    if (this._complete) delete this._complete[cond.key];
    this._updateView();
  }

  _onError(cond: Cond, e) {
    if (!this._error) this._error = {};
    this._error[cond.key] = e;
    if (this._opts.isClearValueOnError) cond.value = undefined;
    this._updateView();
    if (this._opts.isThrowOnError) throw e;
  }

  _onComplete(cond: Cond) {
    if (!this._complete) this._complete = {};
    this._complete[cond.key] = true;
    this._updateView();
  }


  /*****************************/
  /*      D I S P L A Y        */
  /*****************************/

  _updateViewOnInput() {
    if (this._isUpdateViewPending) return;
    this._isUpdateViewPending = true;
    setTimeout(() => {
      this._isUpdateViewPending = false;
      this._updateView();
    });
  }

  _updateView() {
    this._isShow = this._conds.every(cond =>
      this._opts.isShowOnValue && cond.value !== undefined ||
      this._opts.isShowOnEmit && (cond.value !== undefined && cond.value !== null) ||
      Boolean(cond.value)
    );

    this._setValue();
    if (this._isShow) {
      if (!this._thenViewRef) {
        this.viewContainer.clear();
        this._elseViewRef = null;
        if (this.thenTemplateRef) this._thenViewRef = this.viewContainer.createEmbeddedView(this.thenTemplateRef, this._context);
      }
    } else {
      if (!this._elseViewRef) {
        this.viewContainer.clear();
        this._thenViewRef = null;
        if (this._elseTemplateRef) this.viewContainer.createEmbeddedView(this._elseTemplateRef, this._context);
      }
    }

    if (this._opts.isMarkForCheck) this.cdr.markForCheck();
    if (this._opts.isDetectChanges) this.cdr.detectChanges();
  }

  _setValue() {
    if (!this._isMulti) {
      this._context.$implicit = this._context.ngCond = this._conds[0].value;
      this._context.complete = this._complete ? this._complete[this._SINGLE_KEY] : false;
      this._context.error = this._error ? this._error[this._SINGLE_KEY] : undefined;
    } else {
      const conds = {};
      for (let i = 0, len = this._conds.length; i < len; i++) {
        conds[this._conds[i].key] = this._conds[i].value;
      }
      this._context.$implicit = this._context.ngCond = conds;
      this._context.complete = this._complete || {};
      this._context.error = this._error || {};
    }
  }

  _assertTemplate(property: string, templateRef: TemplateRef<any>|null): void {
    const isTemplateRefOrNull = Boolean(!templateRef || templateRef.createEmbeddedView);
    if (!isTemplateRefOrNull) throw new Error(`Error passing wrong value to ${this._KEYWORD} - ${property} must be a template`);
  }

  _clearItem(cond, isSetForNewCond) {
    if (cond.subscription && !cond.subscription.closed) cond.subscription.unsubscribe();
    cond.value = '';
    if (cond.subscription) cond.subscription = null;
    if (isSetForNewCond) {
      delete cond.obs;
      delete cond.subscription;
      delete cond.promise;
      delete cond.name;
    }
  }

  public ngOnDestroy() {
    if (this._conds) this._conds.forEach(cond => this._clearItem(cond, false));
  }
}
