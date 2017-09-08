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
    let requestId = null;

    const socket = new Socket();
    mockServer.on('message', msg => {
        msg = JSON.parse(msg);
        expect(msg).toEqual({
            type: 'subscribe',
            requestId,
            room,
        })
        done()
    });

    requestId = socket.subscribe({ room });
});

test('Should trigger onPublish', done => {
    let requestId = null;

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
            requestId,
        }));
    });

    requestId = socket.subscribe({ room, onPublish: (msg) => {
        expect(msg).toEqual({
            type: 'publish',
            data: 'bar',
            requestId,
        })
        done();
    } });
});

test('Should remove onPublish after unsubscribe', done => {
    let requestId = null;
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
            requestId,
        }));
        mockServer.send(JSON.stringify({
            type: 'publish',
            data: 'second',
            requestId,
        }));
        expect(publishesReceived).toBe(1);
        done();
    });

    requestId = socket.subscribe({ room, onPublish: (msg) => {
        publishesReceived += 1;
        socket.unsubscribe(requestId);
    }});
})

test('Should send an unsubscribe message when unsubscribing', done => {
    let requestId = null;
    let subscribeCalled = false;

    const socket = new Socket();
    mockServer.on('message', msg => {
        msg = JSON.parse(msg);

        if (msg.type === 'subscribe') {
            expect(msg).toEqual({
                type: 'subscribe',
                requestId,
                room,
            })
            subscribeCalled = true;
            return
        }

        expect(subscribeCalled).toBe(true);
        expect(msg).toEqual({
            type: 'unsubscribe',
            requestId,
        });
        done()
    });

    requestId = socket.subscribe({ room });
    socket.unsubscribe(requestId);
});
