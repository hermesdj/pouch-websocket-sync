const debug = require('debug')('pouch-stream-multi-sync:client');
const extend = require('xtend');
const EventEmitter = require('events').EventEmitter;
const Reconnect = require('reconnect-core');
const PipeChannels = require('pipe-channels');
const PouchRemoteStream = require('../pouch-remote-stream');

const interestingSyncEvents = [
    'change', 'paused', 'active', 'denied', 'complete', 'error'];

const interestingReconnectEvents = [
    'connect', 'reconnect', 'disconnect'];

module.exports = createClient;

function createClient(createStream) {
    let reconnect = Reconnect(createStream);

    let PouchDB;
    let channels;
    let syncs = [];
    let r = reconnect(handleStream);
    r.on('error', propagateError);

    let client = new EventEmitter();
    client.connect = connect;
    client.sync = sync;
    client.destroy = client.end = destroy;

    interestingReconnectEvents.forEach(function eachEvent(event) {
        r.on(event, function onEvent(payload) {
            client.emit(event, payload);
        });
    });

    return client;

    // -----------------

    function connect() {
        debug('connect, args = %j', arguments);
        r.reconnect = true;
        r.connect.apply(r, arguments);
        return client;
    }

    function handleStream(stream) {
        debug('handleStream');
        stream.on('error', propagateError);
        channels = PipeChannels.createClient();
        channels.on('error', propagateError);
        stream.pipe(channels).pipe(stream);
        setupSyncs();
    }

    function sync(db, _options) {
        let options = extend({}, {
            remoteName: db._db_name,
        }, _options);

        debug('sync for db %s, options = %j', db._db_name, options);

        /* istanbul ignore next */
        if (!options.remoteName) {
            throw new Error('need options.remoteName');
        }

        /* istanbul ignore next */
        PouchDB = db.constructor || options.PouchDB;

        /* istanbul ignore next */
        if (!PouchDB) {
            throw new Error('need options.PouchDB');
        }

        PouchDB.adapter('remote', PouchRemoteStream.adapter);

        let ret = new EventEmitter();
        ret.cancel = cancel;
        let spec = {
            db: db,
            options: options,
            ret: ret,
            canceled: false,
            dbSync: undefined,
            cancel: cancel,
        };

        syncs.push(spec);

        return ret;

        function cancel() {
            if (!spec.canceled && spec.dbSync) {
                spec.canceled = true;
                spec.dbSync.cancel();
                spec.dbSync.removeAllListeners();
                spec.dbSync = undefined;
            }
            debug('canceled spec');
        }
    }

    function setupSyncs() {
        syncs.forEach(startSync);
    }

    function startSync(spec) {
        debug('startSync: %j', spec.options);
        debug('sync.canceled: %j', spec.canceled);
        let dbSync;

        /* istanbul ignore else */
        if (!spec.canceled) {
            channels.channel({
                database: spec.options.remoteName,
                credentials: spec.options.credentials,
            }, onChannel);
            spec.ret.cancel = cancel;
        }

        function onChannel(err, channel) {
            if (err) {
                spec.ret.emit('error', err);
            } else {
                let remote = PouchRemoteStream();
                let remoteDB = new PouchDB({
                    name: spec.options.remoteName,
                    adapter: 'remote',
                    remote: remote,
                });
                debug('syncing %j to remote %j', spec.db._db_name, remoteDB._db_name);
                dbSync = spec.dbSync = PouchDB.sync(spec.db, remoteDB, {live: true});

                interestingSyncEvents.forEach(function eachEvent(event) {
                    dbSync.on(event, function onEvent(payload) {
                        spec.ret.emit(event, payload);
                    });
                });

                channel.on('error', propagateChannelError);
                remote.stream.on('error', propagateChannelError);
                channel.pipe(remote.stream).pipe(channel);
            }
        }

        /* istanbul ignore next */
        function propagateChannelError(channelError) {
            if (channelError) {
                spec.ret.emit('error', channelError);
            }
        }

        function cancel() {
            spec.cancel();
        }
    }

    function cancelAll() {
        debug('cancelAll');
        syncs.forEach(function eachSync(spec) {
            spec.cancel();
        });
    }

    function destroy() {
        /* istanbul ignore else */
        cancelAll();
        r.reconnect = false;
        r.disconnect();
    }

    function propagateError(err) {
        /* istanbul ignore else */
        if (err && err.message !== 'write after end') {
            client.emit('error', err);
        }
    }
}
