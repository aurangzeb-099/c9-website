regula.custom({
	name: 'PhoneNumber',
	defaultMessage: 'Invalid phone number format',
	validator: function() {
		if ( this.value === '' ) return true;
		else return /^(\+\d)?[0-9\-\(\) ]{5,}$/i.test( this.value );
	}
});

regula.override({
	constraintType: regula.Constraint.Required,
	defaultMessage: 'The text field is required.'
});

regula.override({
	constraintType: regula.Constraint.Email,
	defaultMessage: 'The email is not a valid email.'
});

regula.override({
	constraintType: regula.Constraint.Numeric,
	defaultMessage: 'Only numbers are required.'
});

regula.override({
	constraintType: regula.Constraint.Selected,
	defaultMessage: 'Please choose an option.'
});
