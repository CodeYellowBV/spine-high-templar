import uuid from 'uuid/v1';

export default class Subscription {
    room = null;
    socket = null;
    requestId = null;
    onPublish = null;
    onReconnect = null;
    wrappedPublishHandler = null;
    messageCached = true;

    constructor(props = {}) {
        this.room = props.room;
        this.onPublish = props.onPublish;
        this.onReconnect = props.onReconnect;
        this.socket = props.socket;
        this.requestId = uuid()
        this._start();
    }

    _start() {
        if (this.onPublish) {
            this._startListeningForPublish();
        }
        if (this.onReconnect) {
            this._startListeningForReconnect();
        }
    }

    _startListeningForPublish() {
        this.wrappedPublishHandler = msg => {
            if (msg.requestId !== this.requestId || msg.type !== 'publish') {
                return false;
            }
            this.onPublish(msg);
        }
        this.socket.on('message', this.wrappedPublishHandler);
    }

    _startListeningForReconnect() {
        this.wrappedReconnectHandler = () => {
            if (this.messageCached){
                return;
            }
            this.onReconnect();
        }
        this.socket.on('open', this.wrappedReconnectHandler);
    }

    stopListening() {
        if (this.wrappedPublishHandler) {
            this.socket.off('message', this.wrappedPublishHandler);
        }
        if (this.wrappedReconnectHandler) {
            this.socket.off('open', this.wrappedReconnectHandler);
        }
    }
}
