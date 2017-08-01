'use strict';

var _ = require('underscore');
var pwgen = require('password-generator');
var Q = require('q');

module.exports = function (config, cmdOptions) {
	console.log('applying custom handler ' + __filename);
	var deferred = Q.defer();

	if (!config.Database || !config.Database.database) {
		var database = cmdOptions.dbName;
		var user = cmdOptions.dbName;
		var password = pwgen(16, false);
		var host = cmdOptions.dbServer;

		config.Database = {
			database: 'mysql://' + user + ':' + password + '@' + host + '/' + database
		};
	}

	if (!config.Authentication || !config.Authentication.ils_encryption_key) {
		config = _.extend(config, {
			Authentication: {
				ils_encryption_key: pwgen(40, false, /[a-g0-9]/)
			}
		});
	}

	if (cmdOptions.solrUrl) {
		config = _.extend(config, {
			Index: {
				url: cmdOptions.solrUrl
			}
		});
	}

	if (cmdOptions.url) {
		config = _.extend(config, {
			Site: {
				url: cmdOptions.url
			}
		});
	}

	deferred.resolve(config);

	return deferred.promise;
};