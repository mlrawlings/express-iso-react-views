# express-iso-react-views

This is an [Express][express] view engine which renders [React][react] components on server and allows mounting of components on the client. This is a fork of [express-react-views](https://github.com/reactjs/express-react-views).

This is intended to be used as a replacement for existing server-side view solutions, like [jade][jade], [ejs][ejs], or [handlebars][hbs].

## Usage

```sh
npm install express-iso-react-views react
```

**Note:** You must explicitly install `react` as a dependency. `react` is a peer dependency here. This is to avoid issues that may come when using incompatible versions.

### Add it to your app.

```js
// app.js

var app = express();
var reactViews = require('express-iso-react-views').init();

app.set('views', __dirname + '/components');
app.set('view engine', 'jsx');
app.engine('jsx', reactViews.engine);
app.use(reactViews.middleware);
```

### Options

option | values | default
-------|--------|--------
`doctype` | any string that can be used as [a doctype](http://en.wikipedia.org/wiki/Document_type_declaration), this will be prepended to your document | `"<!DOCTYPE html>"`
`transformViews` | `true`: use `babel` to apply JSX, ESNext transforms to views.<br>**Note:** if already using `babel/register` in your project, you should set this to `false` | `true`
`includeDefaultScripts` | `true`: include React on the client. version is automatically matched to the version you have installed on the server | `true`
`includeDefaultStyles` | `true`: include normalize.css on the client | `true`
`styles` | an array of styles to be added on the client. can be either urls or style tags | `[]`
`scripts` | an array of scripts to be added on the client. can be either urls or full script tags | `[]`
`html` | path to html component, relative to your views directory (see [Creating a Custom Html Component](#html-component)) | built-in
`mountNode` | a selector describing the node to mount on the client (see [Creating a Custom Html Component](#html-component)) | `'#app'`
The defaults are sane, but just in case you want to change something, here's how it would look:

```js
var options = { doctype: "<!DOCTYPE html>" };
var reactViews = require('express-iso-react-views').init(options);
```

#### <a name="html-component"></a> Creating a Custom Html Component
An html component is used **server-side only** to create **static** markup to wrap your component that will be mounted client-side.  It defines a mount node for the client and sets the innerHTML of that node.

The minimum required for an Html component is:

```  
// components/html.jsx

var React = require('react');

var Html = React.createClass({
  render() {
    return (
      <html>
      <body>
        <div id="app" dangerouslySetInnerHTML={{ __html:this.props.viewMarkup }}></div>
      </body>
      </html>
    );
  }
});

module.exports = Html;
```

the id `app` may be changed by passing a selector as the value to the `mountNode` option:

```
var reactViews = require('express-iso-react-views').init({
  html:'html.jsx',
  mountNode:'.myCustomClass'
});
```


### Views

Under the hood, [Babel][babel] is used to compile your views into ES5 friendly code, using the default Babel options.  Only the files in your `views` directory (i.e. `app.set('views', __dirname + '/views')`) will be compiled.

Your views should be node modules that export a React component. Let's assume you have this file in `views/index.jsx`:

```js
var React = require('react');

var HelloMessage = React.createClass({
  render: function() {
    return <div>Hello {this.props.name}</div>;
  }
});

module.exports = HelloMessage;
```

### Routes

Your routes would look identical to the default routes Express gives you out of the box.

```js
// app.js

app.get('/', require('./routes').index);
```

```js
// routes/index.js

exports.index = function(req, res){
  res.render('index', { name: 'John' });
};
```

### Layouts

Simply pass the relevant props to a layout component.

`components/layouts/default.jsx`:
```js
var React = require('react');

var DefaultLayout = React.createClass({
  render: function() {
    return (
      <div>
        <header>
          <h1>{this.props.pageTitle}</h1>
          <nav></nav>
        </header>
        <div>{this.props.children}</body>
        <footer>
          Copyright &copy; My Awesome Company
        </footer>
      </div>
    );
  }
});

module.exports = DefaultLayout;
```

`components/index.jsx`:
```js
var React = require('react');
var DefaultLayout = require('./layouts/default');

var HelloMessage = React.createClass({
  render: function() {
    return (
      <DefaultLayout pageTitle={this.props.pageTitle}>
        <div>Hello {this.props.name}</div>
      </DefaultLayout>
    );
  }
});

module.exports = HelloMessage;
```

**That's it!** Layouts follow really naturally from the idea of composition.

## Questions

### What about partials & includes?

These ideas don't really apply. But since they are familiar ideas to people coming from more traditional "templating" solutions, let's address it. Most of these can be solved by packaging up another component that encapsulates that piece of functionality.

### What about view helpers?

I know you're used to registering helpers with your view helper (`hbs.registerHelper('something', ...))`) and operating on strings. But you don't need to do that here.

* Many helpers can be turned into components. Then you can just require and use them in your view.
* You have access to everything else in JS. If you want to do some date formatting, you can `require('moment')` and use directly in your view. You can bundle up other helpers as you please.

### Where does my data come from?

All "locals" are exposed to your view in `this.props`. These should work identically to other view engines, with the exception of how they are exposed. Using `this.props` follows the pattern of passing data into a React component, which is why we do it that way. Remember, as with other engines, rendering is synchronous. If you have database access or other async operations, they should be done in your routes.


## Caveats

* This currently uses `require` to access your views. This means that contents are cached for the lifetime of the server process. You need to restart your server when making changes to your views. **In development, we clear your view files from the cache so you can simply refresh your browser to see changes.**
* React & JSX have their own rendering caveats. For example, inline `<script>`s and `<style>`s will need to use `dangerouslySetInnerHTML={{__html: 'script content'}}`. You can take advantage of ES6 template strings here.

```js
<script dangerouslySetInnerHTML={{__html: `
  // google analtyics
  // is a common use
`}} />
```

* It's not possible to specify a doctype in JSX. You can override the default HTML5 doctype in the options.

[express]: http://expressjs.com/
[react]: http://facebook.github.io/react/
[jade]: http://jade-lang.com/
[ejs]: http://embeddedjs.com/
[hbs]: https://github.com/barc/express-hbs
[babel]: https://babeljs.io/
