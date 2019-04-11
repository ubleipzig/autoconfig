#!/usr/bin/env node

/**
	autoconfig

	Copyright (C) 2019 Leipzig University Library <info@ub.uni-leipzig.de>

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

const path = require('path');

exports.command = 'introduce-module';
exports.desc = 'introduces module to okapi. to read from stdin use `--from-file -`';
exports.builder = (yargs) => {
	return yargs.options({
		'from-folder': {
			desc: 'for introducing multiple modules you can spceify a folder with module\'s descriptors',
		},
		'from-file': {
			desc: 'a file with a module\'s descriptor. specify `-` to read from stdin',
		},
	});
};

exports.handler = (argv) => {
	if ((!argv.fromFolder && !argv.fromFile) || (argv.fromFolder && argv.fromFile)) {
		console.error('you have to specify either `--from-folder` or `--from-file`');
		return 1;
	}

	const okapitools = require('../../folio/okapitools')({
		okapiUrl: argv.okapiUrl,
		okapiTryCount: 3,
		introduceModuleTryCount: 3,
	});

	okapitools.waitForOkapi()
		.then(() => {
			argv.fromFile
				? okapitools.introduceModule(argv.fromFile)
				: okapitools.introduceModules(argv.fromFolder);
		}).then('done' + console.log)
		.catch(console.error);
};