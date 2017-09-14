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
        props.url = url
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

// test('Should resubscribe after a socket reconnect', done => {
//     let connectCount = 0;
//     let subscribeCount = 0;
//     mockServer.on('connection', (server, ws) => {
//         connectCount += 1;
//     });
//     mockServer.on('message', msg => {
//         msg = JSON.parse(msg);

//         expect(msg.type).toBe('subscribe');
//         expect(msg.room).toEqual(room);
//         subscribeCount += 1;

//         if (subscribeCount === 1) {
//             socket.instance.close();
//         }

//         if (subscribeCount === 2) {
//             done();
//         }
//     })
//     const socket = new Socket({
//         pingInterval: 10000,
//     });
//     socket.subscribe({ room });
// });
