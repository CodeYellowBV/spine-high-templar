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
    mockServer.on('connection', ws => {
        ws.send(JSON.stringify({ foo: 'bar' }));
    });
    const socket = new Socket();
    socket.on('message', msg => {
        expect(msg).toEqual({ foo: 'bar' });
        done();
    })
});

// test('Should send a message correctly', done => {
//     mockServer.on('message', msg => {
//         expect(msg).toEqual(
//             JSON.stringify({
//                 type: 'foo',
//                 authorization: null,
//             })
//         );
//         done();
//     });
//     const socket = new Socket({});
//     socket.send({ type: 'foo' });
// });
