/*
 *  Copyright (c) 2014, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

var React = require('react')
var assign = require('object-assign')
var fs = require('fs')
var path = require('path')
var webpack = require('webpack')
var webpackMiddleware = require("webpack-dev-middleware")
var recursiveReadDir = require('recursive-readdir')

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
  'https://cdnjs.cloudflare.com/ajax/libs/react/'+React.version+'/react.min.js'
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

  var middleware

  function serveComponent(req, res, next) {
    if(middleware) return middleware(req, res, next)

    recursiveReadDir(req.app.get('views'), function(err, files) {
      if(err) return next(err)

      var entry = {}
        , fileType = new RegExp('\\.'+req.app.get('view engine')+'$', 'i')
      
      files.forEach(function(filename) {
        if(fileType.test(filename)) {
          var name = path.relative(req.app.get('views'), filename).replace(fileType, '')
          entry[name] = [filename]
        }
      })

      middleware = webpackMiddleware(webpack({
        entry: entry,
        output: {
          path: '/',
          filename: '[name].js',
          library: 'Component'
        },
        module: {
          loaders:[{
            test: /\.jsx?$/,
            loader: "babel-loader"
          },{
            test: /\.json$/,
            loader: "json-loader"
          }]
        },
        externals: {
          react:'React'
        }
      }), {
          noInfo: false,
          quiet: false,
          lazy: false,
          watchOptions: {
              aggregateTimeout: 300,
              poll: true
          },
          publicPath: "/components/",
          stats: {
              colors: true
          }
      })

      return middleware(req, res, next)
    })
  }

  return { engine:renderFile, middleware:serveComponent };
}

exports.init = init