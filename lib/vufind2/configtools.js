'use strict';

var program = require('commander')
	, Q = require('q')
	, _ = require('underscore')
	, path = require('path')
	, fs = require('fs')
	, rimraf = require('rimraf')
	, mkdirp = require('mkdirp')
	, ini = require('ini')
;

var config_tpl = '' +
		";####################################################################\n" +
		";##################### DO NOT DELETE THIS HEADER ####################\n" +
		";################### Leipzig University Library © 2015 ##############\n" +
		";\n" +
		"; This is the ISIL-instance-specific <% print(instance.toUpperCase()) %>-INI-file and inherits\n" +
		"; all the settings from the INI-file defined in [Parent_Config] which\n" +
		"'; points to the ISIL-instance-specific default INI-file located in\n" +
		"; the folder vufind2/ISIL/config/vufind\n" +
		";\n" +
		"\n" +
		"[Parent_Config]\n" +
		"relative_path = ../../../config/vufind/<%= configName %>\n" +
		"\n" +
		"; A comma-separated list of config sections from the parent which should be\n" +
		"; completely overwritten by the equivalent sections in this configuration;\n" +
		"; any sections not listed here will be merged on a section-by-section basis.\n" +
		";override_full_sections = \"Languages,AlphaBrowse_Types\"\n" +
		"\n" +
		";\n" +
		";       Add <% print(instance.toUpperCase()) %>-specific customization after this header.\n" +
		";\n" +
		";##################### DO NOT DELETE THIS HEADER ####################\n" +
		";####################################################################\n";

var language_tpl = '' +
		";####################################################################\n" +
		";##################### DO NOT DELETE THIS HEADER ####################\n" +
		";################### Leipzig University Library © 2015 ##############\n" +
		";\n" +
		"; This is a ISIL-instance-specific <% print(instance.toUpperCase()) %>-LANGUAGE-file and inherits\n" +
		"; all the settings from the LANGUAGE-file defined in @parent_ini which\n" +
		"; points to the ISIL-instance-specific default LANGUAGE-file located in\n" +
		"; the folder vufind2/ISIL/languages\n" +
		";\n" +
		";\n" +
		"@parent_ini = \"../../languages/<%= languageName %>\"\n" +
		";\n" +
		";\n" +
		";       Add <% print(instance.toUpperCase()) %>-specific customization after this header.\n" +
		";\n" +
		";##################### DO NOT DELETE THIS HEADER ####################\n" +
		";####################################################################\n";

var fsOptions = {
	encoding: 'utf8',
	mode: '0644'
};

var skippedPromise = function(data) {
	var deferred = Q.defer();
	deferred.resolve(data);
	return deferred.promise;
};

/**
 * fetches defaults
 *
 * @param site name
 */
exports.fetchDefaults = function(site) {
	if (program.skipConfig) return skippedPromise();

	var deferred = Q.defer();
	var defaultsPath = path.join(program.configs, site + '.json');
	console.log('parsing defaults from %s', defaultsPath);
	fs.readFile(defaultsPath, _.extend(fsOptions, {flag: 'r'}), function (err, data) {
		if (err) {
			console.error(err);
			program.write = true;
			deferred.resolve({});
		} else {
			deferred.resolve(JSON.parse(data));
		}
	});
	return deferred.promise;
};

exports.updateDefaults = function(site, defaults) {
	if (!program.write || program.skipConfig) return skippedPromise();

	var deferred = Q.defer();
	var defaultsPath = path.join(program.configs, site + '.json');

	console.log('updating defaults to %s', defaultsPath);

	fs.mkdir(program.configs, '0700', function(err) {
		if (err && err.code !== 'EEXIST') deferred.reject(err);
		var data = JSON.stringify(defaults, null, "  ");

		fs.writeFile(defaultsPath, data, _.extend(fsOptions, {flag: 'w+'}), function (err) {
			if (err) return deferred.reject(err);
			deferred.resolve(data);
		});
	});

	return deferred.promise;
};

/**
 * finds the parent configs which have to be inherited
 *
 * @param site
 * @returns {promise|*|Q.promise}
 */
exports.findParentConfigs = function(site) {
	if (program.skipConfig) return skippedPromise();

	var deferred = Q.defer();
	var configPath = path.join(program.basedir, site, site, 'config', 'vufind');

	console.log('finding parent configs in %s', configPath);

	fs.readdir(configPath, function (err, data) {
		if (err) {
			deferred.reject(err);
		} else {
			deferred.resolve(_.map(data, function(file) {
				return path.join(configPath, file);
			}));
		}
	});

	return deferred.promise;
};

