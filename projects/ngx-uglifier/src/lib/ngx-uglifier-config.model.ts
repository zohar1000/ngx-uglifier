export interface NgxUglifierConfig {
  projectName: string;
  srcParentFolder?: string;
  destParentFolder?: string;
  uglifyOptions?: NgxUglifierOptions;
}

export interface NgxUglifierOptions {
  ecma?: string;
  isModule?: boolean;
  sourceMap?: boolean;
  classes?: any;
  functions?: any;
  properties?: any;
  topLevel?: boolean;
  isLegacyAccessorsDefinition?: boolean;
}

