'use strict';

const debug = require('debug')('pouch-stream-server:stream');
const TransformStream = require('stream').Transform;
const extend = require('xtend');
const inherits = require('util').inherits;
const methodMap = require('./method-map');
const methodWrapper = require('./method-wrap');

const defaults = {
    databases: any,
    objectMode: true,
};

module.exports = Stream;

function Stream(dbs, options) {
    if (!(this instanceof Stream)) {
        return new Stream(dbs, options);
    }

    debug('new stream');

    let opts = extend({}, defaults, options);
    this._dbs = dbs;

    if (typeof opts.databases !== 'function') {
        if (!Array.isArray(opts.databases)) {
            opts.databases = [opts.databases];
        }

        opts.databases = anyOf(opts.databases);
    }
    this._options = opts;

    TransformStream.call(this, opts);

    this.setMaxListeners(Infinity);

    this.once('end', function onceEnd() {
        debug('stream ended');
    });
}

inherits(Stream, TransformStream);

Stream.prototype._transform = function _transform(data, enc, callback) {
    let stream = this;
    let seq;

    if (!Array.isArray(data)) {
        stream._protocolError(new Error('require an array'));
        callback();
    } else {
        seq = data.shift();
        let dbName = data.shift();
        let db;
        if (this._options.databases(dbName)) {
            db = stream._dbs.find(dbName);
        }
        if (!db) {
            stream._sendReply(seq, new Error('No allowed database named ' + dbName));
            callback();
        } else {
            let method = data.shift();
            method = methodMap[method] || method;
            let args = data.shift() || [];

            debug('db: %s, method: %s, args: %j', dbName, method, args);
            debug('db: %O', db)

            args.push(cb);
            let fn = db[method];
            if (!fn || (typeof fn) !== 'function') {
                stream._sendReply(seq, new Error('No method named ' + method));
                callback();
            } else {
                let wrapper = methodWrapper[method];
                if (wrapper) {
                    fn = wrapper(fn, stream);
                }
                fn.apply(db, args);
            }
        }
    }

    function cb(err, result) {
        stream._sendReply(seq, err, result);
        callback();
    }
};

Stream.prototype._sendReply = function _sendReply(seq, err, reply) {
    let error;
    if (err) {
        debug('replying with error: %j', err.message);
        error = {
            message: err.message,
            status: err.status,
            name: err.name,
            error: err.error,
        };
    }
    this.push([seq, [error, reply]]);
};


Stream.prototype._protocolError = function protocolError(err) {
    debug('protocol error', err.stack);
    this.push([-1, [{message: err.message}]]);
    this.push(null);
};


function any() {
    return true;
}

function anyOf(values) {
    return function filter(val) {
        return values.indexOf(val) >= 0;
    };
}
