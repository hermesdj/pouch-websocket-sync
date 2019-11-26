'use strict';

const Stream = require('./stream');
const DBs = require('./dbs');
const extend = require('xtend');

module.exports = Server;

function Server(serverOptions) {
    let dbs = DBs();
    return {
        dbs: dbs,
        stream: function createStream(options) {
            let opts = options;
            if (options && (Array.isArray(options) || (typeof options !== 'object'))) {
                opts = {databases: options};
            }

            return Stream(dbs, extend({}, serverOptions || {}, opts));
        },
    };
}