exports.findParentLanguages = function(site) {
	if (program.skipConfig) return skippedPromise();

	var deferred = Q.defer();
	var languagesPath = path.join(program.basedir, site, site, 'languages');

	console.log('finding parent languages in %s', languagesPath);

	fs.readdir(languagesPath, function (err, data) {
		if (err) {
			deferred.reject(err);
		} else {
			deferred.resolve(_.map(data, function(file) {
				return path.join(languagesPath, file);
			}));
		}
	});

	return deferred.promise;
};

/**
 * creates a configs based on the config-name's implementation and default configuration
 *
 * @param site
 * @param defaults
 * @param configs
 * @param languages
 * @returns {promise|*|Q.promise}
 */
exports.createConfigs = function(site, defaults, configs, languages) {
	if (program.skipConfig) return skippedPromise('skipping generating configs');

	var instanceConfigPath = (program.instance === 'live')
		? path.join(program.basedir, site, program.instance, 'config/vufind')
		: path.join(program.basedir, site, site, program.instance, 'config/vufind');

	var instanceLanguagesPath = (program.instance === 'live')
		? path.join(program.basedir, site, program.instance, 'languages')
		: path.join(program.basedir, site, site, program.instance, 'languages');

	console.log('creating instance config dir %s', instanceConfigPath);
	rimraf.sync(instanceConfigPath);
	mkdirp.sync(instanceConfigPath);
	console.log('creating instance language dir %s', instanceLanguagesPath);
	rimraf.sync(instanceLanguagesPath);
	mkdirp.sync(instanceLanguagesPath);

	return Q.all(_.map(configs, function (filePath) {
		var item = path.basename(filePath);
		var options = {
			baseDir: program.basedir,
			instance: program.instance,
			site: site,
			inheritedConfig: filePath,
			destConfig: path.join(instanceConfigPath, item),
			configName: item,
			ext: path.extname(item)
		};
		return createConfig(options).then(function (options) {
			if (options.configName && !defaults[options.configName]) defaults[options.configName] = {};
			try {
				var c = require('./' + options.configName);
				return c(options, defaults[options.configName]);
			} catch (err) {
				var deferred = Q.defer();
				deferred.resolve(defaults[options.configName]);
				return deferred.promise;
			}
		}).then(function(config) {
			return appendConfig(config, options.destConfig);
		});
	})).then(function() {
		return Q.all(_.map(languages, function (filePath) {
			var item = path.basename(filePath);
			var options = {
				instance: program.instance,
				destConfig: path.join(instanceLanguagesPath, item),
				languageName: item
			};
			return createLanguage(options);
		}));
	}).then(function() {
		return defaults;
	});
};

function createConfig(options) {
	var deferred = Q.defer();

	if (options.ext === '.ini') {
		var content = _.template(config_tpl)(options);

		fs.writeFile(options.destConfig, content, _.extend(fsOptions, {flag: 'w+'}), function(err) {
			if (err) return deferred.reject(err);
			return deferred.resolve(options);
		});
	} else {
		try {
			fs.createReadStream(options.inheritedConfig)
				.pipe(fs.createWriteStream(options.destConfig));
			console.log('copied ' + options.inheritedConfig + ' to ' + options.destConfig);
			deferred.resolve({})
		} catch (err) {
			deferred.reject(err);
		}
	}

	return deferred.promise;
}

function appendConfig(config, file) {
	var deferred = Q.defer();

	if (!config || _.size(config) === 0) {
		deferred.resolve();
	} else {
		console.log('extending configuration in ' + file);
		var data = ini.encode(config);
		fs.writeFile(file, data, _.extend(fsOptions, {flag: 'a+'}), function(err) {
			if (err) return deferred.reject(err);
			deferred.resolve(data);
		});
	}

	return deferred.promise;
}

function createLanguage(options) {
	var deferred = Q.defer();

	var content = _.template(language_tpl)(options);

	fs.writeFile(options.destConfig, content, _.extend(fsOptions, {flag: 'w+'}), function(err) {
		if (err) return deferred.reject(err);
		return deferred.resolve(options);
	});

	return deferred.promise;
}