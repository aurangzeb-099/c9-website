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
	 * Notification constructor.
	 * @param {object} params
	 * @param {string} params.template
	 * @param {object} params.fields
	 * @param {number} [params.timeout]
	 * @param {number} [params.transition]
	 * @constructor
	 */
	function SimpleNotification ( params ) {
		// Checking required parameters
		if ( !params || !params.parent || !( params.parent instanceof Element ) ) {
			throw new Error( 'SimpleNotification.parent must be an Element' );
		}

		// Merging instance parameters with default parameters
		merge( this, {
			timeout: 2000,
			transition: 250,
			template: '{text}',
			autoshow: true,
			fields: {
				text: ''
			},
			_tId: {
				show: null,
				hide: null,
				kill: null
			}
		});

		// Merging instance parameters with derived parameters
		merge( this, params );

		// Creating a notification element
		this.node = document.createElement( 'div' );
		this.node.className = 'notification';
		this.node.innerHTML = this.procTemplate();

		// Adding an instance reference to element parameters
		this.node.simpleNotification = this;

		if ( this.autoshow ) {
			this.show();
		}
	}

	/**
	 * Processing the notification template.
	 * @return {string} - ready-made notification markup.
	 */
	SimpleNotification.prototype.procTemplate = function () {
		let markup = this.template;

		Object.keys( this.fields ).forEach( ( key ) => {
			let regexp = new RegExp( '\\{'+ ( key ) +'\\}' );
			markup = markup.replace( regexp, this.fields[ key ] || '' );
		});

		return markup;
	};

	/**
	 * Show notification.
	 * Adds a notification node to the specified parent and adds the 'notification-active' class to it.
	 * If timeout is not equal to 0, then the notification will be deleted after the specified time.
	 */
	SimpleNotification.prototype.show = function () {
		this.parent.appendChild( this.node );

		this._tId.show = setTimeout( () => {
			this.node.classList.add( 'notification-active' );
		}, 0 );

		if ( this.timeout ) {
			this._tId.hide = setTimeout( () => {
				this.hide();
			}, this.timeout );
		}
	};

	/**
	 * Hide notification.
	 * First, it removes the 'notification-active' class from the notification node, and after the transition time, the node itself.
	 */
	SimpleNotification.prototype.hide = function () {
		this.node.classList.remove( 'notification-active' );

		this._tId.kill = setTimeout( () => {
			this.remove();
		}, this.transition );
	};

	/**
	 * Immediate deletion of the notification node.
	 * It is needed to remove the node and additionally reset the timeout counters to avoid errors.
	 */
	SimpleNotification.prototype.remove = function () {
		this.node.remove();

		for ( let key in this._tId ) {
			clearTimeout( this._tId[ key ] );
		}
	};


	if ( !window.SimpleNotification ) {
		window.SimpleNotification = SimpleNotification;
	} else {
		throw new Error( 'SimpleNotification is already defined or occupied' );
	}
})();
