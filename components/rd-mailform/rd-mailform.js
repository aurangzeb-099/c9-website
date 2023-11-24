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
	 * Form constructor.
	 * @param {object} params - parameters
	 * @constructor
	 */
	function RDMailform ( params ) {
		// Checking required parameters
		if ( !params || !params.node || !( params.node instanceof Element ) ) {
			throw new Error( 'RDMailfrom.node must be an Element' );
		}

		// Merging instance parameters with default parameters
		merge( this, {
			// Received parameters
			node: null,
			type: 'contact',
			fields: 'input, select, textarea',
			clean: true,
			msg: {
				'MF000': 'Successfully sent!',
				'MF001': 'Recipients are not set!',
				'MF002': 'Form will not work locally!',
				'MF003': 'Please, define email field in your form!',
				'MF004': 'Please, define type of your form!',
				'MF254': 'Something went wrong with PHPMailer!',
				'MF255': 'Aw, snap! Something went wrong.'
			},
			onInvalid: function () {},
			onSend: function ( data ) {},
			onResponse: function ( response ) {},
			onError: function ( response ) {},
			onSuccess: function ( code, message ) {},
			onBusy: function () {},
			// Internal variables
			inputs: [],
			state: null,
			data: null
		});

		// Merging instance parameters with derived parameters
		merge( this, params );

		// Adding an instance reference to element parameters
		this.node.rdMailform = this;

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
		this.node.addEventListener( 'submit', this.submitHandler.bind( this ) );

		// Setting ready state
		this.state = 'ready';
	}

	/**
	 * Submit event handler.
	 * @param {Event} event - the 'submit' event
	 */
	RDMailform.prototype.submitHandler = function ( event ) {
		// Disable standard form submission
		event.preventDefault();

		// If the instance is busy, then execute a callback for notification of busyness
		if ( this.state === 'ready' ) {
			// Setting busy status
			this.state = 'busy';

			// Creating an empty form data object
			this.data = new FormData();

			// Adding a form type to form data
			this.data.append( 'form-type', this.type );

			// Checking fields
			let
				correct = true,
				// A promise chain is needed for sequential execution of validators that return a function with a promise,
				// and then sending the correct data to the mail server. Such validators (e.g. reCaptcha) can
				// as validation progresses, send requests themselves and expect responses, or else depend on something.
				chain = Promise.resolve();

			this.inputs.forEach( ( node ) => {
				let
					name = node.getAttribute( 'name' ),
					value = node.value,
					valid = node.validator instanceof Function ? node.validator() : true;

				if ( valid instanceof Function ) {
					chain = chain.then( valid ).then( function ( result ) {
						if ( !result ) correct = false;
					});
				} else if ( valid ) {
					if ( name ) {
						this.data.append( name, value );
					}
				} else {
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
	 * Sending a request to the server to send a mail message and processing the result.
	 */
	RDMailform.prototype.request = function () {
		// Setting busy status
		this.state = 'busy';

		// Create a request
		let request = new XMLHttpRequest();

		// Ability to add data to the form through a callback
		if ( this.onSend instanceof Function ) {
			this.onSend.call( this, this.data );
		}

		// Sending data
		request.open( 'POST', 'components/rd-mailform/rd-mailform.php' );
		request.send( this.data );

		// Processing the received sending result
		request.onreadystatechange = () => {
			if ( request.readyState === 4 ) {
				// Callback performed regardless of the result
				if ( this.onResponse instanceof Function ) {
					this.onResponse.call( this, request.responseText );
				}

				// If the status is not 200, then an error occurred while sending
				if ( request.status === 200 ) {
					// If the response is not 5 characters long, then the server sent an incorrect response
					if ( request.responseText.length === 5 && this.onSuccess instanceof Function ) {
						// Clearing fields, if enabled
						if ( this.clean ) {
							this.inputs.forEach( function ( node ) {
								// The field may not have a cleaner
								if ( node.cleaner instanceof Function ) {
									node.cleaner();
								}
							});
						}

						this.onSuccess.call( this, request.responseText, this.msg[ request.responseText ] );
					} else if ( this.onError instanceof Function ) {
						this.onError.call( this, request.responseText );
					}
				} else if ( this.onError instanceof Function ) {
					this.onError.call( this, request.responseText );
				}

				// Regardless of the result, the instance has completed all the actions and is no longer busy
				this.state = 'ready';
			}
		};
	};


	if ( !window.RDMailform ) {
		window.RDMailform = RDMailform;
	} else {
		throw new Error( 'RDMailform is already defined or occupied' );
	}
})();
