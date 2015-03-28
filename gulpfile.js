var gulp               = require('gulp'),
    fs                 = require('fs'),
    _                  = require('underscore'),
    args               = require('yargs').argv,
    runSequence        = require('run-sequence'),
    plugins            = require('gulp-load-plugins')(),
    bdir               = require('./functions/build-dir'),
    historyApiFallback = require('connect-history-api-fallback');

/* Flag that defines if the tasks should be performed in production mode */
global.isProduction = false;

/* Get the default gulp config */
var gulpConfig = JSON.parse(fs.readFileSync('./default-config/gulp-config.json', 'utf8'));

/* If a custom gulp config doesn't exist generate one so every user can have his custom settings */
if (!fs.existsSync('custom-gulp-config.json')) {
  fs.writeFileSync('custom-gulp-config.json', fs.readFileSync('./default-config/custom-gulp-template.json'));
}

/* Merge the custom gulp config with the default one so every custom setting can be overriden */
gulpConfig = _.extend(gulpConfig, JSON.parse(fs.readFileSync('custom-gulp-config.json', 'utf8')));

/* If the project is an angular project the dependencies should be specified in the gulp config so if the user wants some of the
 * dependencies to be ignored just on his machine he can specify that in the gulpConfig.ignoredFiles.dependencies property.
 */
var dependencies = _(gulpConfig.dependencies).filter(function (dependency) {
  return global.isProduction === true || gulpConfig.ignore !== true || gulpConfig.ignoredFiles.dependencies.indexOf(dependency) === -1;
});

/* In the replacements array you can add any key:value that later will be replaced in every of the html and js files
 * So for example if your app needs access to the port the app is running on and you have the port define in your gulpfile you can access
 * it easily from your html/js.
 */
var replacements = [
  ["G_SERVER_PORT", gulpConfig.serverPort],
  ["G_DEPENDENCIES", JSON.stringify(dependencies)]
];

/* If you add this repository as a submodule of any other app it will live in a folder inside of that app. So that's why the default
 * prefix is ".." and it's telling the gulp tasks where to look for your files (in this case, one folder backwards).
 * Another thing you can do is just pull this repository somewhere on your pc and if you want to run any app just add it's full path
 * to the prefix property, so you can have just one gulp folder on your pc that will run all of your apps.
 * */
var prefix = gulpConfig.prefix !== '' ? (gulpConfig.prefix + "/") : '';

var directories = {
  root: '/',
  prefix: prefix,
  app: 'app',
  build: 'build',
  css: 'css',
  js: 'js',
  templates: 'templates',
  images: gulpConfig.imagesFolder,
  custom: 'custom',
  fonts: 'fonts',
  font: 'font',
  json: 'json',
  bower: 'bower_components',
  scss: 'scss',
  zip: 'zip',
  tasks: './tasks'
};

var settings = {
  /* Settings for the node server that will serve our index.html and assets */
  server: {
    "root": prefix + directories.build,
    "host": 'localhost',
    "livereload": gulpConfig.liveReload,  // Tip: disable livereload if you're using older versions of internet explorer because it doesn't work
    "middleware": function () {
      return [historyApiFallback];
    },
    port: gulpConfig.serverPort
  },
  /* Settings for bower */
  bower: {
    paths: {
      "bowerDirectory": prefix + directories.bower,
      "bowerrc": prefix + '.bowerrc',
      "bowerJson": prefix + 'bower.json'
    }
  }
};

var tasksConfig = {
  gulp: gulpConfig,
  server: settings.server,
  bower: settings.bower,
  dirs: directories,
  replacements: replacements
};

/* ================================= Task Loader Functions  =========================== */

/* Each of the tasks that are in a separate file needs access to
 * the variables "gulp", "plugins" and "tasksConfig", so when a tasks is required
 * those 3 are supplied as arguments
 * */
function addTask(folder, task, runBeforeTask) {
  var taskName = task ? (folder + ":" + task) : folder;
  var taskFolder = "/" + folder + (task ? "/" : '') + (task ? (folder + "-" + task) : (task ? folder : ''));
  gulp.task(taskName, runBeforeTask ? runBeforeTask : [], require(directories.tasks + "/" + taskFolder)(gulp, plugins, tasksConfig));
}

function addTaskCombination(name, arr, runBeforeTask) {
  runBeforeTask = runBeforeTask ? runBeforeTask : [];
  gulp.task(name, runBeforeTask.concat(_(arr).map(function (m) {
    return name + ":" + m
  })));
}

/* ================================= Task List  =========================== */

/* Clean */
addTask('clean', 'build');
addTask('clean', 'zip');

/* Compile */
addTask('compile', 'coffee');
addTask('compile', 'jade');
addTask('compile', 'sass');

/* Concat */
addTask('concat', 'js');
addTask('concat', 'css', ['compile:sass']);
addTask('concat', 'bower');
addTaskCombination('concat', ['bower', 'js', 'css']);

/* Copy */
addTask('copy', 'build');
addTask('copy', 'font');
addTask('copy', 'fonts');
addTask('copy', 'html', ['compile:jade']);
addTask('copy', 'htmlroot');
addTask('copy', 'images', ['imagemin']);
addTask('copy', 'json');
addTaskCombination('copy', ['html', 'images', 'json', 'fonts', 'font', 'htmlroot'], ['clean:build', 'concat:bower']);

/* Run server that will serve index.html and the assets */
addTask('server');

/* Minify images */
addTask('imagemin');

/* Build the app and put the 'build' folder in a zip file */
addTask('zip');

/* Watch the directories for changes and reload the page, or if a scss/css file is changed inject it automatically without refreshing */
addTask('watch');

/* Delete build folder, copy, minify, annotate everything, then copy it to the destination folder */
addTask('build', 'copy');

/* Just build the project, don't run anything else */
addTask('build', 'only');

/* Run the built & minified site in production mode without hashing anything and copying to the destination folder */
addTask('build', 'prod');

/* Print all the gulp tasks */
gulp.task('tasks', plugins.taskListing);

/* Default task: Builds the app and runs the server without minifying or copying anything to a destination */
gulp.task('default', ['copy', 'concat', 'server', 'watch']);
