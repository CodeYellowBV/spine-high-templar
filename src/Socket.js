import mitt from 'mitt';
import uuid from 'uuid/v1';


export default class Socket {
    instance = null;
    pingIntervalHandle = null;
    publishHandlers = {};

    pingInterval = 30000;
    reconnectInterval = 2000;
    connectDelay = 200;

    constructor(props = {}) {
        this._events = mitt();
        this.initialize(props);
    }

    initialize(props) {
        let url = props.url;
        if (props.token) {
            url += `?token=${props.token}`
        }
        this.instance = new WebSocket(url);

        for (let propName of ['pingInterval', 'reconnectInterval', 'connectDelay']) {
            if (props[propName] !== undefined) {
                this[propName] = props[propName]
            }
        }

        this.instance.onopen = () => {
            this._events.emit('open');
            this._initiatePingInterval();
        };

        this.instance.onclose = () => {
            this._events.emit('close');
            this._stopPingInterval();
            setTimeout(() => {
                this.initialize(props);
            }, this.reconnectInterval);
        };

        this.instance.onmessage = evt => {
            if (evt.data === 'pong') {
                return;
            }
            const msg = JSON.parse(evt.data);
            // console.log('[received]', msg);

            this._events.emit('message', msg);
        };
    }

    on(...args) {
        return this._events.on(...args);
    }

    off(...args) {
        return this._events.off(...args);
    }

    send(options) {
        const msg = {
            type: options.type,
            data: options.data,
            room: options.room,
            requestId: options.requestId,
        };
        // console.log('[sent]', msg);
        // Wait for a while if the socket is not yet done connecting...
        if (this.instance.readyState !== 1) {
            setTimeout(() => {
                this._sendDirectly(msg);
            }, this.connectDelay);
            return;
        }
        this._sendDirectly(msg);
    }

    subscribe({ room, onPublish }) {
        const requestId = uuid();

        if (onPublish) {
            this._addPublishHandler(requestId, onPublish);
        }

        this.send({
            type: 'subscribe',
            requestId,
            room,
        });

        return requestId;
    }

    unsubscribe(requestId) {
        this._removePublishHandler(requestId);
        this.send({
            type: 'unsubscribe',
            requestId,
        });
    }

    _addPublishHandler(requestId, handler) {
        const wrappedHandler = msg => {
            if (msg.requestId !== requestId || msg.type !== 'publish') {
                return false;
            }
            handler(msg);
        }
        this.on('message', wrappedHandler)
        this.publishHandlers[requestId] = wrappedHandler;
    }

    _removePublishHandler(requestId) {
        const handler = this.publishHandlers[requestId];
        if (!handler) return;

        delete this.publishHandlers[requestId];
        this.off('message', handler);
    }

    _sendDirectly(msg) {
        this.instance.send(JSON.stringify(msg));
    }

    _initiatePingInterval() {
        this.pingIntervalHandle = setInterval(() => {
            this.instance.send('ping');
        }, this.pingInterval);
    }

    _stopPingInterval() {
        if (this.pingIntervalHandle) {
            clearInterval(this.pingIntervalHandle);
            this.pingIntervalHandle = null;
        }
    }
}
