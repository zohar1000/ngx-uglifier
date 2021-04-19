const NgxUglifier = require('./dist/ngx-uglifier');
// const NgxUglifier = require('ngx-uglifier');

const config = {
	projectName: 'ng-cond'
}

const ngxUglifier = new NgxUglifier.NgxUglifier(config);
ngxUglifier.init().then(() => console.log(`ngx-uglify ended successfully, the uglified code is placed at ${config.destParentFolder}/${config.projectName}.`));
