import { Server } from 'mock-socket';
import S from '../Socket';

let mockServer = null;
const url = 'ws://app.test/ws/';
const room = { foo: 'bar' }

beforeEach(() => {
    mockServer = new Server(url);
});

afterEach(done => {
    mockServer.stop(done);
});

class Socket extends S {
    constructor(props = {}) {
        props.url = url;
        props.reconnectInterval = 50;
        super(props);
    }
}

test('Should send a subscribe message when subscribing', done => {
    let subscription = null;

    const socket = new Socket();
    mockServer.on('message', msg => {
        msg = JSON.parse(msg);
        expect(msg).toEqual({
            type: 'subscribe',
            requestId: subscription.requestId,
            room,
        })
        done()
    });

    subscription = socket.subscribe({ room });
});

test('Should add a Subscription when subscribing', done => {
    let subscription = null;

    const socket = new Socket();
    mockServer.on('message', msg => {
        msg = JSON.parse(msg);
        expect(msg.type).toBe('subscribe');
        expect(socket.subscriptions.length).toBe(1);
        expect(socket.subscriptions[0]).toBe(subscription);
        expect(msg.requestId).toBe(subscription.requestId);
        done()
    });

    subscription = socket.subscribe({ room });
})

test('Should trigger onPublish', done => {
    let subscription = null;

    const socket = new Socket();
    mockServer.on('message', msg => {
        msg = JSON.parse(msg);

        expect(msg.type).toBe('subscribe');
        mockServer.send(JSON.stringify({
            type: 'publish',
            data: 'bar',
            requestId: 'fake',
        }));
        mockServer.send(JSON.stringify({
            type: 'publish',
            data: 'bar',
            requestId: subscription.requestId,
        }));
    });

    subscription = socket.subscribe({ room, onPublish: (msg) => {
        expect(msg).toEqual({
            type: 'publish',
            data: 'bar',
            requestId: subscription.requestId,
        })
        done();
    } });
});

test('Should trigger onReconnect', done => {
    let connectCount = 0;
    let subscribeCount = 0;
    let onReconnectCount = 0;

    const socket = new Socket({
    });

    mockServer.on('connection', () => {
        connectCount += 1;

        if (connectCount === 2) {
            // Reconnect should be fired before the subscribeRefresh is fired
            expect(subscribeCount).toBe(1);
            expect(onReconnectCount).toBe(1);
            done()
        }
    });
    mockServer.on('message', msg => {
        msg = JSON.parse(msg);

        expect(msg.type).toBe('subscribe');
        subscribeCount += 1;

        if (subscribeCount === 1) {
            socket.instance.close()
        }
    });

    socket.subscribe({
        room,
        onReconnect: () => {
            onReconnectCount += 1;
        },
    });
});

test('Should remove onPublish after unsubscribe', done => {
    let subscription = null;
    let publishesReceived = 0;

    const socket = new Socket();
    mockServer.on('message', msg => {
        msg = JSON.parse(msg);

        if (msg.type !== 'subscribe') {
            return;
        }

        mockServer.send(JSON.stringify({
            type: 'publish',
            data: 'first',
            requestId: subscription.requestId,
        }));
        mockServer.send(JSON.stringify({
            type: 'publish',
            data: 'second',
            requestId: subscription.requestId,
        }));
        expect(publishesReceived).toBe(1);
        expect(socket.subscriptions).toEqual([]);
        done();
    });

    subscription = socket.subscribe({ room, onPublish: (msg) => {
        publishesReceived += 1;
        socket.unsubscribe(subscription);
    }});
})

test('Should remove onReconnect after unsubscribe', done => {
    let subscription = null;
    let reconnectCalled = false;
    let connectCount = 0;
    let subscribeCount = 0;
    let unSubscribeCount = 0;

    const socket = new Socket({
    });
    mockServer.on('connection', () => {
        connectCount += 1;
    });
    mockServer.on('message', msg => {
        msg = JSON.parse(msg);


        if (msg.type === 'subscribe') {
            subscribeCount += 1;
            socket.unsubscribe(subscription);
        }

        if (msg.type === 'unsubscribe') {
            unSubscribeCount += 1;
            socket.instance.close()
        }
    });

    setTimeout(function() {
        expect(subscribeCount).toBe(1);
        expect(unSubscribeCount).toBe(1);
        expect(connectCount).toBe(2);
        expect(reconnectCalled).toBe(false);
        done()
    }, 250);

    subscription = socket.subscribe({
        room,
        onReconnect: () => {
            reconnectCalled = true;
        },
    });
})

