#!/usr/bin/env node

'use strict';

var program = require('commander');

program
	.version('0.0.1')
	.description('creates the config for a site and instance accordingly to defaults and custom overrides')
	.command('vufind2', 'sets up a vufind2 instance')
	.parse(process.argv);
