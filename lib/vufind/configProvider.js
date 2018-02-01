const nconf = require('nconf');
const _ = require('underscore');
const pwgen = require('password-generator');
const yargs = require('yargs');

module.exports = (database, host, targetFile) => {

	const defaults = {};

	defaults['config_ini'] = {
		Database: {
			database: 'mysql://' + database + ':' + pwgen(16, false) + '@' + host + '/' + database
		},
		Authentication: {
			ils_encryption_key: pwgen(40, false, /[a-g0-9]/)
		}
	};

	defaults['searches_ini'] = {
		ShardPreferences: {
			showCheckboxes: false
		}
	};


	nconf.argv(yargs.alias({
		'config_ini.Index.url': 'solrUrl',
		'config_ini.Site.url': 'url'
	})).env({
		parseValues: true,
		separator: '__',
		transform: (obj) => {
			if (!obj.key.match(/^AUTOCONFIG_/)) return;

			obj.key = obj.key.replace(/^AUTOCONFIG_/, '');
			return obj;
		}
	}).file('/not/existing.json').defaults(_.extend({}, targetFile, defaults));

	console.log(nconf.get());
};

module.exports('vufind', 'localhost');