test('Should send an unsubscribe message when unsubscribing', done => {
    let subscription = null;
    let subscribeCalled = false;

    const socket = new Socket();
    mockServer.on('message', msg => {
        msg = JSON.parse(msg);

        if (msg.type === 'subscribe') {
            expect(msg).toEqual({
                type: 'subscribe',
                requestId: subscription.requestId,
                room,
            })
            subscribeCalled = true;
            return
        }

        expect(subscribeCalled).toBe(true);
        expect(msg).toEqual({
            type: 'unsubscribe',
            requestId: subscription.requestId,
        });
        done()
    });

    subscription = socket.subscribe({ room });
    socket.unsubscribe(subscription);
});

test('Should remove its subscriptions when unsubscribing', done => {
    let subscription = null;
    let subscribeCalled = false;

    const socket = new Socket();
    mockServer.on('message', msg => {
        msg = JSON.parse(msg);

        if (msg.type === 'subscribe') {
            subscribeCalled = true;
            return
        }

        expect(subscribeCalled).toBe(true);
        expect(msg.type).toBe('unsubscribe');
        expect(socket.subscriptions).toEqual([]);
        done()
    });

    subscription = socket.subscribe({ room });
    socket.unsubscribe(subscription);
});

// When the websocket is not yet connected,
// all messages we want to send are cached and only sent when the websocket connects.
//
// We also want to refresh Subscriptions when the socket connects,
// to make sure the frontend doesn't break when the websocket server has to restart
//
// So when the socket connects, we pop our cache and want to refresh subscriptions.
// Here we test that the subscribe message isnt sent twice,
// make sure the subscription refresh excludes unsent subscription messages
test('Should not try to refresh a subscription when the actual message is pending', done => {
    let subscription = null;
    let subscribeCount = 0;

    const socket = new Socket();
    mockServer.on('message', msg => {
        msg = JSON.parse(msg);
        expect(msg.type).toBe('subscribe');
        subscribeCount += 1;
    });

    setTimeout(function() {
        expect(subscribeCount).toBe(1);
        done()
    }, 250);

    subscription = socket.subscribe({ room });

    // expect the subscribe message to be cached
    expect(socket.pendingSendMessages[0]).toEqual({
        type: 'subscribe',
        requestId: subscription.requestId,
        room,
    });
});

test('Should resubscribe after a socket reconnect', done => {
    let connectCount = 0;
    let subscribeCount = 0;

    mockServer.on('connection', (server, ws) => {
        connectCount += 1;
    });

    mockServer.on('message', msg => {
        msg = JSON.parse(msg);

        expect(msg.type).toBe('subscribe');
        expect(msg.room).toEqual(room);
        subscribeCount += 1;

        if (subscribeCount === 1) {
            socket.instance.close();
        }

        // We expect the socket to have disconnected
        // And send a resubscribe after it has reconnected
        if (subscribeCount === 2) {
            expect(connectCount).toBe(2);
            done();
        }
    })
    const socket = new Socket({
        pingInterval: 10000,
    });
    socket.subscribe({ room });
});

test('Should not resubscribe after a socket reconnect when unsubscribed', done => {
    let connectCount = 0;
    let subscribeCount = 0;

    mockServer.on('connection', (server, ws) => {
        connectCount += 1;
    });

    mockServer.on('message', msg => {
        msg = JSON.parse(msg);

        if (msg.type === 'subscribe') {
            subscribeCount += 1;
        }

        if (msg.type === 'unsubscribe' && connectCount === 1) {
            expect(subscribeCount).toBe(1);
            socket.instance.close();
        }
    })

    setTimeout(function() {
        expect(connectCount).toBe(2);
        expect(subscribeCount).toBe(1);
        done()
    }, 250);

    const socket = new Socket({
        pingInterval: 10000,
    });
    const sub = socket.subscribe({ room });
    socket.unsubscribe(sub);
});
