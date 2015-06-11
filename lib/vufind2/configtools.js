"use strict";

var _ = require('underscore');
var Q = require('q');
var fs = require('fs');

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
		";       Add <%= instance %>-specific customization after this header.\n" +
		";\n" +
		";##################### DO NOT DELETE THIS HEADER ####################\n" +
		";####################################################################\n";

var fsOptions = {
	encoding: 'utf8',
	mode: '0644'
};

module.exports.create = function(options) {
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
			deferred.resolve(options)
		} catch (err) {
			deferred.reject(err);
		}
	}

	return deferred.promise;
};

module.exports.append = function(config, file) {
	var deferred = Q.defer();

	var data = '';

	for (var section in config) {
		if (config[section].length === 0) continue;
		data += "\n[" + section + "]\n";
		for (var key in config[section]) {
			data += key + " = \"" + config[section][key] + "\"\n";
		}
	}

	fs.writeFile(file, data, _.extend(fsOptions, {flag: 'a+'}), function(err) {
		if (err) return deferred.reject(err);
		deferred.resolve(data);
	});

	return deferred.promise;
};