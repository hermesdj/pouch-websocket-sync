'use strict';

const debug = require('debug')('pouch-remote-stream:remote');
const extend = require('xtend');
const Streams = require('./streams');

module.exports = Remote;

const CHANGE_EVENTS = ['change', 'complete', '_error'];

const defaults = {
    stream: {
        objectMode: true,
    },
    maxSeq: 9007199254740991,
};

let nextRemoteId = 0;
let remotes = {};

function Remote(options) {
    if (!(this instanceof Remote)) {
        return new Remote(options);
    }

    this._options = extend({}, defaults, options);
    this._options.stream = extend(this._options.stream, defaults.stream, options && options.stream);

    let remote = this;

    this._seq = -1;
    this._listenerSeq = -1;
    this._callbacks = {};
    this._listeners = {};

    this._streams = Streams(this._callbacks, this._options.stream);
    this.stream = this._streams.duplex;

    CHANGE_EVENTS.forEach(function eachEvent(event) {
        remote.stream.on(event, function onEvent(data) {
            debug('event', event, data);
            let listener = remote._listeners[data[0]];
            let eventName = event;
            if (eventName === '_error') {
                eventName = 'error';
            }
            if (listener) {
                debug('have listener for event %s', eventName);
                process.nextTick(function onNextTick() {
                    debug('emitting event %s (%j)', eventName, data[1]);
                    let emitted = listener.emit(eventName, data[1]);
                    debug('emitted event %s ? %j', eventName, emitted);
                });
            }
        });
    });

    this._remoteId = ++nextRemoteId;
    remotes[this._remoteId] = this;

    this.recreate = recreate;
}

function recreate() {
    let remote = remotes[this._remoteId];
    delete remotes[this._remoteId];
    return remote;
}

Remote.prototype.invoke = function invoke(db, method, args, cb) {
    debug('invoke, db=%s, method=%s, args=%j, cb=', db, method, args, cb);
    let seq = this._sequence();
    if (cb) {
        this._callbacks[seq] = cb;
    }
    this._streams.readable.push([seq, db, method, args]);
};


Remote.prototype.addListener = function addListener(listener) {
    let listenerId = this._listenerSequence();

    this._listeners[listenerId] = listener;

    debug('added listener %d', listenerId);

    return listenerId;
};

Remote.prototype.removeListener = function removeListener(id) {
    delete this._listeners[id];
};

Remote.prototype._sequence = function _sequence() {
    let n = ++this._seq;
    if (n > this._options.maxSeq) {
        this._seq = n = 0;
    }
    return n;
};

Remote.prototype._listenerSequence = function _listenerSequence() {
    let n = ++this._listenerSeq;
    if (n > this._options.maxSeq) {
        this._listenerSeq = n = 0;
    }
    return n;
};
