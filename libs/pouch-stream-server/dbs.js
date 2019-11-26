'use strict';

const debug = require('debug')('pouch-stream-server:dbs');

module.exports = function DBs() {
    let dbs = {};

    return {
        add: add,
        find: find,
    };

    function add(name, db) {
        debug('adding database named %j', name);
        dbs[name] = db;
    }

    function find(name) {
        debug('find(%j)', name);
        return dbs[name];
    }
};
