'use strict';

var path = require('path');
var _ = require('underscore');
var pwgen = require('password-generator');
var Q = require('q');
var relativeSqlFile = 'module/VuFind/sql/mysql.sql';
var dbtool = require('../mysqltools')({
	host: 'localhost',
	port: 3306,
	user: 'root',
	password: 'rootpw',
	database: 'mysql'
});

var options;

var defaults;

module.exports = function (o, d) {
	defaults = d;
	options = o;

	if (!defaults.Database || !defaults.Database.database) {
		console.log('no database config. creating one ...');

		var user = 'vufind2_' + options.site;
		var database = user;
		var password = pwgen(16, false);

		defaults.Database = {
			database: 'mysql://' + user + ':' + password + "@localhost/" + database
		}
	}

	if (!defaults.Index || !defaults.Index.url ) {
		defaults = _.extend(defaults, { Index: { url: 'http://172.18.85.142:8085/solr' }});
	}

	if (!defaults.Authentication || !defaults.Authentication.encryption_key) {
		_.extend(defaults, {Authentication: {encryption_key: pwgen(40, false, /[a-g0-9]/) }});
	}

	var config = _.extend({
		Site: {
			url: 'https://staging.finc.info/vufind2/' + options.site
		}
	}, defaults);

	return dbtool.prepare(defaults.Database.database)
		.then(function(result) {
			if (result) {
				return dbtool.importSql(defaults.Database.database, path.join(options.baseDir, options.site, relativeSqlFile))
			}
		}).catch(function(err) {
			console.log(err);
		});
};