declare var require: any;
const { minify } = require('terser');
const fs = require('fs');
const path = require('path');
import { NgxUglifierConfig, NgxUglifierOptions } from './ngx-uglifier-config.model';

export class NgxUglifier {
  srcFolder;
  currDestParentFolder;
  destFolder;
  accessors = [];
  isLegacyAccessorsDefinition = true;
  options;
  config: NgxUglifierConfig;

  constructor(config: NgxUglifierConfig) {
    this.config = this.setConfigDefaults(config);
    this.srcFolder = `${config.srcParentFolder}/${config.projectName}`;
    this.currDestParentFolder = config.destParentFolder === config.srcParentFolder ? `temp_ngx_uglifier_${Date.now()}` : config.destParentFolder;
    this.destFolder = `${this.currDestParentFolder}/${config.projectName}`;
    this.isLegacyAccessorsDefinition = !(config?.uglifyOptions?.isLegacyAccessorsDefinition === false);
    this.options = this.getOptions(config?.uglifyOptions);
    this.verifyDirectory(this.currDestParentFolder);
    this.verifyDirectory(this.destFolder);
  }

  setConfigDefaults(config: NgxUglifierConfig) {
    if (!config.srcParentFolder) config.srcParentFolder = 'dist';
    if (!config.destParentFolder) config.destParentFolder = config.srcParentFolder;
    return config;
  }

  async init() {
    this.copyFolder(this.srcFolder, this.currDestParentFolder, { clearFolder: this.destFolder });
    this.deleteSourceMaps(this.destFolder);
    await this.obfuscate(this.destFolder);
    if (this.config.destParentFolder === this.config.srcParentFolder) {
      this.copyFolder(this.destFolder, this.config.srcParentFolder, { clearFolder: this.srcFolder });
      fs.rmdirSync(this.currDestParentFolder, { recursive: true });
    }
  }

  clearFolder(folder) {
    const entries = fs.readdirSync(folder, {withFileTypes: true});
    for (const entry of entries) {
      const folderPath = `${folder}/${entry.name}`;
      if (this.isResourceDirectory(folderPath)) {
        fs.rmdirSync(folderPath, { recursive: true });
      } else {
        fs.unlinkSync(folderPath);
      }
    }
  }

  deleteSourceMaps(folder) {
    const entries = fs.readdirSync(folder, {withFileTypes: true});
    for (const entry of entries) {
      if (entry.isFile()) {
        if (entry.name.endsWith('.map')) {
          fs.unlinkSync(`${folder}/${entry.name}`);
        }
      } else {
        this.deleteSourceMaps(`${folder}/${entry.name}`);
      }
    }
  }

  async obfuscate(folder) {
    const entries = fs.readdirSync(folder, {withFileTypes: true});
    for (const entry of entries) {
      if (entry.isFile()) {
        if (entry.name.endsWith('.js')) {
          const filePath = `${folder}/${entry.name}`;
          const fileText = fs.readFileSync(filePath, 'utf8');
          const result = await minify(fileText, this.options);
          fs.writeFileSync(filePath, result.code, 'utf8');
        } else if (entry.name.endsWith('.d.ts')) {
          const TYPES = ['component', 'directive', 'pipe', 'service', 'guard', 'resolver'];
          if (TYPES.find(type => entry.name.endsWith(`.${type}.d.ts`))) {
            this.obfuscateDefinitionFile(path.join(folder, entry.name));
          }
        }
      } else {
        await this.obfuscate(`${folder}/${entry.name}`);
      }
    }
  }

  obfuscateDefinitionFile(filePath) {
    const PRIVATE_SUFFIXES = ['private ', 'private async ', 'protected ', 'protected async ', '_'];
    let fileText = fs.readFileSync(filePath, 'utf8');
    const crlf = fileText.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
    const lines = fileText.split(crlf);
    if (lines.length === 0) {
      return;
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trimLeft();
      if (PRIVATE_SUFFIXES.find(suffix => line.startsWith(suffix))) {
        lines.splice(i, 1);
      } else if (this.isLegacyAccessorsDefinition && (line.startsWith('set ') || line.startsWith('get '))) {
        const keyword = line.substr(0, 4);
        const str = line.substr(4);
        let ix = str.indexOf('(');
        const name = str.substr(0, ix);
        if (this.accessors.includes(name)) {
          lines.splice(i, 1);
        } else {
          this.accessors.push(name);
          ix = str.indexOf(':', ix + 1);
          const type = str.substr(ix).replace(')', '');
          ix = lines[i].indexOf(keyword);
          lines[i] = ''.padStart(ix, ' ') + name + type;
        }
      }
    }
    fileText = lines.join('\n');
    fs.writeFileSync(filePath, fileText, 'utf8');
  }

  /*********************/
  /*      C O P Y      */
  /*********************/

  copyFolder(source, target, opts?) {
    if (opts?.clearFolder) this.clearFolder(opts.clearFolder);
    let files = [];
    const targetFolder = path.join(target, path.basename(source));
    if (this.verifyDirectory(targetFolder)) {
      files = fs.readdirSync(source);
      for (const file of files) {
        const curSource = path.join(source, file);
        const isDirectory = this.isResourceDirectory(curSource);
        if (isDirectory) {
          this.copyFolder(curSource, targetFolder);
        } else {
          this.copyFileSync(curSource, path.join(targetFolder, file));
        }
      }
    }
  }

  copyFileSync(from, to) {
    const fileText = fs.readFileSync(from, 'utf8');
    fs.writeFileSync(to, fileText);
  }

  getResourceStat(resourcePath) {
    let stat;
    try {
      stat = fs.statSync(resourcePath);
    } catch (e) {
    }
    return stat;
  }

  isResourceExist(resourcePath) {
    const stat = this.getResourceStat(resourcePath);
    return Boolean(stat);
  }

  isResourceDirectory(resourcePath) {
    const stat = this.getResourceStat(resourcePath);
    return !stat ? false : stat.isDirectory();
  }

  verifyDirectory(resourcePath, isMakeDir = true) {
    let isDirectory;
    const stat = this.getResourceStat(resourcePath);
    if (!stat) {
      if (isMakeDir) {
        fs.mkdirSync(resourcePath);
        isDirectory = true;
      }
    } else {
      isDirectory = stat.isDirectory();
    }
    return isDirectory;
  }

  getOptions(options: NgxUglifierOptions = {}) {
    const ecma = options.ecma || 2015;  // pass 5, 2015, 2016, etc to override compress and format's ecma options
    const isModule = !(options.isModule === false);  // default: true
    const sourceMap = Boolean(options.sourceMap);  // default: false
    const classes = options.classes || /^_/;
    const functions = options.functions || /^_/;
    const properties = options.properties || /^_/;
    const topLevel = Boolean(options.topLevel);  // default: false
    return {
      ecma,
      module: isModule,
      keep_classnames: classes,
      keep_fnames: functions,
      toplevel: topLevel,
      sourceMap,
      compress: {
        ecma,
        toplevel: topLevel,
        module: isModule,
        keep_fnames: functions,
        properties: {
          regex: properties
        }
      },
      mangle: {
        toplevel: topLevel,
        keep_classnames: classes,
        keep_fnames: functions,
        properties: {
          regex: properties
        },
        module: isModule
      }
    };
  }
}
