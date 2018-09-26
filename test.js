/*
 ***** BEGIN LICENSE BLOCK *****
 
 This file is part of the Zotero Data Server.
 
 Copyright © 2018 Center for History and New Media
 George Mason University, Fairfax, Virginia, USA
 http://zotero.org
 
 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.
 
 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Affero General Public License for more details.
 
 You should have received a copy of the GNU Affero General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
 
 ***** END LICENSE BLOCK *****
 */

const mysql2Promise = require('mysql2/promise');
const sqlite = require('sqlite');
const config = require('config');

let second = 0;
let ids = [];

async function worker(nr) {
	console.log('Starting worker ' + nr);
	let dbMysql = await mysql2Promise.createConnection({
		host: config.get('masterHost'),
		user: config.get('masterUser'),
		password: config.get('masterPassword'),
		database: config.get('masterDatabase')
	});
	
	let id;
	while (id = ids.pop()) {
		let res = await dbMysql.query('SELECT * FROM doidata WHERE title_hash = ? LIMIT 1', [id]);
		if(!res[0].length) {
			console.log('Error: Row not found');
			process.exit(1);
		}
		second++;
	}
}

async function main() {
	let dbSqlite = await sqlite.open('db/doidata.sqlite', {Promise});
	
	console.log('Loading ids from sqlite');
	let stmt = await dbSqlite.prepare('SELECT CAST(title_hash AS TEXT) title_hash FROM doidata ORDER BY RANDOM() limit 100000');
	let row;
	
	while (row = await stmt.get()) {
		ids.push(row.title_hash);
	}
	
	console.log('Querying ids');
	
	let concurrency = config.get('concurrency');
	
	let promises = [];
	for (let i = 0; i < concurrency; i++) {
		promises.push(worker(i))
	}
	
	await Promise.all(promises);
	
	process.exit(0);
}

setInterval(function () {
	console.log(second + '/s');
	second = 0;
}, 1000);

main();