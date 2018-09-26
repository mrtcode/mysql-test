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
let total = 0;

async function main() {
	let dbSqlite = await sqlite.open('db/doidata.sqlite', {Promise});
	
	let dbMysql = await mysql2Promise.createConnection({
		host: config.get('masterHost'),
		user: config.get('masterUser'),
		password: config.get('masterPassword'),
		database: config.get('masterDatabase')
	});
	
	await dbMysql.execute(`
	 CREATE TABLE IF NOT EXISTS doidata (
	   title_hash BIGINT,
		 author1_len SMALLINT,
		 author1_hash BIGINT,
		 author2_len SMALLINT,
		 author2_hash BIGINT,
		 doi VARCHAR(1024)
	 )`);
	
	// await dbMysql.execute('DROP TABLE doidata');
	
	let stmt = await dbSqlite.prepare('SELECT CAST(title_hash AS TEXT) title_hash, author1_len, author1_hash,author2_len, author2_hash, doi FROM doidata');
	let row;
	let n = 0;
	await dbMysql.query('START TRANSACTION');
	while (row = await stmt.get()) {
		second++;
		total++;
		await dbMysql.query('INSERT INTO doidata VALUES (?,?,?,?,?,?)',
			[
				row.title_hash,
				row.author1_len, row.author1_hash,
				row.author2_len, row.author2_hash,
				row.doi
			]);
		
		if (total % 100000 === 0) {
			console.log('commit');
			await dbMysql.query('COMMIT');
			await dbMysql.query('START TRANSACTION');
		}
	}
	
	await dbMysql.query('COMMIT');
	
	console.log('Creating indices');
	await dbMysql.query('CREATE INDEX title_hash_idx ON doidata (title_hash)');
	await dbMysql.query('CREATE UNIQUE INDEX doi_idx ON doidata (doi)');
	
	process.exit(0);
}

setInterval(function () {
	console.log(`total: ${total}, per second: ${second}`);
	second=0;
}, 1000);

main();