import {
    Store as BStore,
} from 'mobx-spine';
import uuid from 'uuid/v1';

export default class Store extends BStore {
    subscribe({ room, onMessage }) {
        const requestId = uuid();

        this.api.socket.send({
            type: 'subscribe',
            requestId,
            room,
        });

        return requestId;
    }

    unsubscribe(requestId) {
        this.api.socket.send({
            type: 'unsubscribe',
            requestId,
        });
    }
}
