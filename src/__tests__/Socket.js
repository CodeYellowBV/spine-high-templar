import { Server } from 'mock-socket';
import S from '../Socket';

let mockServer = null;
const url = 'ws://app.test/ws/';

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

test('Should open a WebSocket successfully', done => {
    mockServer.on('connection', () => {
        done();
    });
    new Socket({});
});

test('Should receive a message as object', done => {
    mockServer.on('connection', server => {
        server.send(JSON.stringify({ foo: 'bar' }));
    });
    const socket = new Socket();
    socket.on('message', msg => {
        expect(msg).toEqual({ foo: 'bar' });
        done();
    })
});

test('Should send a message correctly', done => {
    mockServer.on('message', msg => {
        expect(msg).toEqual(
            JSON.stringify({
                type: 'foo',
            })
        );
        done()
    });
    const socket = new Socket();
    socket.send({ type: 'foo' });
});

test('Should send pings', done => {
    mockServer.on('message', msg => {
        expect(msg).toEqual('ping');
        done()
    });
    new Socket({
        connectDelay: 50,
        pingInterval: 100,
    });
});

test('Should try to reconnect after a disconnect', done => {
    let count = 0;
    mockServer.on('connection', (server, ws) => {
        if (count > 0) {
            done();
        }
        ws.close();
        count += 1;
    });
    new Socket({
        reconnectInterval: 50,
    });
});

