import mitt from 'mitt';
import Subscription from './Subscription';


export default class Socket {
    instance = null;
    pingIntervalHandle = null;
    subscriptions = [];
    pendingSendActions = [];

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

        ['pingInterval', 'reconnectInterval'].forEach(propName => {
            if (props[propName] !== undefined) {
                this[propName] = props[propName]
            }
        });

        this.instance.onopen = () => {
            this._events.emit('open');
            this._sendPendingMessages();
            this._reconnectSubscriptions();
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
        // If the socket is not connected, push them onto a stack
        // which will pop when the socket connects.
        if (this.instance.readyState !== 1) {
            let resolveSend = null;
            let pSend = new Promise((resolve, reject) => {
                resolveSend = resolve;
            });
            this.pendingSendActions.push({
                message: msg,
                resolve: resolveSend,
            });
            return pSend;
        }

        this._sendDirectly(msg);
        return Promise.resolve();
    }

    get pendingSendMessages() {
        return this.pendingSendActions.map(a => a.message);
    }

    subscribe(options) {
        const sub = new Subscription({ socket: this, ...options });
        this.subscriptions.push(sub);
        this.notifySocketOfSubscription(sub).then(() => {
            sub.messageCached = false;
        });

        return sub;
    }

    _reconnectSubscriptions() {
        this.subscriptions.forEach(sub => {
            if (sub.messageCached) {
                return;
            }
            this.notifySocketOfSubscription(sub);
        })
    }

    notifySocketOfSubscription(sub) {
        return this.send({
            type: 'subscribe',
            requestId: sub.requestId,
            room: sub.room,
        });
    }

    unsubscribe(subscription) {
        subscription.stopListening();

        const subIndex = this.subscriptions.indexOf(subscription);
        this.subscriptions.splice(subIndex, 1);
        return this.send({
            type: 'unsubscribe',
            requestId: subscription.requestId,
        });
    }

    _sendPendingMessages() {
        this.pendingSendActions.forEach(action => {
            this._sendDirectly(action.message);
            action.resolve();
        })
        this.pendingSendActions = [];
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
