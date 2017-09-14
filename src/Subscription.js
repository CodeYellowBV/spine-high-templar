import uuid from 'uuid/v1';

export default class Subscription {
    room = null;
    socket = null;
    requestId = null;
    onPublish = null;
    wrappedHandler = null;
    messageCached = true;

    constructor(props = {}) {
        this.room = props.room;
        this.onPublish = props.onPublish;
        this.socket = props.socket;
        this.requestId = uuid()
        this._start();
    }

    _start() {
        if (this.onPublish) {
            this._startListening();
        }
    }

    _startListening() {
        const wrappedHandler = msg => {
            if (msg.requestId !== this.requestId || msg.type !== 'publish') {
                return false;
            }
            this.onPublish(msg);
        }
        this.wrappedHandler = wrappedHandler;
        this.socket.on('message', wrappedHandler)
    }

    stopListening() {
        if (this.wrappedHandler) {
            this.socket.off('message', this.wrappedHandler);
        }
    }
}
