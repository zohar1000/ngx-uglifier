ngx-uglifier uglifies your angular library, meaning it shortens class member names to be of a single character.<br/>
It utilizes terser to do the uglification, terser is used by the angular compiler
to minify the code in build time, so it is already installed by angular.<br/>

The uglification also reduces your library bundle size since it shortens class member names.<br/>

>Uglifying is not the same as obfuscating which mangles the code.<br/>
>This package only shortens the names of classes/methods/variables.

There are 2 stages for uglifying the code:
1. building your library as usual, this will produce a transpiled .js files.
2. uglifying the transpiled files.

When building an angular library, the following names need to remain unchanged, all others can be shortened:
* public exports, those are usually class names
* public class methods/variables which should be accessed from outside the class
* public interfaces AND their properties

All class members declared as protected/private can be uglified.<br/>
However, since the uglification works on .js file there can be no distinction between public and protected/private members.<br/>
In order to provide this distinction we need to plan our code for it.<br/>
My suggestion is to prefix the protected/private members with an underscore or something alike, you can then pass an option
to terser telling it to uglify only members which start with underscore.<br/>

Here is a sample code for a directive having private variables/methods prefixed with underscore.<br/>
In this sample the only names that will be preserved after uglification will be the class name *MyLibDirective* and the public method *isEmbed*.

```angular2html
@Directive({ selector: '[myLib]' })
export class MyLibDirective {
private _options;

constructor(private viewContainer: ViewContainerRef) {
this._initOptions();
}

private _initOptions() {
return this._options = { isEmbed: true };
}

public isEmbed() {
return this._options.isEmbed;
}
    }
```

# Installation

```angular2html
npm install -D ngx-uglifier
```

# Uglification

Uglification is made by running a script which processes the built code.<br/>
The script will contain a config object with the input/output folder names.

```angular2html
const NgxUglifier = require('ngx-uglifier');

const config = { projectName: 'my-lib' }
const ngxUglifier = new NgxUglifier(config);
ngxUglifier.init().then();
```

# config object

The config object mainly contains folder names and optionally some uglification options.<br/>
The interface name is *NgxUglifierConfig*.

| name        |               | 
|------------- |:-------------|
| projectName | the library name |
| srcParentFolder | this will usually be 'dist', if you omit this property it will default to 'dist' |
| destParentFolder | an optional property which specifies the parent folder where the uglified code will be placed.<br/>if you want it to be placed at 'uglified/projectName' then pass 'uglified' here.<br/>if you omit this property or have it the same as *srcParentFolder* then the uglified code will be placed at *srcParentFolder/projectName*. |
| uglifyOptions | an optional object of interface *NgxUglifierOptions* containing options you want to pass to terser.<br/>The options and their default values are described below. |

# uglifyOptions object

The uglifyOptions object contain properties which will be used by terser to uglify the code.<br/>
This object is optional, the default values are optimized for es6 apps.<br/>
The interface name is *NgxUglifierOptions*.

| Option        |               | 
|------------- |:-------------|
| ecma | pass 5, 2015, 2016, etc.<br/>default: 2015 |
| isModule | Use when minifying an ES6 module.<br/>default: true |
| sourceMap | generate source maps or not. <br/>default: false |
| classes | specify class names to preserve, pass a regular expression or *true* to preserve all.<br/>default: /^_/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(preserve those which start with underscore).|
| functions | specify function names to preserve, pass a regular expression or *true* to preserve all.<br/>default: /^_/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(preserve those which start with underscore).|
| properties | specify variable names to preserve, pass a regular expression or *true* to preserve all.<br/>default: /^_/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(preserve those which start with underscore).|
| topLevel | set to *true* if you wish to enable top level variable and function name mangling and to drop unused variables and functions.<br/>default: false |
| isLegacyAccessorsDefinition | typescript 3.7 (used by angular >=9) has breaking changes from earlier versions in regards to setters/getters in the produced definition files (the d.ts files).<br/>so if you build your lib with angular 9 and consume it by an angular 8 app, then the app's typescript compiler (version <= 3.5) will not recognize the getters/setters syntax produced by typescript 3.7.<br/>passing *true* will make the setters/getters definition to be produced as the old syntax which is compatible to BOTH the old typescript and and the new one.<br/>default: true |

