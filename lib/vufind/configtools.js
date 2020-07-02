/**
	autoconfig

	Copyright (C) 2018 Leipzig University Library <info@ub.uni-leipzig.de>

	Author: Ulf Seltmann <ulf.seltmann@uni-leipzig.de>
	License: GNU GPLv3 <https://spdx.org/licenses/GPL-3.0-or-later.html>

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

'use strict';

const Q = require('q'),
	_ = require('underscore'),
	path = require('path'),
	fs = require('fs'),
	mkdirp = require('mkdirp'),
	ini = require('multi-ini'),
	readdir = require('recursive-readdir'),
	nconf = require('nconf'),
	pwgen = require('password-generator'),
	yaml = require('js-yaml');

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

module.exports = function (o) {
	options = o;

	return {
		processConfig: processConfig,
		findParentConfigs: findParentConfigs,
		findParentLanguages: findParentLanguages,
		createMissingConfigs: createMissingConfigs,
		createMissingLanguages: createMissingLanguages,
		findTargetConfigs: findTargetConfigs,
		createLanguage: createLanguage,
		mergeRuntimeConfigs: mergeRuntimeConfigs,
		updateRuntimeConfigs: updateRuntimeConfigs,
		updateSettings: updateSettings
	};
};

function processConfig() {
	return Q.all([
		findParentConfigs().then(parentConfigs => {
			createMissingConfigs(parentConfigs);
		}),
		findParentLanguages().then(parentLanguages => {
			createMissingLanguages(parentLanguages);
		})
	]).then(() => {
		return findTargetConfigs();
	}).then(targetConfigs => {
		return mergeRuntimeConfigs(targetConfigs);
	}).then(mergedConfig => {
		return updateRuntimeConfigs(mergedConfig);
	}).then(mergedConfig => {
		console.log(`configuration done for site ${options.site}`);
		return mergedConfig;
	}).catch(err => {
		console.error(err);
	});
}

/**
 * finds the parent configs which have to be inherited
 *
 * @returns {promise|*|Q.promise}
 */
function findParentConfigs() {
	var deferred = Q.defer();
	var configPath = path.join(options.basedir, options.site, 'config', 'vufind');

	console.log('finding parent configs in %s', configPath);

	readdir(configPath, function (err, data) {
		if (err && err.code !== 'ENOENT') return deferred.reject(err);
		return deferred.resolve(data || []);
	});

	return deferred.promise;
}

function findParentLanguages() {
	var deferred = Q.defer();
	var languagesPath = path.join(options.basedir, options.site, 'languages');

	console.log('finding parent languages in %s', languagesPath);

	readdir(languagesPath, function (err, data) {
		if (err && err.code !== 'ENOENT') return deferred.reject(err);
		return deferred.resolve(data || []);
	});

	return deferred.promise;
}

function findTargetConfigs() {
	var deferred = Q.defer();
	var configPath = path.join(options.basedir, options.site, options.instance, 'config', 'vufind');

	console.log('finding target configs in %s', configPath);

	readdir(configPath, function (err, data) {
		if (err) deferred.reject(err);
		const result = {};

		data.map(file => {
			if (file.substr(-3) !== 'ini') return;
			const filename = path.basename(file);
			result[filename] = ini.read(file, {
				encoding: 'utf8',
				keep_quotes: true
			});
		});
		deferred.resolve(result);
	});

	return deferred.promise;
}

function createMissingConfigs(parentConfigs) {
	var basePath = path.join(options.basedir, options.site),
		instanceConfigPath = path.join(basePath, options.instance, 'config', 'vufind');

	console.log('creating instance config dir %s', instanceConfigPath);
	mkdirp.sync(instanceConfigPath);

	if (parentConfigs.length === 0) {
		console.log(`no configs found in ${basePath} to inherit from. skipping.`);
		return Q([]);
	}

	// create inheritance from parent-configs
	return Q.all(parentConfigs.map(function (parentConfig) {
		var item = path.basename(parentConfig);
		var destConfig = path.join(instanceConfigPath, item);
		var templateVars = {
			instance: options.instance,
			parentConfig: getRelativePath(path.dirname(destConfig), parentConfig)
		};
		return createConfig(parentConfig, destConfig, templateVars);
	}));
}

function createMissingLanguages(parentLanguages) {

	var basePath = path.join(options.basedir, options.site),
		baseLanguagesPath = path.join(basePath, 'languages'),
		instanceLanguagesPath = path.join(basePath, options.instance, 'languages');

	console.log('creating instance language dir %s', instanceLanguagesPath);
	mkdirp.sync(instanceLanguagesPath);

	if (parentLanguages.length === 0) {
		console.log(`no configs found in ${basePath} to inherit from. skipping.`);
		return Q([]);
	}

	return Q.all(parentLanguages.map(function (parentLanguage) {
		var subFolders = path.dirname(parentLanguage).replace(new RegExp(baseLanguagesPath), '').replace(/^\/|\/$/g, '');
		var item = path.basename(parentLanguage);
		var destConfig = path.join(instanceLanguagesPath, subFolders, item);
		var lOptions = {
			instance: options.instance,
			destConfig: destConfig,
			parentConfig: getRelativePath(instanceLanguagesPath, parentLanguage)
		};
		return createLanguage(lOptions);
	}));
}

