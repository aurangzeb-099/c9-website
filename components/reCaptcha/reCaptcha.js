/**
 * ReCaptcha v2 plugin for RD Mailform
 */
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


	// Creating a Captcha API ready event
	// The captcha API connection must be carried out after connecting this script, otherwise the event will not fire
	// https://developers.google.com/recaptcha/docs/display#explicitly_render_the_recaptcha_widget
	if ( !( window.onCaptchaReady instanceof Function ) ) {
		window.onCaptchaReady = function () {
			window.reCaptchaReady = true;
			window.dispatchEvent( new CustomEvent( 'reCaptchaReady' ) );
		}
	}


	/**
	 * Captcha constructor.
	 * @param {object} params - captcha parameters.
	 * @constructor
	 */
	function ReCaptcha ( params ) {
		// Checking required parameters
		if ( !params || !params.node || !( params.node instanceof Element ) ) {
			throw new Error( 'ReCaptcha.node must be an Element' );
		}

		// Merging instance parameters with default parameters
		merge( this, {
			_id: null,
			sitekey: null,
			size: 'normal',
			theme: 'light',
			msg: {
				'CPT001': 'Please, setup you "site key" and "secret key" of reCaptcha',
				'CPT002': 'Something wrong with google reCaptcha',
				'invalid': 'Please, prove that you are not robot.'
			},
			output: {
				name: 'form-validation',
				error: 'has-error'
			},
			onRequest: null,
			onResponse: null
		});

		// Merging instance parameters with derived parameters
		merge( this, params );

		// Adding an instance reference to element parameters
		this.node.reCptcha = this;

		// Adding a captcha change event handler
		this.node.addEventListener( 'propertychange', this.validate.bind( this ) );

		// Installing a validator for RD Mailform
		this.node.validator = this.validate.bind( this );

		// Installing a cleaner for RD Mailform
		this.node.cleaner = this.reset.bind( this );

		// Render captcha when API is ready
		if ( window.reCaptchaReady ) {
			this.render();
		} else {
			window.addEventListener( 'reCaptchaReady', this.render.bind( this ) );
		}
	}

	/**
	 * Render captcha and notification fields.
	 */
	ReCaptcha.prototype.render = function () {
		// Captcha render
		this._id = grecaptcha.render(
			this.node,
			{
				sitekey: this.sitekey,
				size: this.size,
				theme: this.theme,
				callback: ( function () {
					this.node.dispatchEvent( new CustomEvent( 'propertychange' ) );
				}).bind( this )
			}
		);

		// Render the notification output field
		this._output = document.createElement( 'span' );
		this._output.className = this.output.name;
		this.node.parentElement.insertBefore( this._output, this.node.nextElementSibling );
	};

	/**
	 * Captcha check.
	 */
	ReCaptcha.prototype.validate = function () {
		// Getting a captcha response
		let response = grecaptcha.getResponse( this.id );

		// If there is no response, then the captcha flag is not marked
		if ( response.length ) {
			this.valid();

			// Captcha response check function
			return () => {
				return new Promise ( ( resolve, reject ) => {
					let
						request = new XMLHttpRequest(),
						data = new FormData();

					if ( this.onRequest instanceof Function ) {
						this.onRequest.call( this, data );
					}

					data.append( 'g-recaptcha-response', response );
					request.open( 'POST', 'components/reCaptcha/reCaptcha.php' );
					request.send( data );

					request.onreadystatechange = () => {
						if ( request.readyState === 4 && request.status === 200 ) {

							if ( this.onResponse instanceof Function ) {
								this.onResponse.call( this, request.responseText );
							}

							if ( request.responseText !== 'CPT000' ) {
								this.reset();
								this.invalid( this.msg[ request.responseText ] );
								resolve( false );
							} else {
								resolve( true );
							}
						}
					};
				});
			};
		} else {
			this.invalid( this.msg.invalid );
			return false;
		}
	};

	/**
	 * Reset captcha.
	 */
	ReCaptcha.prototype.reset = function () {
		grecaptcha.reset( this._id );
	};

	/**
	 * Display an error message.
	 * @param {string} text - error text
	 */
	ReCaptcha.prototype.invalid = function ( text ) {
		this.node.parentElement.classList.add( this.output.error );
		this._output.innerText = text;
	};

	/**
	 * Clearing error messages.
	 */
	ReCaptcha.prototype.valid = function () {
		this.node.parentElement.classList.remove( this.output.error );
		this._output.innerText = '';
	};


	if ( !window.ReCaptcha ) {
		window.ReCaptcha = ReCaptcha;
	} else {
		throw new Error( 'ReCaptcha is already defined or occupied' );
	}
})();
