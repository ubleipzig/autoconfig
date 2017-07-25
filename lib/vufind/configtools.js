'use strict';

var Q = require('q')
	, _ = require('underscore')
	, path = require('path')
	, fs = require('fs')
	, rimraf = require('rimraf')
	, mkdirp = require('mkdirp')
	, ini = require('ini')
	, readdir = require('recursive-readdir');

var config_tpl = '' +
		';####################################################################\n' +
		';##################### DO NOT DELETE THIS HEADER ####################\n' +
		';################### Leipzig University Library © 2015 ##############\n' +
		';\n' +
		'; This is the ISIL-instance-specific <% print(instance.toUpperCase()) %>-INI-file and inherits\n' +
		'; all the settings from the INI-file defined in [Parent_Config] which\n' +
		'; points to the ISIL-instance-specific default INI-file located in\n' +
		'; the folder vufind/ISIL/config/vufind\n' +
		';\n' +
		'\n' +
		'[Parent_Config]\n' +
		'relative_path = <%= parentConfig %>\n' +
		'\n' +
		'; A comma-separated list of config sections from the parent which should be\n' +
		'; completely overwritten by the equivalent sections in this configuration;\n' +
		'; any sections not listed here will be merged on a section-by-section basis.\n' +
		';override_full_sections = "Languages,AlphaBrowse_Types"\n' +
		'\n' +
		';\n' +
		';       Add <% print(instance.toUpperCase()) %>-specific customization after this header.\n' +
		';\n' +
		';##################### DO NOT DELETE THIS HEADER ####################\n' +
		';####################################################################\n';

var language_tpl = '' +
		';####################################################################\n' +
		';##################### DO NOT DELETE THIS HEADER ####################\n' +
		';################### Leipzig University Library © 2015 ##############\n' +
		';\n' +
		'; This is a ISIL-instance-specific <% print(instance.toUpperCase()) %>-LANGUAGE-file and inherits\n' +
		'; all the settings from the LANGUAGE-file defined in @parent_ini which\n' +
		'; points to the ISIL-instance-specific default LANGUAGE-file located in\n' +
		'; the folder vufind/ISIL/languages\n' +
		';\n' +
		';\n' +
		'@parent_ini = "<%= parentConfig %>"\n' +
		';\n' +
		';\n' +
		';       Add <% print(instance.toUpperCase()) %>-specific customization after this header.\n' +
		';\n' +
		';##################### DO NOT DELETE THIS HEADER ####################\n' +
		';####################################################################\n';

var fsOptions = {
	encoding: 'utf8',
	mode: '0644'
};

var options;

module.exports = function(overrides) {
	options = overrides;

	return {
		fetchDefaults: fetchDefaults,
		updateDefaults: updateDefaults,
		findParentConfigs: findParentConfigs,
		findParentLanguages: findParentLanguages,
		createConfigs: createConfigs
	};
};
/**
 * fetches defaults
 *
 * @returns {promise|*|Q.promise}
 */
var fetchDefaults = function () {
	var deferred = Q.defer();
	var defaultsPath = path.join(options.configs, options.deployId + '.json');
	console.log('parsing defaults from %s', defaultsPath);
	fs.readFile(defaultsPath, _.extend(fsOptions, { flag: 'r' }), function (err, data) {
		if (err) {
			console.error(err);
			deferred.resolve({});
		} else {
			deferred.resolve(JSON.parse(data));
		}
	});
	return deferred.promise;
};

var updateDefaults = function (defaults) {
	var deferred = Q.defer();
	var defaultsPath = path.join(options.configs, options.deployId + '.json');

	console.log('updating defaults to %s', defaultsPath);

	fs.mkdir(options.configs, '0700', function (err) {
		if (err && err.code !== 'EEXIST') deferred.reject(err);
		var data = JSON.stringify(defaults, null, '  ');

		fs.writeFile(defaultsPath, data, _.extend(fsOptions, { flag: 'w+' }), function (err) {
			if (err) return deferred.reject(err);
			deferred.resolve(data);
		});
	});

	return deferred.promise;
};

/**
 * finds the parent configs which have to be inherited
 *
 * @returns {promise|*|Q.promise}
 */
var findParentConfigs = function () {
	var deferred = Q.defer();
	var configPath = path.join(options.basedir, options.site, 'config', 'vufind');

	console.log('finding parent configs in %s', configPath);

	readdir(configPath, function (err, data) {
		if (err) deferred.reject(err);
		else deferred.resolve(data);
	});

	return deferred.promise;
};

