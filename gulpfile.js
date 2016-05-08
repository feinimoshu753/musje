'use strict';

var gulp = require('gulp');
var gutil = require('gulp-util');
var runSequence = require('run-sequence');
var browserSync = require('browser-sync').create();
var jsdoc = require('gulp-jsdoc3');
var clean = require('gulp-clean');
var webpack = require('webpack');
var mocha = require('gulp-mocha');


gulp.task('default', ['watch-demo']);

gulp.task('build', ['build-musje', 'build-doc']);

gulp.task('build-musje', function () {
  runSequence('webpack:build-musje', 'webpack:build-musje.min');
});
gulp.task('watch-demo', ['demo:watch']);

gulp.task('build-doc', function () {
  runSequence('jsdoc:clean', 'jsdoc:build');
});
gulp.task('watch-doc', ['jsdoc:watch']);

gulp.task('test', ['mocha']);
gulp.task('watch-test', ['mocha:watch']);


var webpackConfig = require('./webpack.config.js');

gulp.task('webpack:build-musje', function(callback) {
  webpack(webpackConfig, function (err, stats) {
    if (err) { throw new gutil.PluginError('webpack:build-musje', err); }
    gutil.log('[webpack:build-musje]', stats.toString({ colors: true }));
    callback();
  });
});

gulp.task('webpack:build-musje.min', function(callback) {
  var config = Object.create(webpackConfig);
  config.output.filename = config.output.filename.replace(/js$/, 'min.js');
  config.plugins.push(
    new webpack.optimize.DedupePlugin(),
    new webpack.optimize.UglifyJsPlugin()
  );
  webpack(config, function (err, stats) {
    if (err) { throw new gutil.PluginError('webpack:build-musje.min', err); }
    gutil.log('[webpack:build-musje.min]', stats.toString({ colors: true }));
    callback();
  });
});

var devConfig = Object.create(webpackConfig);
devConfig.devtool = 'inline-source-map';
devConfig.debug = true;
var devCompiler = webpack(devConfig);

gulp.task('webpack:build-musje-dev', function(callback) {
  devCompiler.run(function(err, stats) {
    if(err) {
      throw new gutil.PluginError('webpack:build-musje-dev', err);
    }
    gutil.log('[webpack:build-musje-dev]', stats.toString({
      colors: true
    }));
    callback();
  });
});

gulp.task('webpack:watch-musje-dev', ['webpack:build-musje-dev'], function() {
  gulp.watch([
    './src/**/*', '!./src/**/__tests__/*.js'
  ], ['webpack:build-musje-dev']);
});


gulp.task('demo:watch', ['webpack:watch-musje-dev'], function() {
  browserSync.init({
    server: { baseDir: './' },
    startPath: '/demo/',
  });
  gulp.watch('./lib/musje.css', function () {
    gulp.src('./lib/musje.css').pipe(browserSync.stream());
  });
  gulp.watch('./addon/codemirror/musje-codemirror.css', function () {
    gulp.src('./addon/codemirror/musje-codemirror.css')
      .pipe(browserSync.stream());
  });
  gulp.watch('./demo/main.css', function () {
    gulp.src('./demo/main.css').pipe(browserSync.stream());
  });
  gulp.watch([
    './demo/*.html', './demo/main.js',
    './lib/musje.js', './addon/codemirror/musje-codemirror.js'
  ])
    .on('change', browserSync.reload);
});


gulp.task('jsdoc:clean', function () {
  return gulp.src('./doc', { read: false })
        .pipe(clean());
});

gulp.task('jsdoc:build', function (cb) {
  var config = require('./jsdoc.config.json');
  gulp.src([
    // './package.json',
    './README.md',
    './src/**/*.js', '!./src/**/__tests__/*.js'
  ], { read: false })
  .pipe(jsdoc(config, cb));
});

gulp.task('jsdoc:watch', ['jsdoc:build'], function() {
  browserSync.init({
    server: { baseDir: './' },
    startPath: '/doc/',
  });
  gulp.watch(['./src/**/*.js', '!./src/**/__tests__/*.js'], function () {
    runSequence('jsdoc:build', browserSync.reload);
  });
});


gulp.task('mocha', function() {
  return gulp.src('src/**/__tests__/*.js', { read: false })
    .pipe(mocha({
      // reporter: 'list',
      require: ['./src/__tests__/helper'],
      inlineDiffs: true
    }))
    .on('error', gutil.log);
});

gulp.task('mocha:watch', ['mocha'], function() {
  gulp.watch('src/**/__tests__/*.js', ['mocha']);
});
