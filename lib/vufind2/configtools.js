'use strict';

var program = require('commander')
	, Q = require('q')
	, _ = require('underscore')
	, path = require('path')
	, fs = require('fs')
	, rimraf = require('rimraf')
	, mkdirp = require('mkdirp')
	, ini = require('ini')
	, readdir = require('recursive-readdir');
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
		"relative_path = <%= parentConfig %>\n" +
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
		"@parent_ini = \"<%= parentConfig %>\"\n" +
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

var skippedPromise = function (data) {
	var deferred = Q.defer();
	deferred.resolve(data);
	return deferred.promise;
};

/**
 * fetches defaults
 *
 * @param site name
 */
exports.fetchDefaults = function (site) {
	if (program.skipConfig) return skippedPromise();

	var deferred = Q.defer();
	var defaultsPath = path.join(program.configs, site + '.json');
	console.log('parsing defaults from %s', defaultsPath);
	fs.readFile(defaultsPath, _.extend(fsOptions, { flag: 'r' }), function (err, data) {
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

exports.updateDefaults = function (site, defaults) {
	if (!program.write || program.skipConfig) return skippedPromise();

	var deferred = Q.defer();
	var defaultsPath = path.join(program.configs, site + '.json');

	console.log('updating defaults to %s', defaultsPath);

	fs.mkdir(program.configs, '0700', function (err) {
		if (err && err.code !== 'EEXIST') deferred.reject(err);
		var data = JSON.stringify(defaults, null, "  ");

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
 * @param site
 * @returns {promise|*|Q.promise}
 */
exports.findParentConfigs = function (site) {
	if (program.skipConfig) return skippedPromise();

	var deferred = Q.defer();
	var configPath = path.join(program.basedir, site, site, 'config', 'vufind');

	console.log('finding parent configs in %s', configPath);

	readdir(configPath, function (err, data) {
		if (err) deferred.reject(err);
		else deferred.resolve(data);
	});

	return deferred.promise;
};

exports.findParentLanguages = function(site) {
	if (program.skipConfig) return skippedPromise();

	var deferred = Q.defer();
	var languagesPath = path.join(program.basedir, site, site, 'languages');

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
 * @param site
 * @param defaults
 * @param configs
 * @param languages
 * @returns {promise|*|Q.promise}
 */
exports.createConfigs = function (site, defaults, configs, languages) {
	if (program.skipConfig) return skippedPromise('skipping generating configs');

	var basePath = (program.instance === 'live') ? path.join(program.basedir, site) : path.join(program.basedir, site, site)
		, baseConfigPath = path.join(basePath, 'config', 'vufind')
		, baseLanguagesPath = path.join(basePath, 'languages')
		, instanceConfigPath = path.join(basePath, program.instance, 'config', 'vufind')
		, instanceLanguagesPath = path.join(basePath, program.instance, 'languages')
		;

	console.log('creating instance config dir %s', instanceConfigPath);
	rimraf.sync(instanceConfigPath);
	console.log('creating instance language dir %s', instanceLanguagesPath);
	rimraf.sync(instanceLanguagesPath);
	mkdirp.sync(instanceLanguagesPath);

	return Q.all(_.map(configs, function (filePath) {
		var item = path.basename(filePath);
		var destConfig = path.join(instanceConfigPath, item);
		var options = {
			baseDir: program.basedir,
			instance: program.instance,
			site: site,
			inheritedConfig: filePath,
			destConfig: destConfig,
			parentConfig: getRelativePath(path.dirname(destConfig), filePath),
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
		}).then(function (config) {
			return appendConfig(config, options.destConfig);
		});
	})).then(function () {
		return Q.all(_.map(languages, function (filePath) {
			var subFolders = path.dirname(filePath).replace(new RegExp(baseLanguagesPath),'').replace(/^\/|\/$/g, '');
			var item = path.basename(filePath);
			var destConfig = path.join(instanceLanguagesPath, subFolders, item);
			var options = {
				instance: program.instance,
				destConfig: destConfig,
				parentConfig: getRelativePath(path.dirname(destConfig), filePath)
			};
			return createLanguage(options);
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
	var sep = (source.indexOf("/") !== -1) ? "/" : "\\",
		targetArr = target.split(sep),
		sourceArr = source.split(sep),
		filename = targetArr.pop(),
		targetPath = targetArr.join(sep),
		relativePath = "";

	while (targetPath.indexOf(sourceArr.join(sep)) === -1) {
		sourceArr.pop();
		relativePath += ".." + sep;
	}

	var relPathArr = targetArr.slice(sourceArr.length);
	relPathArr.length && (relativePath += relPathArr.join(sep) + sep);

	return relativePath + filename;
}