var findParentLanguages = function() {
	var deferred = Q.defer();
	var languagesPath = path.join(options.basedir, options.site, 'languages');

	console.log('finding parent languages in %s', languagesPath);

	readdir(languagesPath, function (err, data) {
		if (err) deferred.reject(err);
		else deferred.resolve(data);
	});

	return deferred.promise;
};

/**
 * creates a config based on the config-name's implementation and default configuration
 *
 * @param defaults
 * @param configs
 * @param languages
 * @returns {promise|*|Q.promise}
 */
var createConfigs = function (defaults, configs, languages) {
	var basePath = path.join(options.basedir, options.site)
		, baseLanguagesPath = path.join(basePath, 'languages')
		, instanceConfigPath = path.join(basePath, options.instance, 'config', 'vufind')
		, instanceLanguagesPath = path.join(basePath, options.instance, 'languages')
		;

	console.log('creating instance config dir %s', instanceConfigPath);
	rimraf.sync(instanceConfigPath);
	console.log('creating instance language dir %s', instanceLanguagesPath);
	rimraf.sync(instanceLanguagesPath);
	mkdirp.sync(instanceLanguagesPath);

	return Q.all(_.map(configs, function (filePath) {
		var item = path.basename(filePath);
		var destConfig = path.join(instanceConfigPath, item);
		var cOptions = {
			inheritedConfig: filePath,
			destConfig: destConfig,
			parentConfig: getRelativePath(path.dirname(destConfig), filePath),
			configName: item,
			instance: options.instance,
			ext: path.extname(item),
			cOptions: options
		};
		return createConfig(cOptions).then(function (o) {
			if (o.configName && !defaults[o.configName]) defaults[o.configName] = {};
			try {
				var c = require('./' + o.configName);
				return c(o, defaults[o.configName]);
			} catch (err) {
				var deferred = Q.defer();
				deferred.resolve(defaults[o.configName]);
				return deferred.promise;
			}
		}).then(function (config) {
			return appendConfig(config, cOptions.destConfig);
		});
	})).then(function () {
		return Q.all(_.map(languages, function (filePath) {
			var subFolders = path.dirname(filePath).replace(new RegExp(baseLanguagesPath),'').replace(/^\/|\/$/g, '');
			var item = path.basename(filePath);
			var destConfig = path.join(instanceLanguagesPath, subFolders, item);
			var lOptions = {
				instance: options.instance,
				destConfig: destConfig,
				parentConfig: getRelativePath(instanceLanguagesPath, filePath)
			};
			return createLanguage(lOptions);
		}));
	}).then(function () {
		return defaults;
	});
};

function createConfig(options) {
	var deferred = Q.defer();

	if (options.ext === '.ini') {
		var content = _.template(config_tpl)(options);

		mkdirp.sync(path.dirname(options.destConfig));
		fs.writeFile(options.destConfig, content, _.extend(fsOptions, { flag: 'w+' }), function (err) {
			if (err) return deferred.reject(err);
			return deferred.resolve(options);
		});
	} else {
		try {
			fs.createReadStream(options.inheritedConfig)
				.pipe(fs.createWriteStream(options.destConfig));
			console.log('copied ' + options.inheritedConfig + ' to ' + options.destConfig);
			deferred.resolve({});
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
		fs.writeFile(file, data, _.extend(fsOptions, { flag: 'a+' }), function (err) {
			if (err) return deferred.reject(err);
			deferred.resolve(data);
		});
	}

	return deferred.promise;
}

function createLanguage(options) {
	var deferred = Q.defer();

	var content = _.template(language_tpl)(options);
	mkdirp.sync(path.dirname(options.destConfig));
	fs.writeFile(options.destConfig, content, _.extend(fsOptions, { flag: 'w+' }), function (err) {
		if (err) return deferred.reject(err);
		return deferred.resolve(options);
	});

	return deferred.promise;
}

/**
 * taken from https://gist.github.com/eriwen/1211656
 *
 * Given a source directory and a target filename, return the relative
 * file path from source to target.
 * @param source {String} directory path to start from for traversal
 * @param target {String} directory path and filename to seek from source
 * @return Relative path (e.g. "../../style.css") as {String}
 */
function getRelativePath(source, target) {
	var sep = (source.indexOf('/') !== -1) ? '/' : '\\',
		targetArr = target.split(sep),
		sourceArr = source.split(sep),
		filename = targetArr.pop(),
		targetPath = targetArr.join(sep),
		relativePath = '';

	while (targetPath.indexOf(sourceArr.join(sep)) === -1) {
		sourceArr.pop();
		relativePath += '..' + sep;
	}

	var relPathArr = targetArr.slice(sourceArr.length);
	relPathArr.length && (relativePath += relPathArr.join(sep) + sep);

	return relativePath + filename;
}