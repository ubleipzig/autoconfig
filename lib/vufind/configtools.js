'use strict';

var Q = require('q'),
	_ = require('underscore'),
	path = require('path'),
	fs = require('fs'),
	rimraf = require('rimraf'),
	mkdirp = require('mkdirp'),
	ini = require('ini'),
	readdir = require('recursive-readdir');

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

var cmdOptions;

module.exports = function (options) {
	cmdOptions = options;

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
	var defaultsPath = path.join(cmdOptions.configs, cmdOptions.deployId + '.json');
	console.log('parsing defaults from %s', defaultsPath);
	fs.readFile(defaultsPath, _.extend(fsOptions, {
		flag: 'r'
	}), function (err, data) {
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
	var defaultsPath = path.join(cmdOptions.configs, cmdOptions.deployId + '.json');

	console.log('updating defaults to %s', defaultsPath);

	fs.mkdir(cmdOptions.configs, '0700', function (err) {
		if (err && err.code !== 'EEXIST') deferred.reject(err);
		var data = JSON.stringify(defaults, null, '  ');

		fs.writeFile(defaultsPath, data, _.extend(fsOptions, {
			flag: 'w+'
		}), function (err) {
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
	var configPath = path.join(cmdOptions.basedir, cmdOptions.site, 'config', 'vufind');

	console.log('finding parent configs in %s', configPath);

	readdir(configPath, function (err, data) {
		if (err) deferred.reject(err);
		else deferred.resolve(data);
	});

	return deferred.promise;
};

var findParentLanguages = function () {
	var deferred = Q.defer();
	var languagesPath = path.join(cmdOptions.basedir, cmdOptions.site, 'languages');

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
var createConfigs = function (defaults, parentConfigs, parentLanguages) {
	var basePath = path.join(cmdOptions.basedir, cmdOptions.site),
		baseLanguagesPath = path.join(basePath, 'languages'),
		instanceConfigPath = path.join(basePath, cmdOptions.instance, 'config', 'vufind'),
		instanceLanguagesPath = path.join(basePath, cmdOptions.instance, 'languages');

	console.log('creating instance config dir %s', instanceConfigPath);
	mkdirp.sync(instanceConfigPath);
	console.log('creating instance language dir %s', instanceLanguagesPath);
	mkdirp.sync(instanceLanguagesPath);

	return Q.all(_.map(parentConfigs, function (filePath) {
		var item = path.basename(filePath);
		var destConfig = path.join(instanceConfigPath, item);
		var templateVars = {
			instance: cmdOptions.instance,
			parentConfig: getRelativePath(path.dirname(destConfig), filePath)
		};
		return createConfig(filePath, destConfig, templateVars);
	})).then(function () {
		return Q.all(_.map(parentLanguages, function (filePath) {
			var subFolders = path.dirname(filePath).replace(new RegExp(baseLanguagesPath), '').replace(/^\/|\/$/g, '');
			var item = path.basename(filePath);
			var destConfig = path.join(instanceLanguagesPath, subFolders, item);
			var lOptions = {
				instance: cmdOptions.instance,
				destConfig: destConfig,
				parentConfig: getRelativePath(instanceLanguagesPath, filePath)
			};
			return createLanguage(lOptions);
		}));
	}).then(function () {
		var deferred = Q.defer();
		fs.readdir(instanceConfigPath, function (err, files) {
			if (err) return deferred.reject(err);
			files = files.map(function (file) {
				return path.resolve(instanceConfigPath, file);
			});
			deferred.resolve(files);
		});
		return deferred.promise;
	}).then(function (configFiles) {
		return Q.all(configFiles.map(function (file) {
			return extendConfig(file, defaults);
		}));
	}).then(function() {
		return defaults;
	});
};

function extendConfig(file, defaults) {
	console.log('extending configuration in ' + file);

	var deferred = Q.defer();
	var item = path.basename(file);

	if (file.substr(-3) !== 'ini') return Q();
	var config = ini.decode(fs.readFileSync(file, {
		encoding: 'utf8'
	}));

	config = _.extend(config, defaults[item]);
	applyConfigHandler(item, config).then(function (config) {
		fs.writeFile(file, ini.encode(config), function (err) {
			if (err) return deferred.reject(err);
			defaults[item] = config;
			deferred.resolve();
		});
	});
	return deferred.promise;
}

function applyConfigHandler(item, config) {
	var deferred = Q.defer();
	try {
		var c = require('./configHandler/' + item);
		c(config, cmdOptions).then(deferred.resolve).catch(deferred.reject);
	} catch (err) {
		deferred.resolve(config);
	}
	return deferred.promise;
}

function createConfig(inheritedConfig, destConfig, templateVars) {
	var deferred = Q.defer();
	var ext = path.extname(path.basename(inheritedConfig));
	if (ext === '.ini') {
		var content = _.template(config_tpl)(templateVars);

		mkdirp.sync(path.dirname(destConfig));
		fs.writeFile(destConfig, content, _.extend(fsOptions, {
			flag: 'wx'
		}), function (err) {
			console.log('initially created ' + destConfig + ' to inherit ' + inheritedConfig);
			if (err && err.code !== 'EEXIST') {
				return deferred.reject(err);
			} else if (err) {
				console.log('file already exists, leaving as it is: ' + destConfig);
			}

			return deferred.resolve();
		});
	} else {
		try {
			fs.createReadStream(inheritedConfig)
				.pipe(fs.createWriteStream(destConfig));
			console.log('copied ' + inheritedConfig + ' to ' + destConfig);
			deferred.resolve();
		} catch (err) {
			deferred.reject(err);
		}
	}

	return deferred.promise;
}

function createLanguage(options) {
	var deferred = Q.defer();

	var content = _.template(language_tpl)(options);
	mkdirp.sync(path.dirname(options.destConfig));
	fs.writeFile(options.destConfig, content, _.extend(fsOptions, {
		flag: 'w+'
	}), function (err) {
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