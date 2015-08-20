/*
 *  Copyright (c) 2014, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

var React = require('react');
var beautifyHTML = require('js-beautify').html;
var assign = require('object-assign');
var fs = require('fs')
var path = require('path')
var webpack = require('webpack')

var DEFAULT_OPTIONS = {
  doctype: '<!DOCTYPE html>',
  beautify: false,
  transformViews: true,
  root: path.join(__dirname, '../..')
};

function init(engineOptions) {
  var registered = false;
  var moduleDetectRegEx;

  engineOptions = assign({}, DEFAULT_OPTIONS, engineOptions || {});

  function renderFile(filename, options, cb) {
    // Defer babel registration until the first request so we can grab the view path.
    if (!moduleDetectRegEx) {
      moduleDetectRegEx = new RegExp('^' + options.settings.views);
    }
    if (engineOptions.transformViews && !registered) {
      // Passing a RegExp to Babel results in an issue on Windows so we'll just
      // pass the view path.
      require('babel/register')({
        only: options.settings.views
      });
      registered = true;
    }

    try {
      var markup = engineOptions.doctype;
      var layout = require(path.resolve(filename, '..', options.layout || engineOptions.layout));
      var component = require(filename);
      // Transpiled ES6 may export components as { default: Component }
      component = component.default || component;

      var componentMarkup = React.renderToString(React.createElement(component, options))

      options.componentMarkup = componentMarkup

      markup += React.renderToStaticMarkup(React.createElement(layout, options));
      markup = markup.replace('</html>', createMount(filename, options) + '</html>');
    } catch (e) {
      return cb(e);
    }

    /*if (engineOptions.beautify) {
      // NOTE: This will screw up some things where whitespace is important, and be
      // subtly different than prod.
      markup = beautifyHTML(markup);
    }*/

    if (options.settings.env === 'development') {
      // Remove all files from the module cache that are in the view folder.
      Object.keys(require.cache).forEach(function(module) {
        if (moduleDetectRegEx.test(require.cache[module].filename)) {
          delete require.cache[module];
        }
      });
    }

    cb(null, markup);
  }

  function createMount(filename, options) {
    return '<script src="/components'+filename.replace(engineOptions.root, '').replace(/\\/g,'/')+'"></script>' +
    '<script>React.render(React.createElement(Component, '+JSON.stringify(options)+'), document.querySelector(\''+engineOptions.mountNode+'\'))</script>'
  }

  function serveComponent(req, res, next) {
    var match
      , filename
      , inputFile
      , outputPath
      , outputFile
    if(match = /^\/components\/(\w+\.js)/.exec(req.url)) {
        filename = match[1]
        inputFile = path.join(engineOptions.root, filename)
        outputPath = path.join(__dirname, 'components')
        outputFile = path.join(outputPath, filename)

        fs.stat(inputFile, function(err, inputStats) {
          if(err) next(err)
          fs.stat(outputFile, function(err, outputStats) {
            if(err) createAndServe()

            if(inputStats.mtime > outputStats.mtime) {
              createAndServe()
            } else {
              res.sendFile(outputFile)
            }
          })
        })

        function createAndServe() {
          webpack({
            entry: inputFile,
            output: {
              path: outputPath,
              filename: filename,
              publicPath: '/components/'+filename,
              library: 'Component'
            },
            module: {
              loaders:[{
                // "test" is commonly used to match the file extension
                test: /\.jsx?$/,
                // the "loader"
                loader: "babel-loader"
              }]
            },
            externals: {
              react:'React'
            }
          }).run(function(err, stats) {
            if(err) next(err)
            res.sendFile(outputFile)
          })
        }
    } else {
      return next();
    }
  }

  return { engine:renderFile, middleware:serveComponent };
}

exports.init = init