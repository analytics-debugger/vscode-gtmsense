#!/usr/bin/env node

const { execSync } = require('child_process');
const readline = require('readline');
const pkg = require('../package.json');

const version = pkg.version;

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

rl.question(`Release v${version}? (y/N) `, (answer) => {
	rl.close();

	if (answer.toLowerCase() === 'y') {
		console.log(`\nCreating tag v${version}...`);
		execSync(`git tag v${version}`, { stdio: 'inherit' });

		console.log('Pushing tag...');
		execSync('git push --tags', { stdio: 'inherit' });

		console.log(`\n✅ Released v${version}!`);
	} else {
		console.log('Cancelled.');
	}
});
