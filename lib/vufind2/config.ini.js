'use strict';

var path = require('path');
var _ = require('underscore');
var pwgen = require('password-generator');
var Q = require('q');
var relativeSqlFile = 'module/VuFind/sql/mysql.sql';
var dbtool = require('../mysqltools')();
var program = require('commander');

module.exports = function (options, defaults) {
	var deferred = Q.defer();

	if (!defaults.Database || !defaults.Database.database) {
		var user = 'vufind2_' + options.site;
		var database = user;
		var password = pwgen(16, false);
		var host = program.dbServer;

		defaults.Database = {
			database: 'mysql://' + user + ':' + password + "@" + host + "/" + database
		}
	}

	if (!defaults.Index || !defaults.Index.url) {
		defaults = _.extend(defaults, { Index: { url: program.solrUrl }});
	}

	if (!defaults.Authentication || !defaults.Authentication.ils_encryption_key) {
		defaults = _.extend(defaults, {Authentication: {ils_encryption_key: pwgen(40, false, /[a-g0-9]/) }});
	}

	if (!defaults.Site || !defaults.Site.url) {
		defaults = _.extend(defaults, {Site: {url: program.url + options.site}});
	}

	dbtool.prepare(defaults.Database.database)
		.then(function(result) {
			if (result) {
				dbtool.importSql(defaults.Database.database, path.join(options.baseDir, options.site, relativeSqlFile))
			}
			deferred.resolve(defaults);
		}).catch(deferred.reject);

	return deferred.promise;
};