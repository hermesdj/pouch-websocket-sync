'use strict';

const once = require('once');
const timers = require('timers');
const methods = require('./methods');
const debug = require('debug')('pouch-remote-stream:adapter');
const EventEmitter = require('events').EventEmitter;
const promisify = require('./lib/promisify');

module.exports = Adapter;

function Adapter(opts, callback) {
    let adapter = this;
    let cb = once(callback);

    if (!opts.originalName) {
        opts.originalName = this.name;
    }

    debug('adapter constructor called', opts);
    if (!opts.remote) {
        return error('need a remote option');
    }

    debug('going to create remote');
    let remote;
    remote = opts.remote.recreate();
    debug('haz created remote');

    this._name = opts.originalName;
    this.skipDependentDatabase = true;

    this.type = type;

    this._info = info;

    methods.forEach(function eachMethod(method) {
        adapter[method] = wrap(method);
    });

    this._changes = changes;

    debug('done constructing adapter');

    timers.setImmediate(function onImmediate() {
        cb(null, adapter);
    });

    function error(err) {
        cb(new Error(err));
    }

    function wrap(method) {
        return promisify(function promisified() {
            debug('calling %s, (%j)', method, arguments);
            let args = parseArgs(arguments);
            remote.invoke(opts.originalName, method, args, extractCB(args));
        });
    }

    function changes(options) {
        let results = {};

        if (!options.live) {
            results.results = [];
        }

        let listener = new EventEmitter();
        let id = remote.addListener(listener);
        remote.invoke(opts.originalName, '_changes', [id, options]);

        listener.cancel = cancel;

        listener.once('error', cancel);
        listener.on('error', function onceError(err) {
            debug('onceError');
            options.complete(err);
        });

        listener.on('change', function onChange(change) {
            debug('change %j', change);
            results.last_seq = change.seq;
            if (!options.live) {
                results.results.push(change);
            }
        });
        listener.on('change', options.onChange);

        listener.once('complete', function onceComplete() {
            debug('complete, results = %j', results);
            options.complete(null, results);
        });
        listener.once('complete', cancel);

        function cancel() {
            debug('canceling listener %d', id);
            remote.removeListener(id);
        }
    }

    function info(infocb) {
        remote.invoke(opts.originalName, '_info', [], function onInvokeResponse(err, response) {
            /* istanbul ignore if */
            if (err) {
                infocb(err);
            } else {
                response.backend_adapter = 'remote';
                infocb(null, response);
            }
        });
    }
}

Adapter.valid = function valid() {
    return true;
};

function type() {
    return 'remote';
}

function parseArgs(args) {
    return Array.prototype.slice.call(args);
}

function extractCB(args) {
    return args.pop();
}
