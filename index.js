/*
 *  Copyright (c) 2014, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

var React = require('react')
var beautifyHTML = require('js-beautify').html
var assign = require('object-assign')
var fs = require('fs')
var path = require('path')
var webpack = require('webpack')

var DEFAULT_OPTIONS = {
  doctype: '<!DOCTYPE html>',
  beautify: false,
  transformViews: true,
  mountNode: '#app',
  html: path.join(__dirname, './html.js'),
  includeDefaultScripts: true,
  includeDefaultStyles: true,
  scripts:[],
  styles:[]
}

var INCLUDED_SCRIPTS = [
  'https://fb.me/react-0.13.3.js'
]

var INCLUDED_STYLES = [
  'https://cdnjs.cloudflare.com/ajax/libs/normalize/3.0.3/normalize.min.css'
]

function init(engineOptions) {
  var registered = false;
  var moduleDetectRegEx;

  engineOptions = assign({}, DEFAULT_OPTIONS, engineOptions || {});

  var styles = engineOptions.includeDefaultStyles ? INCLUDED_STYLES.concat(engineOptions.styles) : engineOptions.styles
  var scripts = engineOptions.includeDefaultScripts ? INCLUDED_SCRIPTS.concat(engineOptions.scripts) : engineOptions.scripts

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
      var view = require(filename);
      var html = require(path.resolve(options.settings.views, engineOptions.html));

      // Transpiled ES6 may export components as { default: Component }
      view = view.default || view;
      html = html.default || html;

      // Props are the options minus the settings
      var viewProps = assign({}, options)
      delete viewProps['settings']
      delete viewProps['_locals']
      
      // Generate view markup (mountable client-side)
      var viewMarkup = React.renderToString(React.createElement(view, viewProps))
      
      // htmlProps are the same as viewProps, but we also add the viewMarkup
      var htmlProps = assign({}, viewProps, { viewMarkup:viewMarkup })

      // Generate the code to mount the React component client side
      var mountScripts = createMountScripts(path.relative(options.settings.views, filename), viewProps)

      // Generate the full html markup
      var markup = engineOptions.doctype + React.renderToStaticMarkup(React.createElement(html, htmlProps));
      markup = insertStyles(markup, styles)
      markup = insertScripts(markup, scripts.concat(mountScripts))
    } catch (e) {
      return cb(e);
    }

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

  function createMountScripts(filename, props) {
    return [
      '/components/'+filename.replace(/\\/g,'/'),
      '<script>React.render(React.createElement(Component, '+JSON.stringify(props)+'), document.querySelector(\''+engineOptions.mountNode+'\'))</script>'
    ]
  }

  function insertStyles(html, styles) {
    styles = styles.map(function(style) {
      if(/^\<style/.test(style)) {
        return style
      }
      return '<link rel="stylesheet" href="'+style+'" />'
    }).join('')

    return html.replace('</head>', styles + '</head>')
  }

  function insertScripts(html, scripts) {
    scripts = scripts.map(function(script) {
      if(/^\<script/.test(script)) {
        return script
      }
      return '<script src="'+script+'"></script>'
    }).join('')

    return html.replace('</body>', scripts + '</body>')
  }

  function serveComponent(req, res, next) {
    var match
      , filename
      , inputFile
      , outputPath
      , outputFile

    if(match = /^\/components\/(.+\.jsx?)/.exec(req.url)) {
        filename = match[1]
        inputFile = path.join(req.app.get('views'), filename)
        outputPath = path.join(__dirname, 'components')
        outputFile = path.join(outputPath, filename)

        fs.stat(inputFile, function(err, inputStats) {
          if(err) next(err)
          fs.stat(outputFile, function(err, outputStats) {
            if(err) return createAndServe()

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