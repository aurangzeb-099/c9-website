'use strict';

( function () {
	// Core and component defaults
	const
		coreDefaults = {
			root: document.documentElement,
			logs: false,
			iePolyfill: 'https://polyfill.io/v3/polyfill.min.js?features=Array.from%2CCustomEvent%2CNodeList.prototype.forEach%2CObject.assign%2CIntersectionObserver%2CPromise',
			ieHandler: null,
			onScriptsReady: null,
			onStylesReady: null,
			onReady: null,
			onError: errorHandler
		},
		componentDefaults = {
			owner: null,
			name: null,
			selector: null,
			style: null,
			script: null,
			init: null,
			priority: 2
		};

	/**
	 * Defining the tag of the object to be retrieved (for precise definition of the type)
	 * @param {*} data - any object
	 * @returns {string} - object tag
	 * @todo DEL
	 */
	function objectTag ( data ) {
		return Object.prototype.toString.call( data ).slice( 8, -1 );
	}

	/**
	 * Merging objects
	 * @param {Object} source - source object
	 * @param {Object} merged - merge object
	 * @return {Object} - merged object
	 */
	function merge( source, merged ) {
		for ( let key in merged ) {
			if ( objectTag( merged[ key ] ) === 'Object' ) {
				if ( typeof( source[ key ] ) !== 'object' ) source[ key ] = {};
				source[ key ] = merge( source[ key ], merged[ key ] );
			} else {
				source[ key ] = merged[ key ];
			}
		}

		return source;
	}

	/**
	 * IE detection in "userAgent"
	 * @returns {null|number} - null or IE version number
	 */
	function ieDetect () {
		let
			ua = window.navigator.userAgent,
			msie = ua.indexOf( 'MSIE ' ),
			trident = ua.indexOf( 'Trident/' ),
			edge = ua.indexOf( 'Edge/' );

		if ( msie > 0 ) {
			return parseInt( ua.substring( msie + 5, ua.indexOf( '.', msie ) ), 10 );
		}

		if ( trident > 0 ) {
			let rv = ua.indexOf( 'rv:' );
			return parseInt( ua.substring( rv + 3, ua.indexOf( '.', rv ) ), 10 );
		}

		if ( edge > 0 ) {
			return parseInt( ua.substring( edge + 5, ua.indexOf( '.', edge ) ), 10 );
		}

		return null;
	}

	/**
	 * Simple error handler.
	 * Creates an element with an error notification and adds it to the document body.
	 */
	function errorHandler () {
		if ( !document.querySelector( '#zemez-core-error' ) ) {
			let node = document.createElement( 'div' );
			node.setAttribute( 'id', 'zemez-core-error' );
			node.setAttribute( 'style', 'position: fixed; bottom: 1vh; left: 1vw; z-index: 1000; max-width: 98vw; padding: 10px 15px; border-radius: 4px; font-family: monospace; background: #f2564d; color: white;' );
			node.innerText = 'There was an error on this page, please try again later.';
			document.body.appendChild( node );
		}
	}

	/**
	 * Parallel execution of a function that returns a promise to which data from an array is passed.
	 * @param {Array} params - an array of parameters passed to the callback.
	 * @param {function} cb - a callback that returns promises.
	 * @returns {Promise} - promises returned from the callback.
	 */
	function parallel ( params, cb ) {
		let inclusions = [];

		params.forEach( function ( path ) {
			inclusions.push( cb( path ) );
		});

		return Promise.all( inclusions );
	}

	/**
	 * Sequential execution of a function that returns a promise to which data from an array is passed.
	 * @param {Array} params - an array of parameters passed to the callback.
	 * @param {function} cb - a callback that returns promises.
	 * @returns {Promise} - promises returned from the callback.
	 */
	function series ( params, cb ) {
		let chain = Promise.resolve();

		params.forEach( function( path ) {
			chain = chain.then( cb.bind( null, path ) );
		});

		return chain;
	}

	/**
	 * Adding style tag to document head.
	 * If a tag with the same resource already exists, then the promise is fulfilled immediately.
	 * @param {string} path - the path to the style file.
	 * @return {Promise} - promises that will be fulfilled after loading the styles.
	 */
	function includeStyle ( path ) {
		return new Promise( function ( resolve, reject ) {
			if ( document.querySelector( `link[href="${path}"]` ) ) {
				resolve();
			} else {
				let link = document.createElement( 'link' );
				link.setAttribute( 'rel', 'stylesheet' );
				link.setAttribute( 'href', path );
				link.addEventListener( 'load', resolve );
				link.addEventListener( 'error', reject );
				document.querySelector( 'head' ).appendChild( link );
			}
		});
	}

	/**
	 * Adding script tag to document head.
	 * If a tag with the same resource already exists, then the promise is fulfilled immediately.
	 * @param {string} path - path to the script file.
	 * @return {Promise} - promises that will be fulfilled after loading the script.
	 */
	function includeScript ( path ) {
		return new Promise( function ( resolve, reject ) {
			let node = document.querySelector( `script[src="${path}"]` );

			if ( node ) {
				if ( node.getAttribute( 'data-loaded' ) === 'true' ) {
					resolve();
				} else {
					node.addEventListener( 'load', resolve );
					node.addEventListener( 'error', reject );
				}
			} else {
				let script = document.createElement( 'script' );
				script.src = path;

				script.addEventListener( 'load', function () {
					script.setAttribute( 'data-loaded', 'true' );
					resolve();
				});
				script.addEventListener( 'error', reject );

				document.querySelector( 'head' ).appendChild( script );
			}
		});
	}

	/**
	 * Checking the position of an element relative to the viewport (only vertically)
	 * @param {Element} node - element being checked.
	 */
	function inViewport ( node ) {
		let bound = node.getBoundingClientRect();
		return !( bound.bottom < 0 || bound.top > window.innerHeight );
	}

	/**
	 * Checking the position of an element relative to the viewport (only vertically).
	 * Two areas are checked for the height of the viewport, before and after the viewport.
	 * @param {Element} node - element being checked.
	 */
	function nearViewport ( node ) {
		let bound = node.getBoundingClientRect();
		return !( bound.bottom < 0 - window.innerHeight || bound.top > 0 ) || !( bound.bottom < window.innerHeight || bound.top > window.innerHeight * 2 );
	}


	/**
	 * Component constructor.
	 * @param {object} params - component parameters.
	 * @param {string} params.name - unique name of the component.
	 * @param {Element} params.node - component node on the page.
	 * @param {ZemezCore} params.owner - the core that will manage the component.
	 * @param {Array.<string>} [params.style] - an array of links to included styles. They will parallel included.
	 * @param {Array.<string>} [params.script] - an array of links to plug-in scripts. They are included to the page strictly sequentially.
	 * @param {function} [params.init] - a callback for initializing a component, executed after connecting all the component's scripts, if any.
	 * @constructor
	 */
	function ZemezComponent ( params ) {
		// Merging default parameters and derived parameters
		merge( this, componentDefaults );
		merge( this, params );

		// Setting the initial state of the component (pending)
		this.state = 'pending';

		// Adding a component reference to a managed node
		if ( !this.node.ZemezComponent ) this.node.ZemezComponent = {};
		this.node.ZemezComponent[ this.name ] = this;
	}

	/**
	 * Component method for logs. Differs in light green color.
	 * @param {*} args
	 */
	ZemezComponent.prototype.log = function ( ...args ) {
		if ( this.owner.logs ) console.log( `%c[${this.name}]`, 'color: lightgreen; font-weight: 900;', ...args );
	};

	/**
	 * Component error handler.
	 * Prints an error message to the console with the name of the component in which the error occurred, the field of which calls the core error handler passing the error data and component context to it.
	 * @param {*} args - error data.
	 */
	ZemezComponent.prototype.error = function ( ...args ) {
		console.error( `[${this.name}] error\n`, ...args );
		if ( this.owner.onError instanceof Function ) this.owner.onError.call( this, ...args );
	};

	/**
	 * Component loader.
	 * Adds style and script tags to the document head, after which an init callback is executed if all the components specified in depend have been initialized.
	 * After all actions on the root element, the scripts and styles ready event is thrown.
	 * @return {Object.<Promise>} - an object with promises to connect styles and scripts.
	 */
	ZemezComponent.prototype.load = function () {
		// this.log( 'init:', this.node );

		let
			stylesState = Promise.resolve(),
			scriptsState = Promise.resolve();

		if ( this.style && this.style.length ) {
			stylesState = stylesState.then( parallel.bind( this, this.style, includeStyle ) ).catch( this.error.bind( this ) );
		}

		if ( this.script && this.script.length ) {
			scriptsState = scriptsState.then( series.bind( this, this.script, includeScript ) ).catch( this.error.bind( this ) );
		}

		// TODO
		// if ( this.depend && this.depend.length ) {
		// 	scriptsState = scriptsState.then( series.bind( this, this.depend, this.checkDependency.bind( this ) ) ).catch( this.error.bind( this ) );
		// }

		if ( this.init && this.init instanceof Function ) {
			scriptsState = scriptsState.then( this.init.bind( this, this.node ) ).catch( this.error.bind( this ) );
		}

		stylesState.then( () => {
			// this.log( 'styles ready' );
			this.node.dispatchEvent( new CustomEvent( `${this.name}:stylesReady` ) );
		});

		scriptsState.then( () => {
			// this.log( 'scripts ready' );
			this.node.dispatchEvent( new CustomEvent( `${this.name}:scriptsReady` ) );
		});

		Promise.all([
			stylesState,
			scriptsState
		]).then( () => {
			// this.log( 'ready:', this.node );
			this.state = 'ready';
			this.node.dispatchEvent( new CustomEvent( `${this.name}:ready` ) );
		});

		return {
			scriptsState: scriptsState,
			stylesState: stylesState
		};
	};

	// Changing the ZemezComponent tag
	Object.defineProperty( ZemezComponent.prototype, Symbol.toStringTag, {
		get: function () { return 'ZemezComponent'; }
	});


	/**
	 * Core constructor.
	 * @param params
	 * @constructor
	 */
	function ZemezCore ( params ) {
		// Merging default parameters and derived parameters
		merge( this, coreDefaults );
		merge( this, params );

		// IE detection
		this.ie = ieDetect();

		if ( this.ie !== null && this.ie < 12 ) {
			// Adding polyfills to work in IE
			console.warn( '[ZemezCore] detected IE'+ this.ie +', load polyfills' );
			let script = document.createElement( 'script' );
			script.src = this.iePolyfill;
			document.querySelector( 'head' ).appendChild( script );
			script.addEventListener( 'load', () => {
				// Execution of an additional callback for IE (for example, adding a class to html for correct work of styles)
				if ( this.ieHandler instanceof Function ) this.ieHandler.call( this, this.ie );
			});
		}

		this.registry = {};
		this.components = [];
	}

	/**
	 * Core method for logs. Differs in orange color.
	 * @param {*} args
	 */
	ZemezCore.prototype.log = function ( ...args ) {
		if ( this.logs ) console.log( '%c[ZemezCore]', 'color: orange; font-weight: 900;', ...args );
	};

	/**
	 * Registering a component with a core instance.
	 * @param {object} params - component parameters.
	 * @param {string} params.name - unique name of the component.
	 */
	ZemezCore.prototype.register = function ( params ) {
		// Register writing
		let entry = this.registry[ params.name ] = params;

		// Adding parameters
		entry.nodes = [];

		// Create an array from the "style" parameter if it is not an array
		if ( entry.style && !( entry.style instanceof Array ) ) {
			entry.style = [ entry.style ];
		}

		// Create an array from the "script" parameter if it is not an array
		if ( entry.script && !( entry.script instanceof Array ) ) {
			entry.script = [ entry.script ];
		}
	};

	/**
	 * A method for preparing all components for initialization.
	 * Creates components that have not yet been initialized.
	 * Sets their loading priority.
	 * @param {Element} root - root element to search for components
	 */
	ZemezCore.prototype.prepare = function ( root ) {
		root = root || this.root;

		// Preparation of components
		for ( let key in this.registry ) {
			let
				entry = this.registry[ key ],
				nodes = [ this.root ];

			// Selection of elements if a selector is given
			if ( entry.selector ) {
				nodes = Array.from( root.querySelectorAll( entry.selector ) );

				// Checking the root element against a selector
				if ( root.nodeType === Node.ELEMENT_NODE && root.matches( entry.selector ) ) {
					nodes.unshift( root );
				}
			}


			// Instantiating a components
			nodes.forEach( ( node ) => {
				if ( !node.ZemezComponent || !node.ZemezComponent[ entry.name ] ) {
					// Component creation
					let component = new ZemezComponent( merge( { owner: this, entry: entry, node: node }, entry ) );

					// Setting the priority of loading a component depending on the position of its element relative to the viewport
					if ( inViewport( node ) ) {
						// node.style.outline = '2px dashed red';
						component.priority = 0;
					} else if ( nearViewport( node ) ) {
						// node.style.outline = '2px dashed blue';
						component.priority = 1;
					} else {
						// node.style.outline = '2px dashed green';
					}

					// Adding a component to the list of all components
					this.components.push( component );

					// Adding a component node to a register entry
					entry.nodes.push( node );
				}
			});
		}
	};

	/**
	 * Method for creating a download queue.
	 * @param {Array} components - an array of components to load.
	 * @param {number} priority - priority number
	 * @param {boolean} throwEvent - creating an event upon completion of the download queue.
	 * @return {Promise} - promises of executing the component download queue.
	 */
	ZemezCore.prototype.queue = function ( components, priority, throwEvent ) {
		let queue = {
			styles: [],
			scripts: []
		};

		// Initializing components and adding references to the state of promises (promises to load styles and scripts)
		components.forEach( ( component ) => {
			let componentPromises = component.load();
			queue.styles.push( componentPromises.stylesState );
			queue.scripts.push( componentPromises.scriptsState );
		});

		let promise = Promise.all([
			Promise.all( queue.styles ),
			Promise.all( queue.scripts )
		]);

		if ( throwEvent ) {
			promise.then( () => {
				if ( this.onReady instanceof Function ) this.onReady.call( this, priority );
				let event = new CustomEvent( 'ready' );
				event.priority = priority;
				this.root.dispatchEvent( event );
			});
		}

		return promise;
	};

	/**
	 * Initialization method
	 * @param {boolean} throwEvent - creation of an event upon completion of initialization.
	 */
	ZemezCore.prototype.init = function ( throwEvent ) {
		let
			series = [],
			chain = Promise.resolve();

		// Sort components by priority
		this.components.forEach( function ( component ) {
			if ( component.state === 'pending' ) {
				component.state = 'queue';
				if ( !series[ component.priority ] ) series[ component.priority ] = [];
				series[ component.priority ].push( component );
			}
		});

		// Starting component initialization by priority
		series.forEach( ( set, priority ) => {
			chain = chain.then( () => {
				return this.queue( set, priority, throwEvent );
			});
		});

		return chain;
	};

	/**
	 * Creating a observer to track subsequent DOM changes to initialize new components
	 */
	ZemezCore.prototype.observe = function () {
		let tId = null;

		const observer = new MutationObserver( ( mutationsList ) => {
			mutationsList.forEach( ( mutation ) => {
				if ( mutation.type === 'childList' && mutation.addedNodes.length ) {
					mutation.addedNodes.forEach( ( node ) => {
						if ( node.nodeType === Node.ELEMENT_NODE ) {
							if ( tId ) clearTimeout( tId );

							this.prepare( node );

							tId = setTimeout( () => {
								let tmp = [];

								// TODO DEL
								core.components.forEach( function ( component ) {
									if ( component.state === 'pending' ) {
										tmp.push( component );
									}
								});

								// this.log( 'INIT:', tmp );
								this.init();
								}, 100 );
						}
					});
				}
			});
		});

		// Observer launch
		observer.observe( this.root, {
			childList: true,
			subtree: true
		});
	};

	// Changing the ZemezCore tag
	Object.defineProperty( ZemezCore.prototype, Symbol.toStringTag, {
		get: function () { return 'ZemezCore'; }
	});


	if ( !window.ZemezCore ) {
		window.ZemezCore = ZemezCore;
	}
})();
