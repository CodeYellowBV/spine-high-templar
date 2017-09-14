import mitt from 'mitt';
import Subscription from './Subscription';


export default class Socket {
    instance = null;
    pingIntervalHandle = null;
    subscriptions = [];
    pendingSendMessages = [];

    pingInterval = 30000;
    reconnectInterval = 2000;

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

        for (let propName of ['pingInterval', 'reconnectInterval']) {
            if (props[propName] !== undefined) {
                this[propName] = props[propName]
            }
        }

        this.instance.onopen = () => {
            this._events.emit('open');
            this._sendPendingMessages();
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
            this.pendingSendMessages.push(msg);
            return;
        }

        this._sendDirectly(msg);
    }

    subscribe({ room, onPublish }) {
        const sub = new Subscription({ room, onPublish, socket: this });

        this.subscriptions.push(sub);

        this.send({
            type: 'subscribe',
            requestId: sub.requestId,
            room,
        });

        return sub;
    }

    unsubscribe(subscription) {
        subscription.stopListening();

        const subIndex = this.subscriptions.indexOf(subscription);
        this.subscriptions.splice(subIndex, 1);
        // this._removePublishHandler(requestId);
        this.send({
            type: 'unsubscribe',
            requestId: subscription.requestId,
        });
    }

    _removePublishHandler(requestId) {
        const handler = this.publishHandlers[requestId];
        if (!handler) return;

        delete this.publishHandlers[requestId];
        this.off('message', handler);
    }

    _sendPendingMessages() {
        for (let msg of this.pendingSendMessages) {
            this._sendDirectly(msg);
        }
        this.pendingSendMessages = [];
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
