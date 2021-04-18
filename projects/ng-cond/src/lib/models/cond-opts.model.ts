export interface CondOpts {
  isShowOnValue?: boolean;  // undefined / !undefined
  isShowOnEmit?: boolean;  // undefined or null / otherwise
  isThrowOnError?: boolean;  // default is false
  isMarkForCheck?: boolean;
  isDetectChanges?: boolean;
  isClearValueOnError?: boolean;
}
