var React = require('react')

module.exports = React.createClass({
	render: function() {
		return (
			React.createElement('html', {},
				React.createElement('head', {}, 
					React.createElement('title', {}, this.props.title),
					React.createElement('link', { rel:"shortcut icon", href:"/favicon.ico" }),
					React.createElement('meta', { name:"viewport", content:"width=device-width, initial-scale=1.0" })
				),
				React.createElement('body', {},
					React.createElement('div', { id:"app", dangerouslySetInnerHTML:{ __html:this.props.viewMarkup } })
				)
			)
		)
	}
})