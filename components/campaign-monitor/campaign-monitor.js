( function () {
	/**
	 * Merging objects
	 * @param {Object} source - source object
	 * @param {Object} merged - merge object
	 * @return {Object} - merged object
	 */
	function merge( source, merged ) {
		for ( let key in merged ) {
			if ( merged[ key ] instanceof Object && merged[ key ].constructor.name === 'Object' ) {
				if ( typeof( source[ key ] ) !== 'object' ) source[ key ] = {};
				source[ key ] = merge( source[ key ], merged[ key ] );
			} else {
				source[ key ] = merged[ key ];
			}
		}

		return source;
	}


	/**
	 * Constructor.
	 * @param {object} params - parameters
	 * @constructor
	 */
	function ZemezCampaignMonitor ( params ) {
		// Checking required parameters
		if ( !params || !params.node || !( params.node instanceof Element ) ) {
			throw new Error( 'ZemezCampaignMonitor.node must be an Element' );
		}

		if ( !params || !params.action || typeof( params.action ) !== 'string' ) {
			throw new Error( 'ZemezCampaignMonitor.action must be a string' );
		}

		if ( !params || !params.id || typeof( params.id ) !== 'string' ) {
			throw new Error( 'ZemezCampaignMonitor.id must be a string' );
		}

		// Merging instance parameters with default parameters
		merge( this, {
			// Received parameters
			node: null,
			action: null,
			id: null,
			fields: 'input, select, textarea',
			clean: true,
			onBusy: function () {
				console.warn( '[ZemezCampaignMonitor] busy' );
			},
			onInvalid: function () {
				console.warn( '[ZemezCampaignMonitor] invalid field' );
			},
			onSend: function ( data ) {
				console.log( '[ZemezCampaignMonitor] sending:', data );
			},
			onSuccess: function ( response, request ) {
				console.log( '[ZemezCampaignMonitor] response:', response );
			},
			onError: function ( error, request ) {
				console.error( '[ZemezCampaignMonitor] error:', error );
			},
			// Internal variables
			inputs: [],
			state: null,
			data: null
		});

		// Merging instance parameters with derived parameters
		merge( this, params );

		// Adding an instance reference to element parameters
		this.node.zemezMailchimp = this;

		// Disabling standard validation
		this.node.setAttribute( 'novalidate', 'novalidate' );

		// Getting all the form fields
		this.inputs = this.node.querySelectorAll( this.fields );

		// Add a cleaner to each field (can be reassigned)
		if ( this.clean ) {
			this.inputs.forEach( function ( node ) {
				if ( !( node.cleaner instanceof Function ) ) {
					node.cleaner = ( function () {
						this.value = '';
					}).bind( node );
				}
			})
		}

		// Installing a form submit handler
		this.node.addEventListener( 'submit', ( event ) => {
			event.preventDefault();
			this.submit();
		});

		// Setting ready state
		this.state = 'ready';
	}

	/**
	 * Send handler
	 */
	ZemezCampaignMonitor.prototype.submit = function () {
		// If the instance is busy, then execute a callback for notification of busyness
		if ( this.state === 'ready' ) {
			// Setting busy status
			this.state = 'busy';

			// Getting the value of a field with an email
			this.data = this.node.querySelector( 'input[name="email"]' ).value;

			// Checking fields
			let
				correct = true,
				// A promise chain is needed for sequential execution of validators that return a function with a promise,
				// and then sending the correct data to the server. Such validators (e.g. reCaptcha) can
				// as validation progresses, send requests themselves and expect responses, or else depend on something.
				chain = Promise.resolve();

			this.inputs.forEach( ( node ) => {
				let valid = node.validator instanceof Function ? node.validator() : true;

				if ( valid instanceof Function ) {
					chain = chain.then( valid ).then( function ( result ) {
						if ( !result ) correct = false;
					});
				} else if ( !valid ) {
					correct = false;
				}
			});

			// Sending a request to the server or calling a callback to notify about incorrect data in the fields
			chain.then( () => {
				if ( correct ) {
					this.request();
				} else if ( this.onInvalid instanceof Function ) {
					this.onInvalid.call( this );
					// Since the request was not sent, the instance is now idle
					this.state = 'ready';
				}
			});
		} else if ( this.onBusy instanceof Function ) {
			this.onBusy.call( this );
		}
	};

	/**
	 * Send request
	 */
	ZemezCampaignMonitor.prototype.request = function () {
		// Setting busy status
		this.state = 'busy';

		// Callback at the start of sending
		if ( this.onSend instanceof Function ) {
			this.onSend.call( this, this.data );
		}

		let
			node = document.createElement( 'script' ),
			cb = 'cb'+ String( Math.random() ).slice( -6 ),
			request = `${this.action}?${this.id}=${this.data}`,
			response = null;

		// Sending data (jsonp)
		node.src = `${request}&callback=CallbackRegistry.${cb}`;
		document.head.appendChild( node );

		// Create callback registry if missing
		if ( !window.CallbackRegistry ) {
			window.CallbackRegistry = {};
		}

		// Callback for the received data
		window.CallbackRegistry[ cb ] = function ( data ) {
			response = data;
		};

		// Processing of the received data
		node.addEventListener( 'load', () => {
			if ( this.onSuccess instanceof Function ) {
				this.onSuccess.call( this, response, request );
			}

			// Removing a node to retrieve data
			node.remove();

			// Deleting received data callback
			delete window.CallbackRegistry[ cb ];

			// Clearing fields, if enabled
			if ( this.clean ) {
				this.inputs.forEach( function ( node ) {
					// The field may not have a cleaner
					if ( node.cleaner instanceof Function ) {
						node.cleaner();
					}
				});
			}

			// Setting ready state
			this.state = 'ready';
		});

		// Error handling
		node.addEventListener( 'error', ( error ) => {
			if ( this.onError instanceof Function ) {
				this.onError.call( this, error, request );
			}

			// Removing a node to retrieve data
			node.remove();

			// Deleting received data callback
			delete window.CallbackRegistry[ cb ];

			// Setting ready state
			this.state = 'ready';
		});
	};


	if ( !window.ZemezCampaignMonitor ) {
		window.ZemezCampaignMonitor = ZemezCampaignMonitor;
	} else {
		throw new Error( 'ZemezCampaignMonitor is already defined or occupied' );
	}
})();
