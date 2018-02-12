#!/usr/bin/env node

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

const fs = require('fs');
const yargs = require('yargs');
const process = require('process');
const path = require('path');

console.log(`
	autoconfig  Copyright (C) 2018 Leipzig University Library <info@ub.uni-leipzig.de>
	This program comes with ABSOLUTELY NO WARRANTY; for details use \`--license'.
	This is free software, and you are welcome to redistribute it
	under certain conditions.
`);

const args = yargs
	.commandDir('commands')
	.help()
	.options({
		'license': {
			desc: 'shows license',
			boolean: true
		}
	})
	.wrap(120)
	.argv;

if (args.license) {
	return process.stdout.write(fs.readFileSync(path.resolve(path.dirname(__filename), '..', 'LICENSE'), {
		encoding: 'utf8'
	}) + '\n');

}

yargs.showHelp('log');