function createConfig(parentConfig, targetConfig, templateVars) {
	var deferred = Q.defer();
	var ext = path.extname(path.basename(parentConfig));
	if (ext === '.ini') {
		var content = _.template(config_tpl)(templateVars);

		mkdirp.sync(path.dirname(targetConfig));
		fs.writeFile(targetConfig, content, _.extend(fsOptions, {
			flag: 'wx'
		}), function (err) {
			console.log('initially created ' + targetConfig + ' to inherit ' + parentConfig);
			if (err && err.code !== 'EEXIST') {
				return deferred.reject(err);
			} else if (err) {
				console.log('file already exists, leaving as it is: ' + targetConfig);
			}

			return deferred.resolve();
		});
	} else {
		fs.createReadStream(parentConfig).pipe(
			fs.createWriteStream(targetConfig, {
				flags: 'wx'
			}).on('error', function (err) {
				if (err && err.code !== 'EEXIST') {
					return deferred.reject(err);
				} else if (err) {
					console.log('file already exists, leaving as it is: ' + targetConfig);
				}
				deferred.resolve();

			}).on('finish', function () {
				console.log('copied ' + parentConfig + ' to ' + targetConfig);
				deferred.resolve();
			})
		);
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

function mergeRuntimeConfigs(targetFiles) {

	const defaults = {
		'config.ini': {
			Database: {
				database: 'mysql://' + options.dbName + ':' + pwgen(16, false) + '@' + options.dbServer + '/' + options.dbName
			},
			Authentication: {
				ils_encryption_key: pwgen(40, false, /[a-g0-9]/)
			}
		},
		'searches.ini': {
			ShardPreferences: {
				showCheckboxes: false
			}
		}
	};

	const overrides = {};

	if (options.autoDb) {
		overrides['config.ini'] = {
			Database: defaults['config.ini'].Database
		};
	}

	const envVars = nconf.env({
		parseValues: false,
		separator: '__',
		transform: (obj) => {
			if (!obj.key.match(/^VF_/)) return;

			obj.key = obj.key.replace(/^VF_([^_]+)_([^_]+__)/, '$1.$2');
			return obj;
		}
	}).get();
	delete envVars.type;


	const args = {};

	if (options.args) Object.keys(options.args).map(key => {
		const filename = key.replace(/_/, '.');
		args[filename] = options.args[key];
	});

	function deepExtend(target, source) {
		for (var prop in source) {
			if (prop in target && typeof (target[prop]) == 'object' && typeof (source[prop]) == 'object') {
				deepExtend(target[prop], source[prop]);
			} else {
				target[prop] = JSON.parse(JSON.stringify(source[prop]));
			}
		}
		return target;
	}

	return fetchSettings().then(settings => {
		// the order of precedence (left-to-right)
		var result = [args, envVars, overrides, targetFiles, settings, defaults].reduceRight(deepExtend, {});
		return result;
	});
}

function updateRuntimeConfigs(runtimeConfigs) {

	const basePath = path.join(options.basedir, options.site),
		instanceConfigPath = path.join(basePath, options.instance, 'config', 'vufind');

	Object.keys(runtimeConfigs).map(file => {
		const filePath = path.resolve(instanceConfigPath, file);
		console.log(`updating configuration ${filePath}`);

		var ext = path.extname(file);
		if (ext === '.yml' || ext === '.yaml') {
			let yamlStr = yaml.safeDump(runtimeConfigs[file]);
			if(yamlStr) {
				fs.writeFileSync(filePath, yamlStr.toString(), 'utf8');
			}
		} else {
			ini.write(filePath, runtimeConfigs[file], {
				encoding: 'utf8',
				keep_quotes: true
			});
		}
	});

	return Q(runtimeConfigs);
}

function fetchSettings() {
	var deferred = Q.defer();
	console.log('parsing defaults from %s', options.settingsFile);
	fs.readFile(options.settingsFile, _.extend(fsOptions, {
		flag: 'r'
	}), function (err, data) {
		if (err && err.code !== 'ENOENT') return deferred.reject(err);

		if (!data) return deferred.resolve({});
		return deferred.resolve(JSON.parse(data));
	});
	return deferred.promise;
}

function updateSettings(runtimeConfigs) {
	var deferred = Q.defer();

	console.log('updating defaults to %s', options.settingsFile);

	fs.mkdir(path.dirname(options.settingsFile), '0700', function (err) {
		if (err && err.code !== 'EEXIST') deferred.reject(err);
		var data = JSON.stringify(runtimeConfigs, null, '  ');

		fs.writeFile(options.settingsFile, data, _.extend(fsOptions, {
			flag: 'w+'
		}), function (err) {
			if (err) return deferred.reject(err);
			deferred.resolve(data);
		});
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