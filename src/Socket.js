import mitt from 'mitt';

export default class Socket {
    instance = null;
    pingIntervalHandle = null;

    pingInterval = 30000;
    reconnectInterval = 2000;
    connectDelay = 200;

    constructor(props = {}) {
        this._events = mitt();
        this.initialize(props);
    }

    initialize(props) {
        this.instance = new WebSocket(props.url);

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
